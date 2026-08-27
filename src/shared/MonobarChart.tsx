/**
 * @file MonobarChart.tsx
 * @description Gráfico de barras verticales simple con animación y modo expandido.
 * Recibe un array de `{name, value}` y renderiza barras ordenadas descendentemente
 * por valor. Características:
 *  - **Orden y truncado:** ordena de mayor a menor, muestra solo `top` (default 5)
 *    barras inicialmente; botón "Ver todos" expande al total con `AnimatePresence`.
 *  - **Escalado:** altura de barra proporcional a `value / max * BAR_AREA` (200px),
 *    con mínimo de 4px para que valores pequeños sean visibles.
 *  - **Animación:** usa `framer-motion` para fade de barras y crecimiento de altura
 *    con easing `spring-like` `[0.22, 1, 0.36, 1]` y stagger por índice.
 *  - **Colores:** paleta `DEFAULT_COLORS` cíclica o función custom `getColor`.
 *  - **Interacción:** el área del gráfico también es clickeable para toggle si `hasMore`.
 *  - **Footer:** slot opcional para contenido adicional bajo el gráfico.
 *
 * @props MonobarChartProps
 * @prop {BarDatum[]} data - Datos crudos sin ordenar; el componente los clona y ordena.
 * @prop {string} subtitle - Texto descriptivo pequeño sobre el gráfico.
 * @prop {number} [top=5] - Cuántas barras mostrar en modo colapsado.
 * @prop {(item: BarDatum, index: number) => string} [getColor] - Función para color por barra.
 * @prop {React.ReactNode} [footer] - Nodo opcional renderizado al final.
 *
 * @tipo BarDatum { name: string; value: number }
 *
 * @uso
 * ```tsx
 * <MonobarChart data={porMunicipio} subtitle="Solicitudes por municipio" />
 * ```
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'

/** Dato de una barra: etiqueta y valor numérico. */
export interface BarDatum {
  /** Etiqueta de la barra (ej. nombre de municipio o tipo de obra). */
  name: string
  /** Valor numérico (altura de la barra). */
  value: number
}

/** Props del gráfico de barras. */
interface MonobarChartProps {
  /** Array de datos; se ordena internamente de mayor a menor. */
  data: BarDatum[]
  /** Subtítulo descriptivo mostrado sobre el gráfico. */
  subtitle: string
  /** Número de barras visibles en modo colapsado. Por defecto 5. */
  top?: number
  /** Función opcional para determinar color de cada barra. */
  getColor?: (item: BarDatum, index: number) => string
  /** Contenido adicional opcional bajo el gráfico/botón. */
  footer?: React.ReactNode
}

/** Paleta de colores por defecto — se cicla con `i % length` si no hay getColor. */
const DEFAULT_COLORS = ['#7d2447', '#a3325f', '#c44d78', '#41504D', '#DBC6B3', '#636569', '#5c1a34', '#2d8f6f', '#e07b39', '#3b82f6']

/** Altura máxima en píxeles del área de barras (para escalado proporcional). */
const BAR_AREA = 200

/**
 * Gráfico de barras verticales con animación, modo expandido/colapsado y colores configurables.
 */
export default function MonobarChart({ data, subtitle, top = 5, getColor, footer }: MonobarChartProps) {
  /** Si el gráfico está expandido mostrando todos los datos. */
  const [expanded, setExpanded] = useState(false)
  /** Copia ordenada descendentemente por valor (no muta el prop original). */
  const sorted = [...data].sort((a, b) => b.value - a.value)
  /** Subconjunto visible: todo si expanded, o los primeros `top` si colapsado. */
  const visible = expanded ? sorted : sorted.slice(0, top)
  /** Valor máximo para cálculo de altura relativa; mínimo 1 para evitar división por cero. */
  const max = Math.max(...sorted.map(d => d.value), 1)
  /** Si hay más datos que `top` — determina si mostrar botón de expandir. */
  const hasMore = sorted.length > top

  return (
    <div>
      {/* Subtítulo descriptivo */}
      <p className="mb-4 text-xs text-gray-institutional/40">{subtitle}</p>
      {/* Área clickeable del gráfico — toggle de expandido si hay más datos */}
      <div
        className="cursor-pointer"
        onClick={() => hasMore && setExpanded(e => !e)}
        title={hasMore ? (expanded ? 'Ver solo los 5 más solicitados' : 'Clic para ver todos los datos') : undefined}
        role={hasMore ? 'button' : undefined}
        aria-expanded={expanded}
      >
        {/* Contenedor de barras — altura fija 232px, alineadas abajo */}
        <div className="flex h-[232px] items-end gap-2">
          <AnimatePresence initial={false}>
            {visible.map((d, i) => (
              <motion.div
                key={d.name} // Key por nombre para animación de entrada/salida correcta
                className="flex min-w-0 flex-1 flex-col items-center justify-end self-stretch"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Valor numérico sobre la barra */}
                <span className="mb-1 text-[11px] font-bold text-gray-institutional/70">{d.value}</span>
                {/* Barra vertical — altura animada proporcional al máximo, color de paleta o custom */}
                <motion.div
                  className="w-full rounded-t-lg"
                  style={{ background: getColor ? getColor(d, i) : DEFAULT_COLORS[i % DEFAULT_COLORS.length] }}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max((d.value / max) * BAR_AREA, 4)}px` }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }} // Stagger por índice
                />
                {/* Etiqueta bajo la barra — truncada con tooltip en title */}
                <span className="mt-2 w-full truncate text-center text-[10px] text-gray-institutional/60" title={d.name}>
                  {d.name}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Botón de expandir/colapsar — solo si hay más datos que top */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-guinda/20 bg-guinda/5 py-2 text-xs font-medium text-guinda transition-colors hover:bg-guinda/10"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Ver solo los 5 más solicitados
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Ver todos ({sorted.length})
            </>
          )}
        </button>
      )}

      {/* Slot opcional para contenido extra (ej. leyenda o resumen) */}
      {footer}
    </div>
  )
}
