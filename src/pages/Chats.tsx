/**
 * @file Chats.tsx
 * @description Mensajería estilo WhatsApp entre usuarios logueados.
 * Desktop (lg+): dos paneles que llenan el alto entre header y footer —
 * lista a la izquierda, hilo sin contenedor a la derecha (burbujas sobre
 * el fondo, compositor tipo píldora).
 * Móvil: solo la lista; al abrir un chat se navega a `/chats/:id` (vista de
 * hilo a todo lo alto, con botón atrás, área segura inferior para la píldora
 * de Safari y teclado virtual, input en 16px para no disparar el zoom).
 * Usa el WebSocket único del NotificacionesProvider (toasts y badges
 * globales); HTTP de respaldo si cae. Banner explícito si la lectura falla.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Bell, BellOff, BellRing, MessageCircle, Search, Send,
  TriangleAlert, UserPlus, Wifi, WifiOff,
} from 'lucide-react'
import { sileo } from 'sileo'
import { useAuth } from '../contexts/AuthContext'
import { useNotificaciones, type MensajeVivo } from '../contexts/NotificacionesContext'
import { getToken } from '../lib/auth'
import { estadoPush, registrarPush, type EstadoPush } from '../lib/push'
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

/** Estilo de toast coherente con la app (fondo blanco, título guinda). */
function toastPush(kind: 'success' | 'error', title: string, description: string) {
  const base = {
    title, description, fill: '#ffffff', duration: 6000, autopilot: true,
    styles: {
      title: 'text-guinda text-sm font-semibold text-center',
      description: 'text-xs text-center text-gray-700',
    },
  }
  if (kind === 'success') sileo.success(base)
  else sileo.error(base)
}

/**
 * Campanita de estado push: verde = llegan con la app cerrada; ámbar =
 * tocable para activar; gris/roja = el navegador lo impide (ver título).
 */
