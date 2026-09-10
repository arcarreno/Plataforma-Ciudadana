/**
 * @file PaqueteDetalle.tsx
 * @description Pestaña de un paquete: sidebar + 1 columna con ÚNICAMENTE
 * las fichas enviadas (reutiliza PanelVistaFichas sin botón de detalle) y
 * abajo las 8 gráficas del paquete (GraficasPaquete).
 * - Recibido (soy destinatario, no es respuesta): botón "Responder" →
 *   checklist por ficha + "Enviar Respuesta" arriba; la respuesta viaja al
 *   emisor y le aparece en su pestaña Respuestas.
 * - Respuesta (la contestaron para mí): veredictos ✓/✗ por ficha.
 * Solo remitente o destinatario (el backend lo verifica). Marca leído al abrir
 * si soy el destinatario. Requiere sesión.
 */
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Package, Reply, Send, X } from 'lucide-react'
import { sileo } from 'sileo'
import { useAuth } from '../contexts/AuthContext'
import { getToken } from '../lib/auth'
import { api } from '../lib/api'
import { responderPaquete } from '../lib/chat'
import { gruposConcentracion, type GrupoCluster } from '../lib/servidor'
import type { Solicitud } from '../types/solicitud'
import PanelVistaFichas from '../solicitud/PanelVistaFichas'
import GraficasPaquete from '../solicitud/GraficasPaquete'

/** Encabezado del paquete con remitente y fecha. */
interface InfoPaquete {
  id: number
  remitente_id: number
  destinatario_id: number
  remitente: string
  destinatario: string
  fecha: string
  leido: boolean
  es_respuesta: boolean
  paquete_origen_id: number | null
  aceptadas_ids: number[] | null
}

