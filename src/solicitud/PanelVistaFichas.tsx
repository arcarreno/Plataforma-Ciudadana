/**
 * @file PanelVistaFichas.tsx
 * @description Vista de fichas estilo PowerPoint para el panel: sidebar izquierdo
 * con la lista de ST (folio + tipo + punto de prioridad, activo resaltado) y
 * área principal con UNA ficha grande (banner forzado por prioridad). En una
 * sola ficha visible hay un único mapa con tiles (sin saturar OSM) y el grupo
 * colapsa igual que en tarjetas (pinta la de menor folio).
 *
 * @props solicitudes - Página actual; grupos - racimos; onAbrir - abre el detalle.
 */
import { memo, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Layers } from 'lucide-react'
import VistaFichaEditable, { bannerPorPeso } from './VistaFichaEditable'
import type { Solicitud } from '../types/solicitud'
import type { GrupoCluster } from '../lib/servidor'

/** Props: página actual, racimos y callback para abrir el detalle. */
interface PanelVistaFichasProps {
  /** Solicitudes de la página actual. */
  solicitudes: Solicitud[]
  /** Racimos de concentración (para colapsar igual que en tarjetas). */
  grupos: GrupoCluster[]
  /** Abre el detalle completo de la petición. */
  onAbrir: (s: Solicitud) => void
}

/** Color del punto de prioridad (misma escala que banners y pines). */
function colorPunto(peso?: number | null): string {
  if (peso != null && peso >= 15) return '#7D2447'
  if (peso === 12) return '#DBC6B3'
  if (peso === 10) return '#41504D'
  return '#FFFFFF'
}

/**
 * Panel estilo PowerPoint: sidebar de ST + ficha grande con banner por prioridad.
 * Memoizado: solo re-renderiza si cambian página, grupos o el callback.
 */
function PanelVistaFichas({ solicitudes, grupos, onAbrir }: PanelVistaFichasProps) {
  /** Mapa id -> racimo para el colapso. */
  const grupoDe = useMemo(() => {
    const m = new Map<number, GrupoCluster>()
    grupos.forEach(g => g.miembros.forEach(x => m.set(x.id_solicitud, g)))
    return m
  }, [grupos])

  /** Representantes (misma regla que tarjetas: menor folio presente del racimo). */
  const visibles = useMemo(() => solicitudes.filter(s => {
    const grupo = s.id_solicitud != null ? grupoDe.get(s.id_solicitud) : undefined
    const presentes = grupo
      ? grupo.miembros.filter(x => solicitudes.some(r => r.id_solicitud === x.id_solicitud))
      : []
    if (grupo && presentes.length >= 2) {
      const rep = [...presentes].sort((a, b) => (a.folio_unico || '').localeCompare(b.folio_unico || ''))[0]
      if (s.id_solicitud !== rep.id_solicitud) return false
    }
    return true
  }), [solicitudes, grupoDe])

  /** ST seleccionada (por defecto la primera; si sale de la lista, vuelve a la primera). */
  const [selId, setSelId] = useState<number | null>(null)
  const actual = visibles.find(v => v.id_solicitud === selId) ?? visibles[0] ?? null
  const idx = actual ? visibles.findIndex(v => v.id_solicitud === actual.id_solicitud) : -1
  const totalGrupo = (() => {
    if (!actual || actual.id_solicitud == null) return 0
    const g = grupoDe.get(actual.id_solicitud)
    return g && g.miembros.length >= 2 ? g.miembros.length : 0
  })()

  if (visibles.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-institutional/50">Sin solicitudes en esta página</p>
  }

  const ir = (d: number) => {
    if (visibles.length === 0) return
    const next = (idx + d + visibles.length) % visibles.length
    setSelId(visibles[next].id_solicitud ?? null)
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Sidebar de ST: lista scrolleable con activo resaltado */}
      <div
        className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:max-h-[72vh] lg:min-h-[540px] lg:w-72 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0 lg:pr-1"
        role="listbox"
        aria-label="Peticiones de la página"
      >
        {visibles.map(s => {
          const activa = actual?.id_solicitud === s.id_solicitud
          return (
            <button
              key={s.id_solicitud}
              type="button"
              role="option"
              aria-selected={activa}
              ref={activa ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
              onClick={() => setSelId(s.id_solicitud ?? null)}
              className={`flex min-w-[220px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all lg:min-w-0 ${
                activa
                  ? 'border-guinda bg-guinda text-white shadow-button'
                  : 'border-gray-100 bg-white text-gray-institutional hover:border-guinda/30 hover:bg-guinda/5'
              }`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: colorPunto(s.peso_ranking) }}
              />
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-mono text-xs font-bold tracking-wide ${activa ? 'text-white' : 'text-guinda'}`}>
                  {s.folio_unico}
                </span>
                <span className={`block truncate text-[11px] ${activa ? 'text-white/80' : 'text-gray-institutional/60'}`}>
                  {s.tipo_solicitud}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Ficha grande con banner por prioridad + navegación */}
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-institutional/60">
            Ficha {idx + 1} de {visibles.length}
            {totalGrupo > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-guinda px-2 py-0.5 text-[10px] font-bold text-white">
                <Layers className="h-3 w-3" />
                Grupo ×{totalGrupo}
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => ir(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-institutional/60 transition-colors hover:bg-gray-100 hover:text-guinda"
              aria-label="Ficha anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => ir(1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-institutional/60 transition-colors hover:bg-gray-100 hover:text-guinda"
              aria-label="Ficha siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => actual && onAbrir(actual)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-guinda px-4 py-2 text-sm font-medium text-white shadow-button transition-all hover:brightness-110 active:scale-[0.97]"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir detalle
            </button>
          </div>
        </div>
        {actual && (
          <div
            className="w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card"
            style={{ height: '72vh', minHeight: 540, maxHeight: 780 }}
          >
            <VistaFichaEditable
              key={actual.id_solicitud}
              solicitud={actual}
              bannerForzado={bannerPorPeso(actual.peso_ranking)}
              soloLectura
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(PanelVistaFichas)
