import { useEffect, useState } from 'react'

export function useFitScale(
  containerRef: React.RefObject<HTMLElement | null>,
  docW: number,
): number {
  const [s, setS] = useState(1)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const avail = el.clientWidth - 16
      setS(prev => {
        const next = avail > 0 ? Math.min(1, avail / docW) : 1
        return Math.abs(prev - next) > 0.001 ? next : prev
      })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, docW])
  return s
}

export function useElementHeight(ref: React.RefObject<HTMLElement | null>): number | null {
  const [h, setH] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setH(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return h
}
