/**
 * @file Paquetes.tsx
 * @description Pestaña de paquetes de fichas: recibidos (con badge de
 * nuevo), enviados y respuestas (checklists contestados por el destinatario).
 * Abrir uno navega a `/paquetes/:id`, donde se ven únicamente esas fichas
 * más sus 8 gráficas. Requiere sesión. Si la lectura falla muestra banner
 * explícito (sin conexión / sesión expirada / modo respaldo) en vez de vacío.
 */
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Inbox, MessageSquareReply, Package, Send, TriangleAlert } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificaciones } from '../contexts/NotificacionesContext'
import { getToken } from '../lib/auth'
import { paquetesRecibidos, paquetesEnviados, respuestasRecibidas, type PaqueteResumen } from '../lib/chat'

/** Formato corto de fecha es-MX. */
function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function Paquetes() {
  const { user } = useAuth()
  const { fallo } = useNotificaciones()
  const [tab, setTab] = useState<'recibidos' | 'enviados' | 'respuestas'>('recibidos')
  const [recibidos, setRecibidos] = useState<PaqueteResumen[]>([])
  const [enviados, setEnviados] = useState<PaqueteResumen[]>([])
  const [respuestas, setRespuestas] = useState<PaqueteResumen[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!user) return
    const token = getToken() ?? undefined
    setCargando(true)
    Promise.all([
      paquetesRecibidos(token).then(
        (r) => r.data ?? [],
        () => [] as PaqueteResumen[],
      ),
      paquetesEnviados(token).then(
        (r) => r.data ?? [],
        () => [] as PaqueteResumen[],
      ),
      respuestasRecibidas(token).then(
        (r) => r.data ?? [],
        () => [] as PaqueteResumen[],
      ),
    ]).then(([rec, env, res]) => {
      setRecibidos(rec)
      setEnviados(env)
      setRespuestas(res)
      setCargando(false)
    })
  }, [user])

  if (!user) return <Navigate to="/iniciar-sesion" replace />

  const lista = tab === 'recibidos' ? recibidos : tab === 'enviados' ? enviados : respuestas
  const vacio =
    tab === 'recibidos'
      ? 'Aún no te han enviado paquetes'
      : tab === 'enviados'
        ? 'Aún no has enviado paquetes'
        : 'Aún no responden tus paquetes'

  const tabs = [
    { id: 'recibidos' as const, label: 'Recibidos', Icon: Inbox, nuevo: recibidos.some((p) => !p.leido) },
    { id: 'enviados' as const, label: 'Enviados', Icon: Send, nuevo: false },
    { id: 'respuestas' as const, label: 'Respuestas', Icon: MessageSquareReply, nuevo: respuestas.some((p) => !p.leido) },
  ]

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-guinda">Paquetes de fichas</h1>
        <p className="text-sm text-gray-institutional/60">
          {tab === 'recibidos'
            ? 'Cada paquete muestra únicamente las fichas que te enviaron'
            : tab === 'enviados'
              ? 'Lo que enviaste a otros perfiles de la plataforma'
              : 'Checklists contestados a los paquetes que enviaste'}
        </p>
      </div>

      {fallo !== 'ninguno' && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          <span>
            {fallo === 'respaldo'
              ? 'Sesión en modo respaldo: sin conexión con el servidor. Los paquetes no están disponibles hasta re-conectar.'
              : fallo === 'auth'
                ? 'Sesión expirada o sin permiso. Cierra sesión e inicia de nuevo para ver tus paquetes.'
                : 'Sin conexión con el servidor. Revisa tu internet o la URL del servidor.'}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map(({ id, label, Icon, nuevo }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === id ? 'bg-guinda text-white shadow-button' : 'bg-white text-gray-institutional hover:bg-guinda/5'
            } border ${tab === id ? 'border-guinda' : 'border-gray-100'}`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {nuevo && (
              <span className="rounded-full bg-white px-1.5 text-[11px] font-bold text-guinda">•</span>
            )}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-guinda border-t-transparent" />
        </div>
      ) : lista.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-institutional/50">
          {vacio}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lista.map((p) => (
            <Link
              key={p.id}
              to={`/paquetes/${p.id}`}
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-guinda/10">
                {tab === 'respuestas' ? <MessageSquareReply className="h-5 w-5 text-guinda" /> : <Package className="h-5 w-5 text-guinda" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-gray-institutional">
                  Paquete #{p.id} · {p.total} ficha(s)
                </span>
                <span className="block truncate text-xs text-gray-institutional/60">
                  {tab === 'recibidos'
                    ? `De ${p.remitente}`
                    : tab === 'enviados'
                      ? `Para ${p.destinatario}`
                      : `De ${p.remitente} · responde al #${p.paquete_origen_id ?? '?'}`} · {fechaCorta(p.fecha)}
                </span>
              </span>
              {tab !== 'enviados' && !p.leido && (
                <span className="shrink-0 rounded-full bg-guinda px-2.5 py-1 text-[10px] font-bold text-white">
                  Nuevo
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
