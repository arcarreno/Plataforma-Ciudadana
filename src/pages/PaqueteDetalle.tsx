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
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ListPlus, Package, Reply, Search, Send, X } from 'lucide-react'
import { sileo } from 'sileo'
import { useAuth } from '../contexts/AuthContext'
import { getToken } from '../lib/auth'
import { api } from '../lib/api'
import { responderPaquete, agregarFichasPaquete } from '../lib/chat'
import { gruposConcentracion, listarSolicitudes, type GrupoCluster } from '../lib/servidor'
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
  /** Modo agregar (remitente): checklist de fichas fuera del paquete. */
  const [modoAgregar, setModoAgregar] = useState(false)
  const [candidatas, setCandidatas] = useState<Solicitud[]>([])
  const [cargandoCandidatas, setCargandoCandidatas] = useState(false)
  const [qAdd, setQAdd] = useState('')
  const [nuevasSel, setNuevasSel] = useState<Set<number>>(new Set())
  const [agregando, setAgregando] = useState(false)

  /** Carga paquete + fichas + racimos (reutilizable tras agregar). */
  const cargar = useCallback(() => {
    if (!user) return
    const token = getToken() ?? undefined
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    setCargando(true)
    setError('')
    setModoRespuesta(false)
    setModoAgregar(false)
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

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!user) return <Navigate to="/iniciar-sesion" replace />

  const soyDestinatario = info != null && info.destinatario_id === user.id
  const soyRemitente = info != null && info.remitente_id === user.id
  const puedeResponder = soyDestinatario && !info.es_respuesta
  const puedeAgregar = soyRemitente && info != null && !info.es_respuesta
  const esRespuestaVista = info != null && info.es_respuesta
  const veredictos = esRespuestaVista ? (info.aceptadas_ids ?? []) : null

  /** Activa el modo respuesta con todas marcadas. */
  const iniciarRespuesta = () => {
    setAceptadas(new Set(solicitudes.map((s) => s.id_solicitud).filter((x): x is number => x != null)))
    setModoRespuesta(true)
  }

  /** Carga todas las fichas (paginado) para elegir cuáles agregar. */
  const iniciarAgregar = async () => {
    setModoAgregar(true)
    setNuevasSel(new Set())
    setQAdd('')
    if (candidatas.length > 0) return
    setCargandoCandidatas(true)
    try {
      const todas: Solicitud[] = []
      let page = 1
      for (;;) {
        const r = await listarSolicitudes({ page, pageSize: 200 })
        todas.push(...r.data)
        if (r.data.length < 200 || todas.length >= r.total || page >= 25) break
        page += 1
      }
      setCandidatas(todas)
    } catch {
      setCandidatas([])
    } finally {
      setCargandoCandidatas(false)
    }
  }

  const enPaquete = new Set(solicitudes.map((s) => s.id_solicitud))
  const q = qAdd.trim().toLowerCase()
  const candidatasFiltradas = candidatas.filter(
    (s) =>
      s.id_solicitud != null &&
      !enPaquete.has(s.id_solicitud) &&
      (!q ||
        [s.folio_unico, s.tipo_solicitud, s.nombre_solicitante, s.calle, s.colonia]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))),
  )

  const alternarNueva = (sid: number) => {
    setNuevasSel((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  }

  /** Envía las fichas elegidas al paquete y recarga. */
  const enviarAgregadas = async () => {
    if (info == null || nuevasSel.size === 0 || agregando) return
    setAgregando(true)
    try {
      const r = await agregarFichasPaquete(info.id, [...nuevasSel], getToken() ?? undefined)
      sileo.success({
        title: 'Paquete ampliado',
        description: `${r.data.agregadas} agregada(s). Ahora tiene ${r.data.total} ficha(s).`,
        fill: '#ffffff',
        duration: 6000,
        autopilot: true,
        styles: {
          title: 'text-guinda text-sm font-semibold text-center',
          description: 'text-xs text-center text-gray-700',
        },
      })
      cargar()
    } catch (err) {
      sileo.error({
        title: 'No se pudo agregar',
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
      setAgregando(false)
    }
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
          {/* Barra de agregar (solo remitente de un envío, no de respuesta) */}
          {puedeAgregar && !modoAgregar && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-card">
              <p className="min-w-0 flex-1 text-xs text-gray-institutional/70">
                ¿Faltaron fichas? Agrégalas sin crear otro paquete.
              </p>
              <button
                type="button"
                onClick={() => void iniciarAgregar()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-guinda px-4 py-2 text-sm font-medium text-guinda transition-all hover:bg-guinda/5"
              >
                <ListPlus className="h-4 w-4" />
                Agregar fichas
              </button>
            </div>
          )}
          {puedeAgregar && modoAgregar && (
            <div className="flex flex-col gap-2 rounded-2xl border border-guinda/30 bg-white p-4 shadow-card">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  value={qAdd}
                  onChange={(e) => setQAdd(e.target.value)}
                  placeholder="Buscar folio, tipo, calle, colonia..."
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400"
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 p-1.5">
                {cargandoCandidatas ? (
                  <p className="px-2 py-3 text-xs text-gray-400">Cargando fichas…</p>
                ) : (
                  candidatasFiltradas.map((s) => (
                    <label
                      key={s.id_solicitud}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-guinda/5"
                    >
                      <input
                        type="checkbox"
                        checked={nuevasSel.has(s.id_solicitud!)}
                        onChange={() => alternarNueva(s.id_solicitud!)}
                        className="h-4 w-4 shrink-0 accent-[#7D2447]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-xs font-bold text-guinda">
                          {s.folio_unico}
                        </span>
                        <span className="block truncate text-xs text-gray-institutional/70">
                          {s.tipo_solicitud} · {s.calle || 'Sin calle'} · {s.colonia}
                        </span>
                      </span>
                    </label>
                  ))
                )}
                {!cargandoCandidatas && candidatasFiltradas.length === 0 && (
                  <p className="px-2 py-3 text-xs text-gray-400">Sin resultados (las del paquete ya no salen)</p>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModoAgregar(false)}
                  disabled={agregando}
                  className="rounded-xl border-2 border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void enviarAgregadas()}
                  disabled={agregando || nuevasSel.size === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-guinda px-4 py-2 text-xs font-bold text-white shadow-button hover:bg-guinda/90 disabled:opacity-50"
                >
                  {agregando ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {agregando ? 'Agregando…' : `Agregar (${nuevasSel.size})`}
                </button>
              </div>
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
            sinColapsar
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