function BotonPush() {
  const [estado, setEstado] = useState<EstadoPush>('sin-permiso')
  const [activando, setActivando] = useState(false)

  useEffect(() => {
    void estadoPush().then(setEstado)
  }, [])

  const ayuda: Record<EstadoPush, string> = {
    'activas': 'Notificaciones del sistema activadas: te avisamos aunque cierres la app',
    'sin-permiso': 'Activar notificaciones del sistema (presiona para permitir)',
    'bloqueadas': 'Bloqueadas en el navegador: permite en el candado de la URL. En iPhone agrega el sitio a pantalla de inicio',
    'no-disponible': 'Este navegador no soporta push (en iPhone agrega el sitio a pantalla de inicio)',
    'sin-llave': 'Push no configurado en este servidor todavía',
  }

  const activar = async () => {
    if (estado !== 'sin-permiso' || activando) return
    setActivando(true)
    try {
      const ok = await registrarPush(getToken() ?? '')
      const nuevo = await estadoPush()
      setEstado(nuevo)
      if (ok && nuevo === 'activas') {
        toastPush('success', 'Notificaciones activadas', 'Te avisaremos aunque cierres la app.')
      } else {
        toastPush('error', 'No se pudo activar', 'Revisa el permiso en el candado de la URL e inténtalo de nuevo.')
      }
    } finally {
      setActivando(false)
    }
  }

  const esBoton = estado === 'sin-permiso'
  const cls =
    estado === 'activas'
      ? 'text-green-700 hover:bg-green-50'
      : esBoton
        ? 'text-amber-600 hover:bg-amber-50'
        : 'text-gray-400'
  return (
    <button
      type="button"
      onClick={esBoton ? () => void activar() : undefined}
      disabled={activando}
      title={ayuda[estado]}
      aria-label="Estado de notificaciones del sistema"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${cls} ${esBoton ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {estado === 'activas'
        ? <BellRing className="h-[18px] w-[18px]" />
        : estado === 'sin-permiso' || estado === 'sin-llave'
          ? <Bell className="h-[18px] w-[18px]" />
          : <BellOff className="h-[18px] w-[18px]" />}
    </button>
  )
}

export default function Chats() {
  const { user } = useAuth()
  // WS único, estado de conexión y fallo de lectura (los maneja el provider global)
  const { conectado, fallo, enviarMensaje, suscribirHilo, refrescar } = useNotificaciones()
  const token = getToken() ?? undefined
  const navigate = useNavigate()
  // El hilo abierto vive en la URL (/chats/:id): compartible y con botón atrás.
  const { id: paramId } = useParams()
  const hiloValido = paramId != null && Number.isFinite(Number(paramId)) ? Number(paramId) : null

  const [convs, setConvs] = useState<Conversacion[]>([])
  const [usuarios, setUsuarios] = useState<ChatUsuario[]>([])
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

  /** Carga los mensajes de un hilo (el backend marca leídos) y refresca badges. */
  const cargarHilo = useCallback(async (id: number) => {
    setNuevoPara(null)
    try {
      const r = await listarMensajes(id, token)
      setMensajes(r.data ?? [])
      void recargarConvs()
      refrescar()
    } catch {
      setMensajes([])
    }
  }, [token, recargarConvs, refrescar])

  /** Abre un hilo navegando a su ruta (en móvil es la vista dedicada). */
  const abrirConv = useCallback((id: number) => {
    setNuevoPara(null)
    if (id === hiloValido) void cargarHilo(id)
    else navigate(`/chats/${id}`)
  }, [hiloValido, navigate, cargarHilo])

  // Carga inicial + refresco periódico de la lista y el directorio.
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

  // El hilo de la URL se carga al entrar (incluye refresh y links directos).
  useEffect(() => {
    if (!user || hiloValido == null) return
    setMensajes([])
    void cargarHilo(hiloValido)
  }, [user, hiloValido, cargarHilo])

  // Suscripción al hilo abierto: los mensajes en vivo llegan del WS único
  // (el provider suprime el toast porque el hilo está a la vista).
  useEffect(() => {
    if (!user || hiloValido == null) return
    return suscribirHilo(hiloValido, (m: MensajeVivo) => {
      setMensajes((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev
        return [...prev, { id: m.id, remitente_id: m.remitente_id, texto: m.texto, leido: true, fecha: m.fecha }]
      })
      void recargarConvs()
      refrescar()
    })
  }, [user, hiloValido, suscribirHilo, recargarConvs, refrescar])

  // Auto-scroll del hilo al llegar mensajes.
  const irAlFinal = useCallback(() => {
    const el = hiloRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  useEffect(() => {
    irAlFinal()
  }, [mensajes, hiloValido, nuevoPara, irAlFinal])

  if (!user) return <Navigate to="/iniciar-sesion" replace />

  const hayHilo = hiloValido != null || nuevoPara != null
  const otroId = hiloValido != null
    ? convs.find(c => c.id === hiloValido)?.otro_id ?? null
    : nuevoPara?.id ?? null
  const titulo = hiloValido != null
    ? nombreDe(convs.find(c => c.id === hiloValido) ?? { nombres: '', apellidos: '', username: '' })
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
        window.setTimeout(irAlFinal, 50)
      } else {
        const r = await enviarMensajeHttp(otroId, t, token)
        if (nuevoPara) {
          // Se creó la conversación: navega a su ruta (el efecto la carga).
          setTexto('')
          navigate(`/chats/${r.data.conversacion_id}`)
        } else {
          setMensajes((prev) => [...prev, {
            id: r.data.id, remitente_id: user.id, texto: t, leido: true, fecha: r.data.fecha,
          }])
          void recargarConvs()
          setTexto('')
        }
        refrescar()
      }
    } catch {
      /* error de red: se conserva el texto para reintentar */
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 lg:h-[calc(100dvh-13rem)] lg:min-h-[500px] lg:flex-row">
      {/* Lista: en móvil ocupa todo; con hilo abierto se oculta (el hilo es su vista). */}
      <div className={`${hayHilo ? 'hidden' : 'flex'} min-w-0 flex-col gap-2 lg:flex lg:w-80 lg:shrink-0 lg:overflow-y-auto`}>
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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMostrarDir((v) => !v)}
            className="flex flex-1 items-center gap-2 rounded-xl border border-dashed border-guinda/40 px-3 py-2 text-sm font-medium text-guinda transition-colors hover:bg-guinda/5"
          >
            <UserPlus className="h-4 w-4" />
            Nueva conversación
          </button>
          <BotonPush />
        </div>
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
                  if (existente) abrirConv(existente.id)
                  else {
                    navigate('/chats')
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
        <div className="flex flex-col gap-1">
          {convsFiltradas.map((c) => {
            const activa = c.id === hiloValido
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => abrirConv(c.id)}
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

      {/* Hilo: en móvil es vista dedicada a todo lo alto; en desktop, panel sin contenedor. */}
      <div className={`${hayHilo ? 'flex' : 'hidden'} h-[calc(100dvh-12rem)] min-h-[430px] min-w-0 flex-1 flex-col gap-2 lg:flex lg:h-auto lg:min-h-0`}>
        {hayHilo ? (
          <>
            {/* Cabecera slim del hilo */}
            <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-white/85 px-2 py-2 shadow-sm backdrop-blur">
              <button
                type="button"
                onClick={() => navigate('/chats')}
                aria-label="Volver a la lista"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-guinda transition-colors hover:bg-guinda/10 lg:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-guinda/10 text-sm font-bold text-guinda">
                {(titulo[0] ?? '?').toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-gray-institutional">{titulo}</span>
                <span className={`flex items-center gap-1 text-[11px] ${conectado ? 'text-green-700' : 'text-gray-400'}`}>
                  {conectado ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {conectado ? 'En vivo' : 'Reconectando…'}
                </span>
              </span>
              <BotonPush />
            </div>
            {/* Mensajes sin contenedor, sobre el fondo */}
            <div ref={hiloRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1 py-1">
              {mensajes.map((m) => {
                const mio = m.remitente_id === user.id
                return (
                  <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed sm:max-w-[75%] ${
                      mio ? 'rounded-br-md bg-guinda text-white shadow-sm' : 'rounded-bl-md bg-white text-gray-institutional shadow-sm'
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
            {/* Compositor tipo píldora (área segura inferior incluida) */}
            <div
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-white p-2 shadow-sm"
              style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
            >
              <input
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void enviar() }}
                onFocus={() => window.setTimeout(irAlFinal, 300)}
                placeholder="Escribe un mensaje..."
                maxLength={2000}
                autoComplete="off"
                enterKeyHint="send"
                aria-label="Escribe un mensaje"
                className="min-w-0 flex-1 rounded-full bg-alabaster/50 px-4 py-2.5 text-base outline-none placeholder:text-gray-institutional/35 focus:bg-alabaster/70 lg:text-sm"
              />
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={enviando || !texto.trim()}
                aria-label="Enviar mensaje"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-guinda text-white shadow-button transition-all hover:brightness-110 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
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
