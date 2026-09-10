/**
 * @file ModalEnviarFichas.tsx
 * @description Modal para enviar un paquete de fichas a otro usuario: checklist
 * de fichas (todas las solicitudes, con buscar + todas/ninguna), selector de
 * destinatario (directorio), vista previa de lo elegido y envío como paquete.
 * Las fichas en grupo de concentración van AGRUPADAS: bloque con cabecera
 * ("Grupo ×N") + miembros indentados abajo; elegir 1 selecciona a todas.
 * El destinatario lo abre en la pestaña Paquetes y ve únicamente esas fichas.
 *
 * @props isOpen, onClose, cargarTodas (todas las solicitudes), grupos (racimos).
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckSquare, ListChecks, Package, Search, Send, Square, X } from 'lucide-react'
import { getToken } from '../lib/auth'
import { crearPaquete, listarUsuariosChat, type ChatUsuario } from '../lib/chat'
import type { GrupoCluster } from '../lib/servidor'
import type { Solicitud } from '../types/solicitud'

/** Props: visibilidad, cierre, cargador de solicitudes y racimos para agrupar. */
interface ModalEnviarFichasProps {
  /** Si el modal está visible. */
  isOpen: boolean
  /** Cierra sin enviar. */
  onClose: () => void
  /** Carga las solicitudes candidatas (respetando filtros de rol). */
  cargarTodas: () => Promise<Solicitud[]>
  /** Racimos de concentración (agrupan visualmente y seleccionan en bloque). */
  grupos?: GrupoCluster[]
}

/** Nombre mostrable de usuario o solicitud. */
function nombreUsuario(u: ChatUsuario): string {
  const n = `${u.nombres ?? ''} ${u.apellidos ?? ''}`.trim()
  return n || u.username
}

