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
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Layers, Send } from 'lucide-react'
import VistaFichaEditable, { bannerPorPeso } from './VistaFichaEditable'
import type { Solicitud } from '../types/solicitud'
import type { GrupoCluster } from '../lib/servidor'

/** Props: página actual, racimos y callbacks. */
interface PanelVistaFichasProps {
  /** Solicitudes de la página actual (o las del paquete). */
  solicitudes: Solicitud[]
  /** Racimos de concentración (para colapsar igual que en tarjetas). */
  grupos: GrupoCluster[]
  /** Abre el detalle completo (ausente = vista de paquete, solo previsualiza). */
  onAbrir?: (s: Solicitud) => void
  /** Oculta el botón de detalle (vista de paquete). */
  ocultarDetalle?: boolean
  /** Abre el modal de envío de fichas como paquete. */
  onEnviarFichas?: () => void
  /** Título a la izquierda del contador (ej. leyenda del paquete). */
  titulo?: ReactNode
  /** Checklist de respuesta: checkbox por ST + toggle (ausente = sin checklist). */
  seleccionRespuesta?: { seleccionados: Set<number>; onToggle: (id: number) => void } | null
  /** Veredictos de una respuesta enviada: ids aceptados (los demás = rechazados). */
  aceptadas?: number[] | null
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
function PanelVistaFichas({ solicitudes, grupos, onAbrir, ocultarDetalle, onEnviarFichas, titulo, seleccionRespuesta, aceptadas }: PanelVistaFichasProps) {
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
  /** Altura real de la ficha para topar el sidebar (sin espacios sobrantes ni desbordes). */
  const fichaRef = useRef<HTMLDivElement>(null)
  /** Contenedor del sidebar: el auto-scroll se queda dentro (nunca mueve la página). */
  const listaRef = useRef<HTMLDivElement>(null)
  const [altoFicha, setAltoFicha] = useState<number | null>(null)
  useEffect(() => {
    const el = fichaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setAltoFicha(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [actual?.id_solicitud])
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
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Sidebar de ST: misma altura que la ficha, con scroll interno solo si hace falta */}
      <div
        ref={listaRef}
        className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:w-72 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0 lg:pr-1"
        style={altoFicha ? { maxHeight: altoFicha } : undefined}
        role="listbox"
        aria-label="Peticiones de la página"
      >
        {visibles.map(s => {
          const activa = actual?.id_solicitud === s.id_solicitud
          const idNum = s.id_solicitud ?? -1
          const conCheck = seleccionRespuesta != null && s.id_solicitud != null
          const veredicto = aceptadas != null && s.id_solicitud != null
            ? (aceptadas.includes(s.id_solicitud) ? 'si' : 'no')
            : null
          return (
            <button
              key={s.id_solicitud}
              type="button"
              role="option"
              aria-selected={activa}
              ref={activa ? (el) => {
                const cont = listaRef.current
                if (el && cont && cont.scrollHeight > cont.clientHeight) {
                  cont.scrollTo({
                    top: Math.max(0, el.offsetTop - cont.clientHeight / 2 + el.clientHeight / 2),
                    behavior: 'smooth',
                  })
                }
              } : undefined}
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
              {conCheck && (
                <input
                  type="checkbox"
                  checked={seleccionRespuesta.seleccionados.has(idNum)}
                  onChange={(e) => { e.stopPropagation(); seleccionRespuesta.onToggle(idNum) }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Aceptar ${s.folio_unico}`}
                  className="h-4 w-4 shrink-0 accent-[#7D2447]"
                />
              )}
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-mono text-xs font-bold tracking-wide ${activa ? 'text-white' : 'text-guinda'}`}>
                  {s.folio_unico}
                </span>
                <span className={`block truncate text-[11px] ${activa ? 'text-white/80' : 'text-gray-institutional/60'}`}>
                  {s.tipo_solicitud}
                </span>
              </span>
              {veredicto && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  veredicto === 'si' ? 'bg-green-700 text-white' : 'bg-red-100 text-red-700'
                }`}>
                  {veredicto === 'si' ? '✓ Sí' : '✗ No'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Ficha grande con banner por prioridad + navegación */}
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {titulo}
            <p className="text-xs text-gray-institutional/60">
              Ficha {idx + 1} de {visibles.length}
            {totalGrupo > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-guinda px-2 py-0.5 text-[10px] font-bold text-white">
                <Layers className="h-3 w-3" />
                Grupo ×{totalGrupo}
              </span>
            )}
          </p>
          </div>
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
            {onEnviarFichas && (
              <button
                type="button"
                onClick={onEnviarFichas}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-guinda px-4 py-2 text-sm font-medium text-guinda transition-all hover:bg-guinda/5 active:scale-[0.97]"
              >
                <Send className="h-4 w-4" />
                Enviar fichas
              </button>
            )}
            {!ocultarDetalle && (
            <button
              type="button"
              onClick={() => actual && onAbrir?.(actual)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-guinda px-4 py-2 text-sm font-medium text-white shadow-button transition-all hover:brightness-110 active:scale-[0.97]"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir detalle
            </button>
            )}
          </div>
        </div>
        {actual && (
          <div ref={fichaRef} className="w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
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
