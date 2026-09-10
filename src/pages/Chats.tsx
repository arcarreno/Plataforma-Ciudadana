/**
 * @file Chats.tsx
 * @description Mensajería en tiempo real entre usuarios logueados. Izquierda:
 * buscador + botón de nueva conversación (directorio) + lista de chats con
 * último mensaje y no leídos. Derecha: hilo con burbujas, auto-scroll y caja
 * de envío (Enter). Usa el WebSocket único del NotificacionesProvider (toasts
 * y badges globales); HTTP de respaldo si cae. Si la lectura falla (sin
 * conexión, sesión expirada o modo respaldo) muestra banner explícito en vez
 * de un vacío engañoso.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { MessageCircle, Search, Send, TriangleAlert, UserPlus, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificaciones, type MensajeVivo } from '../contexts/NotificacionesContext'
import { getToken } from '../lib/auth'
import {
  listarConversaciones,
  listarMensajes,
  listarUsuariosChat,
  enviarMensajeHttp,
  type Conversacion,
  type Mensaje,
  type ChatUsuario,
} from '../lib/chat'

/** Nombre mostrable: nombres + apellidos o username. */
function nombreDe(c: { nombres: string; apellidos: string; username: string }): string {
  const n = `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim()
  return n || c.username
}

/** Banner explícito cuando la lectura falla (nunca un vacío silencioso). */
function BannerFallo({ fallo }: { fallo: 'respaldo' | 'auth' | 'red' }) {
  const texto =
    fallo === 'respaldo'
      ? 'Sesión en modo respaldo: sin conexión con el servidor. Chats no disponibles hasta re-conectar.'
      : fallo === 'auth'
        ? 'Sesión expirada o sin permiso. Cierra sesión e inicia de nuevo para ver tus chats.'
        : 'Sin conexión con el servidor. Revisa tu internet o la URL del servidor.'
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
      <TriangleAlert className="h-4 w-4 shrink-0" />
      <span>{texto}</span>
    </div>
  )
}

export default function Chats() {
  const { user } = useAuth()
  // WS único, estado de conexión y fallo de lectura (los maneja el provider global)
  const { conectado, fallo, enviarMensaje, suscribirHilo, refrescar } = useNotificaciones()
  const token = getToken() ?? undefined
  const [convs, setConvs] = useState<Conversacion[]>([])
  const [usuarios, setUsuarios] = useState<ChatUsuario[]>([])
  const [selId, setSelId] = useState<number | null>(null)
  const [nuevoPara, setNuevoPara] = useState<ChatUsuario | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mostrarDir, setMostrarDir] = useState(false)
  const hiloRef = useRef<HTMLDivElement>(null)

  /** Recarga conversaciones (y limpia no leídos del hilo abierto al pedirlo). */
  const recargarConvs = useCallback(async () => {
    try {
      const r = await listarConversaciones(token)
      setConvs(r.data ?? [])
    } catch {
      /* sin red: se conserva la lista anterior */
    }
  }, [token])

  /** Abre un hilo: pide mensajes (el backend marca leídos) y refresca badges. */
  const abrirConv = useCallback(async (id: number) => {
    setSelId(id)
    setNuevoPara(null)
    try {
      const r = await listarMensajes(id, token)
      setMensajes(r.data ?? [])
      void recargarConvs()
    } catch {
      setMensajes([])
    }
  }, [token, recargarConvs])

  // Carga inicial + refresco periódico de la lista.
  useEffect(() => {
    if (!user) return
    void recargarConvs()
    listarUsuariosChat(token).then(
      r => setUsuarios(r.data ?? []),
      () => setUsuarios([]),
    )
    const id = window.setInterval(recargarConvs, 20000)
    return () => window.clearInterval(id)
  }, [user, token, recargarConvs])

  // Suscripción al hilo abierto: los mensajes en vivo llegan del WS único
  // (el provider suprime el toast porque el hilo está a la vista).
  useEffect(() => {
    if (!user || selId == null) return
    return suscribirHilo(selId, (m: MensajeVivo) => {
      setMensajes((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev
        return [...prev, { id: m.id, remitente_id: m.remitente_id, texto: m.texto, leido: true, fecha: m.fecha }]
      })
      void recargarConvs()
      refrescar()
    })
  }, [user, selId, suscribirHilo, recargarConvs, refrescar])

  // Auto-scroll del hilo al llegar mensajes.
  useEffect(() => {
    const el = hiloRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [mensajes, selId, nuevoPara])

  if (!user) return <Navigate to="/iniciar-sesion" replace />

  const otroId = selId != null
    ? convs.find(c => c.id === selId)?.otro_id ?? null
    : nuevoPara?.id ?? null
  const titulo = selId != null
    ? nombreDe(convs.find(c => c.id === selId) ?? { nombres: '', apellidos: '', username: '' })
    : nuevoPara
      ? nombreDe(nuevoPara)
      : ''

  const q = busqueda.trim().toLowerCase()
  const convsFiltradas = convs.filter(c =>
    !q || nombreDe(c).toLowerCase().includes(q) || c.username.toLowerCase().includes(q),
  )
  const usuariosFiltrados = usuarios.filter(u =>
    !q || nombreDe(u).toLowerCase().includes(q) || u.username.toLowerCase().includes(q),
  )

  /** Envía al hilo abierto o al usuario nuevo (WS o HTTP de respaldo). */
  const enviar = async () => {
    const t = texto.trim()
    if (!t || otroId == null || enviando) return
    setEnviando(true)
    try {
      const porWs = enviarMensaje(otroId, t)
      if (porWs) {
        // El servidor confirma por WS; agregamos optimista con id temporal negativo.
        const tmp = -Date.now()
        setMensajes((prev) => [...prev, { id: tmp, remitente_id: user.id, texto: t, leido: true, fecha: new Date().toISOString() }])
        setTexto('')
      } else {
        const r = await enviarMensajeHttp(otroId, t, token)
        if (nuevoPara) {
          // Se creó la conversación: recarga y ábrela.
          await recargarConvs()
          await abrirConv(r.data.conversacion_id)
        } else {
          setMensajes((prev) => [...prev, {
            id: r.data.id, remitente_id: user.id, texto: t, leido: true, fecha: r.data.fecha,
          }])
          void recargarConvs()
        }
        refrescar()
        setTexto('')
      }
    } catch {
      /* error de red: se conserva el texto para reintentar */
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:flex-row">
      {/* Columna izquierda: buscador + directorio + conversaciones */}
      <div className="flex shrink-0 flex-col gap-2 lg:w-80">
        {fallo !== 'ninguno' && <BannerFallo fallo={fallo} />}
        <div className="flex items-center gap-2 rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-gray-institutional/40" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar persona o chat..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-institutional/30"
          />
        </div>
        <button
          type="button"
          onClick={() => setMostrarDir((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-dashed border-guinda/40 px-3 py-2 text-sm font-medium text-guinda transition-colors hover:bg-guinda/5"
        >
          <UserPlus className="h-4 w-4" />
          Nueva conversación
        </button>
        {mostrarDir && (
          <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-card">
            {usuariosFiltrados.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  const existente = convs.find((c) => c.otro_id === u.id)
                  setMostrarDir(false)
                  setBusqueda('')
                  if (existente) void abrirConv(existente.id)
                  else {
                    setSelId(null)
                    setMensajes([])
                    setNuevoPara(u)
                  }
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-guinda/5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-guinda/10 text-sm font-bold text-guinda">
                  {(nombreDe(u)[0] ?? '?').toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-institutional">{nombreDe(u)}</span>
                  <span className="block truncate text-[11px] text-gray-institutional/50">{u.username} · {u.rol}</span>
                </span>
              </button>
            ))}
            {usuariosFiltrados.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-institutional/50">Sin personas</p>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1 overflow-y-auto lg:max-h-[60vh]">
          {convsFiltradas.map((c) => {
            const activa = c.id === selId
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => void abrirConv(c.id)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  activa ? 'bg-guinda text-white shadow-button' : 'bg-white text-gray-institutional hover:bg-guinda/5'
                } border ${activa ? 'border-guinda' : 'border-gray-100'}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  activa ? 'bg-white/20 text-white' : 'bg-guinda/10 text-guinda'
                }`}>
                  {(nombreDe(c)[0] ?? '?').toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{nombreDe(c)}</span>
                  <span className={`block truncate text-xs ${activa ? 'text-white/75' : 'text-gray-institutional/55'}`}>
                    {c.ultimo ?? 'Sin mensajes'}
                  </span>
                </span>
                {c.no_leidos > 0 && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    activa ? 'bg-white text-guinda' : 'bg-guinda text-white'
                  }`}>
                    {c.no_leidos}
                  </span>
                )}
              </button>
            )
          })}
          {convsFiltradas.length === 0 && (
            <p className="py-6 text-center text-xs text-gray-institutional/50">
              Sin conversaciones. Inicia una con el botón de arriba.
            </p>
          )}
        </div>
      </div>

      {/* Columna derecha: hilo + envío */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card" style={{ height: '68vh', minHeight: 420 }}>
        {(selId != null || nuevoPara) ? (
          <>
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <MessageCircle className="h-4 w-4 text-guinda" />
              <p className="min-w-0 flex-1 truncate text-sm font-bold text-gray-institutional">{titulo}</p>
              <span className={`flex items-center gap-1 text-[11px] ${conectado ? 'text-green-700' : 'text-gray-400'}`}>
                {conectado ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                {conectado ? 'En vivo' : 'Reconectando…'}
              </span>
            </div>
            <div ref={hiloRef} className="flex-1 space-y-2 overflow-y-auto bg-alabaster/20 px-4 py-3">
              {mensajes.map((m) => {
                const mio = m.remitente_id === user.id
                return (
                  <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      mio ? 'rounded-br-md bg-guinda text-white' : 'rounded-bl-md bg-white text-gray-institutional shadow-sm'
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                    </div>
                  </div>
                )
              })}
              {mensajes.length === 0 && (
                <p className="py-8 text-center text-xs text-gray-institutional/50">Escribe el primer mensaje</p>
              )}
            </div>
            <div className="flex gap-2 border-t border-gray-100 p-3">
              <input
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void enviar() }}
                placeholder="Escribe un mensaje..."
                maxLength={2000}
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-guinda"
              />
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={enviando || !texto.trim()}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-guinda px-4 py-2 text-sm font-medium text-white shadow-button transition-all hover:brightness-110 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Enviar
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <MessageCircle className="h-10 w-10 text-guinda/30" />
            <p className="text-sm font-medium text-gray-institutional">Elige una conversación</p>
            <p className="text-xs text-gray-institutional/55">o inicia una nueva con cualquier perfil de la plataforma</p>
          </div>
        )}
      </div>
    </div>
  )
}