export default function ModalEnviarFichas({ isOpen, onClose, cargarTodas, grupos = [] }: ModalEnviarFichasProps) {
  const [todas, setTodas] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(true)
  const [usuarios, setUsuarios] = useState<ChatUsuario[]>([])
  /** IDs marcados para el paquete. */
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set())
  const [qFichas, setQFichas] = useState('')
  const [qUser, setQUser] = useState('')
  /** Destinatario elegido. */
  const [destino, setDestino] = useState<ChatUsuario | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [enviadoId, setEnviadoId] = useState<number | null>(null)

  /** Al abrir: carga solicitudes y directorio en paralelo. */
  useEffect(() => {
    if (!isOpen) return
    let vivo = true
    setCargando(true)
    setError('')
    setEnviadoId(null)
    setSeleccionados(new Set())
    setDestino(null)
    const token = getToken() ?? undefined
    Promise.all([
      cargarTodas().catch(() => [] as Solicitud[]),
      listarUsuariosChat(token).then(
        (r) => r.data ?? [],
        () => [] as ChatUsuario[],
      ),
    ]).then(([sols, users]) => {
      if (!vivo) return
      setTodas(sols)
      setUsuarios(users)
      setCargando(false)
    })
    // Si el padre cierra, se cancela el setState pendiente.
    return () => {
      vivo = false
    }
  }, [isOpen, cargarTodas])

  /** Bloque del checklist: un grupo (cabecera + miembros) o una ficha sola. */
  type Bloque =
    | { tipo: 'grupo'; key: string; calle: string; miembros: Solicitud[] }
    | { tipo: 'sola'; s: Solicitud }

  /** Grupos primero (cabecera arriba + miembros indentados), solas después. */
  const bloques: Bloque[] = useMemo(() => {
    const q = qFichas.trim().toLowerCase()
    const coincide = (s: Solicitud) =>
      !q ||
      [s.folio_unico, s.tipo_solicitud, s.nombre_solicitante, s.calle, s.colonia]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    // id -> miembros del racimo PRESENTES en la lista (solo racimos de 2+)
    const enGrupo = new Map<number, Solicitud[]>()
    for (const g of grupos) {
      const presentes = g.miembros
        .map((m) => todas.find((s) => s.id_solicitud === m.id_solicitud))
        .filter((s): s is Solicitud => s != null)
        .sort((a, b) => (a.folio_unico || '').localeCompare(b.folio_unico || ''))
      if (presentes.length >= 2) {
        for (const s of presentes) {
          if (s.id_solicitud != null) enGrupo.set(s.id_solicitud, presentes)
        }
      }
    }
    const vistos = new Set<number>()
    const gr: Bloque[] = []
    for (const s of todas) {
      if (s.id_solicitud == null || vistos.has(s.id_solicitud)) continue
      const fam = enGrupo.get(s.id_solicitud)
      if (fam) {
        fam.forEach((m) => { if (m.id_solicitud != null) vistos.add(m.id_solicitud) })
        const vis = fam.filter(coincide)
        if (vis.length > 0) {
          gr.push({
            tipo: 'grupo',
            key: vis.map((m) => m.id_solicitud).join('-'),
            calle: fam[0].calle || '',
            miembros: vis,
          })
        }
      }
    }
    const solas: Bloque[] = todas
      .filter((s) => (s.id_solicitud == null || !enGrupo.has(s.id_solicitud)) && coincide(s))
      .map((s) => ({ tipo: 'sola' as const, s }))
    return [...gr, ...solas]
  }, [todas, qFichas, grupos])

  const qu = qUser.trim().toLowerCase()
  const usuariosFiltrados = usuarios.filter(
    (u) => !qu || nombreUsuario(u).toLowerCase().includes(qu) || u.username.toLowerCase().includes(qu),
  )

  /** Alterna un bloque completo: si todas están, quita todas; si no, pone todas. */
  const alternarGrupo = (miembros: Solicitud[]) => {
    const ids = miembros.map((m) => m.id_solicitud).filter((x): x is number => x != null)
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (ids.every((x) => next.has(x))) ids.forEach((x) => next.delete(x))
      else ids.forEach((x) => next.add(x))
      return next
    })
  }

  /** Alterna una ficha; si está en grupo arrastra a todas sus compañeras. */
  const alternar = (id: number) => {
    for (const b of bloques) {
      if (b.tipo === 'grupo' && b.miembros.some((m) => m.id_solicitud === id)) {
        alternarGrupo(b.miembros)
        return
      }
    }
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const ids = [...seleccionados]

  /** Envía el paquete al destinatario elegido. */
  const enviar = async () => {
    if (!destino || ids.length === 0 || enviando) return
    setEnviando(true)
    setError('')
    try {
      const r = await crearPaquete(destino.id, ids, getToken() ?? undefined)
      setEnviadoId(r.data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^API error \d+: /, '') : 'No se pudo enviar')
    } finally {
      setEnviando(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[10003] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header guinda */}
        <div className="flex shrink-0 items-center gap-3 bg-guinda px-6 py-4">
          <Package className="h-5 w-5 text-white" />
          <div className="flex flex-col">
            <h2 className="text-sm font-bold tracking-wide text-white">Enviar fichas</h2>
            <span className="text-xs text-white/80">Paquete visible solo para el destinatario</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-xl p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {enviadoId != null ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <CheckSquare className="h-7 w-7 text-green-700" />
            </span>
            <p className="text-sm font-bold text-gray-institutional">
              Paquete #{enviadoId} enviado a {destino ? nombreUsuario(destino) : ''} ({ids.length})
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-guinda px-5 py-2.5 text-sm font-semibold text-white shadow-button hover:bg-guinda/90"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
              {/* Checklist de fichas */}
              <div className="flex min-h-0 min-w-0 flex-col">
                <div className="mb-2 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-guinda" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-institutional/60">
                    Fichas ({ids.length}/{todas.length})
                  </span>
                  <span className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => setSeleccionados(new Set(todas.map((s) => s.id_solicitud!)))}
                      className="rounded-lg px-2 py-1 text-[11px] font-medium text-guinda hover:bg-guinda/5"
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeleccionados(new Set())}
                      className="rounded-lg px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100"
                    >
                      Ninguna
                    </button>
                  </span>
                </div>
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5">
                  <Search className="h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={qFichas}
                    onChange={(e) => setQFichas(e.target.value)}
                    placeholder="Buscar folio, tipo, calle..."
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400"
                  />
                </div>
                <div className="max-h-72 min-h-0 flex-1 overflow-y-auto rounded-xl border border-gray-100 p-1.5">
                  {cargando ? (
                    <p className="px-2 py-3 text-xs text-gray-400">Cargando fichas…</p>
                  ) : (
                    bloques.map((b) => {
                      if (b.tipo === 'sola') {
                        const s = b.s
                        return (
                          <label
                            key={s.id_solicitud}
                            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-guinda/5"
                          >
                            <input
                              type="checkbox"
                              checked={seleccionados.has(s.id_solicitud!)}
                              onChange={() => alternar(s.id_solicitud!)}
                              className="h-4 w-4 shrink-0 accent-[#7D2447]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-mono text-xs font-bold text-guinda">
                                {s.folio_unico}
                              </span>
                              <span className="block truncate text-xs text-gray-institutional/70">
                                {s.tipo_solicitud} · {s.calle || 'Sin calle'}
                              </span>
                            </span>
                          </label>
                        )
                      }
                      const marcadas = b.miembros.filter((m) => seleccionados.has(m.id_solicitud!)).length
                      const todasDentro = marcadas === b.miembros.length
                      return (
                        <div key={b.key} className="mb-1 overflow-hidden rounded-lg border border-guinda/25 bg-guinda/[0.03]">
                          {/* Cabecera del grupo: una arriba, marca/desmarca a todas */}
                          <label className="flex cursor-pointer items-center gap-2.5 px-2.5 py-2 transition-colors hover:bg-guinda/5">
                            <input
                              type="checkbox"
                              checked={todasDentro}
                              ref={(el) => { if (el) el.indeterminate = marcadas > 0 && !todasDentro }}
                              onChange={() => alternarGrupo(b.miembros)}
                              className="h-4 w-4 shrink-0 accent-[#7D2447]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-bold text-guinda">
                                Grupo ×{b.miembros.length}{b.calle ? ` · ${b.calle}` : ''}
                              </span>
                              <span className="block truncate text-[11px] text-gray-institutional/60">
                                {marcadas}/{b.miembros.length} elegidas · elegir 1 elige a todas
                              </span>
                            </span>
                          </label>
                          {/* Miembros indentados abajo (tab) */}
                          <div className="ml-5 border-l-2 border-guinda/20 pl-1 pb-1">
                            {b.miembros.map((s) => (
                              <label
                                key={s.id_solicitud}
                                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-guinda/5"
                              >
                                <input
                                  type="checkbox"
                                  checked={seleccionados.has(s.id_solicitud!)}
                                  onChange={() => alternar(s.id_solicitud!)}
                                  className="h-4 w-4 shrink-0 accent-[#7D2447]"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-mono text-xs font-bold text-guinda">
                                    {s.folio_unico}
                                  </span>
                                  <span className="block truncate text-xs text-gray-institutional/70">
                                    {s.tipo_solicitud} · {s.calle || 'Sin calle'}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  )}
                  {!cargando && bloques.length === 0 && (
                    <p className="px-2 py-3 text-xs text-gray-400">Sin resultados</p>
                  )}
                </div>
              </div>

              {/* Destinatario + vista previa */}
              <div className="flex min-h-0 min-w-0 flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-institutional/60">
                  Para quién
                </span>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5">
                  <Search className="h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={qUser}
                    onChange={(e) => setQUser(e.target.value)}
                    placeholder="Buscar persona..."
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-100 p-1.5">
                  {usuariosFiltrados.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setDestino(u)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        destino?.id === u.id ? 'bg-guinda/10' : 'hover:bg-guinda/5'
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-guinda/10 text-xs font-bold text-guinda">
                        {(nombreUsuario(u)[0] ?? '?').toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-gray-institutional">
                          {nombreUsuario(u)}
                        </span>
                        <span className="block truncate text-[11px] text-gray-institutional/50">
                          {u.username} · {u.rol}
                        </span>
                      </span>
                      {destino?.id === u.id && <Square className="h-4 w-4 fill-guinda text-guinda" />}
                    </button>
                  ))}
                  {usuariosFiltrados.length === 0 && (
                    <p className="px-2 py-3 text-xs text-gray-400">Sin personas</p>
                  )}
                </div>
                <div className="rounded-xl bg-alabaster/40 p-3 text-xs text-gray-institutional/70">
                  {destino ? (
                    <>
                      Para <strong className="text-gray-institutional">{nombreUsuario(destino)}</strong> van{' '}
                      <strong className="text-gray-institutional">{ids.length}</strong> ficha(s). Verá
                      únicamente esas fichas en su pestaña Paquetes.
                    </>
                  ) : (
                    'Elige destinatario y marca las fichas del paquete.'
                  )}
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-alabaster-dark/30 bg-alabaster/30 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={enviando}
                className="rounded-xl border-2 border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-30"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={enviando || !destino || ids.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-guinda px-5 py-2.5 text-sm font-semibold text-white shadow-button hover:bg-guinda/90 disabled:opacity-50"
              >
                {enviando ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {enviando ? 'Enviando…' : `Enviar paquete (${ids.length})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