export default function PaqueteDetalle() {
  const { user } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [info, setInfo] = useState<InfoPaquete | null>(null)
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [grupos, setGrupos] = useState<GrupoCluster[]>([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  /** Modo respuesta: checklist visible para contestar el paquete. */
  const [modoRespuesta, setModoRespuesta] = useState(false)
  /** IDs aceptados en la respuesta (default: todas). */
  const [aceptadas, setAceptadas] = useState<Set<number>>(new Set())
  const [enviandoResp, setEnviandoResp] = useState(false)

  useEffect(() => {
    if (!user) return
    const token = getToken() ?? undefined
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    setCargando(true)
    setError('')
    setModoRespuesta(false)
    api.get<{
      data: { paquete: InfoPaquete; total: number; solicitudes: Solicitud[] }
    }>(`/api/paquetes/${id}`, headers ? { headers } : undefined).then(
      (r) => {
        setInfo(r.data.paquete)
        setSolicitudes(r.data.solicitudes ?? [])
        setCargando(false)
        // Marca leído (best-effort, no bloquea la vista).
        api.patch(`/api/paquetes/${id}/leido`, {}, headers ? { headers } : undefined).catch(() => {})
        // Racimos globales para colapsar igual que en el panel.
        gruposConcentracion(token).then(
          (g) => setGrupos(g.data ?? []),
          () => setGrupos([]),
        )
      },
      (err) => {
        setError(err instanceof Error ? err.message.replace(/^API error \d+: /, '') : 'No se pudo abrir')
        setCargando(false)
      },
    )
  }, [user, id])

  if (!user) return <Navigate to="/iniciar-sesion" replace />

  const soyDestinatario = info != null && info.destinatario_id === user.id
  const puedeResponder = soyDestinatario && !info.es_respuesta
  const esRespuestaVista = info != null && info.es_respuesta
  const veredictos = esRespuestaVista ? (info.aceptadas_ids ?? []) : null

  /** Activa el modo respuesta con todas marcadas. */
  const iniciarRespuesta = () => {
    setAceptadas(new Set(solicitudes.map((s) => s.id_solicitud).filter((x): x is number => x != null)))
    setModoRespuesta(true)
  }

  const alternar = (sid: number) => {
    setAceptadas((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  }

  /** Envía la respuesta al emisor original. */
  const enviarRespuesta = async () => {
    if (info == null || enviandoResp) return
    setEnviandoResp(true)
    try {
      const r = await responderPaquete(info.id, [...aceptadas], getToken() ?? undefined)
      sileo.success({
        title: 'Respuesta enviada',
        description: `${r.data.aceptadas} de ${r.data.total} aceptadas. Ya la ve en su pestaña Respuestas.`,
        fill: '#ffffff',
        duration: 6000,
        autopilot: true,
        styles: {
          title: 'text-guinda text-sm font-semibold text-center',
          description: 'text-xs text-center text-gray-700',
        },
      })
      navigate('/paquetes')
    } catch (err) {
      sileo.error({
        title: 'No se pudo responder',
        description: err instanceof Error ? err.message.replace(/^API error \d+: /, '') : 'Inténtalo de nuevo',
        fill: '#ffffff',
        duration: 6000,
        autopilot: true,
        styles: {
          title: 'text-guinda text-sm font-semibold text-center',
          description: 'text-xs text-center text-gray-700',
        },
      })
    } finally {
      setEnviandoResp(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      {cargando ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-guinda border-t-transparent" />
        </div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : (
        <>
          {/* Barra de respuesta (solo destinatario de un envío, no de respuesta) */}
          {puedeResponder && !modoRespuesta && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-guinda/20 bg-guinda/5 px-4 py-3">
              <p className="min-w-0 flex-1 text-xs text-gray-institutional">
                Marca qué fichas aceptas y devuelve el checklist contestado al emisor.
              </p>
              <button
                type="button"
                onClick={iniciarRespuesta}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-guinda px-4 py-2 text-sm font-semibold text-white shadow-button hover:bg-guinda/90"
              >
                <Reply className="h-4 w-4" />
                Responder
              </button>
            </div>
          )}
          {puedeResponder && modoRespuesta && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-guinda bg-guinda px-4 py-3 text-white">
              <p className="min-w-0 flex-1 text-xs font-medium text-white/90">
                {aceptadas.size} de {solicitudes.length} aceptadas — se envían contestadas al emisor.
              </p>
              <button
                type="button"
                onClick={() => setModoRespuesta(false)}
                disabled={enviandoResp}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/40 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void enviarRespuesta()}
                disabled={enviandoResp}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-guinda shadow hover:brightness-95 disabled:opacity-50"
              >
                {enviandoResp ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-guinda/30 border-t-guinda" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {enviandoResp ? 'Enviando…' : `Enviar Respuesta (${aceptadas.size})`}
              </button>
            </div>
          )}
          {/* Leyenda de respuesta ya contestada */}
          {esRespuestaVista && info && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
              <p className="min-w-0 flex-1 text-xs font-medium text-green-900">
                Respuesta al paquete #{info.paquete_origen_id} · Aceptadas {(info.aceptadas_ids ?? []).length} de {solicitudes.length}
              </p>
            </div>
          )}
          <PanelVistaFichas
            solicitudes={solicitudes}
            grupos={grupos}
            ocultarDetalle
            seleccionRespuesta={modoRespuesta ? { seleccionados: aceptadas, onToggle: alternar } : null}
            aceptadas={veredictos}
            titulo={
              <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  to="/paquetes"
                  className="flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-medium text-gray-institutional transition-colors hover:bg-guinda/5 hover:text-guinda"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Paquetes
                </Link>
                {info && (
                  <span className="flex items-center gap-2 text-sm text-gray-institutional/60">
                    <Package className="h-4 w-4 text-guinda" />
                    Paquete #{info.id} · de {info.remitente} · {solicitudes.length} ficha(s)
                  </span>
                )}
              </span>
            }
          />
          {/* Analítica del paquete: las 8 gráficas */}
          <GraficasPaquete solicitudes={solicitudes} />
        </>
      )}
    </div>
  )
}
