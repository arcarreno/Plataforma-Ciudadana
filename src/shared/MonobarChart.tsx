import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'

export interface BarDatum {
  name: string
  value: number
}

interface MonobarChartProps {
  data: BarDatum[]
  subtitle: string
  top?: number
  getColor?: (item: BarDatum, index: number) => string
  footer?: React.ReactNode
}

const DEFAULT_COLORS = ['#7d2447', '#a3325f', '#c44d78', '#41504D', '#DBC6B3', '#636569', '#5c1a34', '#2d8f6f', '#e07b39', '#3b82f6']

const BAR_AREA = 200

export default function MonobarChart({ data, subtitle, top = 5, getColor, footer }: MonobarChartProps) {
  const [expanded, setExpanded] = useState(false)
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const visible = expanded ? sorted : sorted.slice(0, top)
  const max = Math.max(...sorted.map(d => d.value), 1)
  const hasMore = sorted.length > top

  return (
    <div>
      <p className="mb-4 text-xs text-gray-institutional/40">{subtitle}</p>
      <div
        className="cursor-pointer"
        onClick={() => hasMore && setExpanded(e => !e)}
        title={hasMore ? (expanded ? 'Ver solo los 5 más solicitados' : 'Clic para ver todos los datos') : undefined}
        role={hasMore ? 'button' : undefined}
        aria-expanded={expanded}
      >
        <div className="flex h-[232px] items-end gap-2">
          <AnimatePresence initial={false}>
            {visible.map((d, i) => (
              <motion.div
                key={d.name}
                className="flex min-w-0 flex-1 flex-col items-center justify-end self-stretch"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="mb-1 text-[11px] font-bold text-gray-institutional/70">{d.value}</span>
                <motion.div
                  className="w-full rounded-t-lg"
                  style={{ background: getColor ? getColor(d, i) : DEFAULT_COLORS[i % DEFAULT_COLORS.length] }}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max((d.value / max) * BAR_AREA, 4)}px` }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
                />
                <span className="mt-2 w-full truncate text-center text-[10px] text-gray-institutional/60" title={d.name}>
                  {d.name}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

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

      {footer}
    </div>
  )
}