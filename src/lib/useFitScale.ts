/**
 * @file useFitScale.ts
 * @description
 * Hooks de React para escalado responsivo y medición de altura de elementos.
 * - `useFitScale`: calcula un factor de escala (0..1) para encajar un documento/canvas de ancho fijo
 *   dentro de un contenedor responsivo (ej. vista previa de acuse PDF).
 * - `useElementHeight`: observa y expone `offsetHeight` de un elemento para layouts dinámicos.
 *
 * Dependencias:
 * - `react` → `useEffect`, `useState`.
 * - `ResizeObserver` (API nativa) → detecta cambios de tamaño del contenedor/elemento sin polling.
 *
 * Flujo `useFitScale`:
 * 1. Lee `containerRef.current.clientWidth` y resta 16px de padding/margen.
 * 2. Calcula `next = min(1, avail / docW)` (nunca escala hacia arriba, solo hacia abajo).
 * 3. Solo actualiza estado si el cambio > 0.001 para evitar re-renders por fluctuaciones sub-pixel.
 * 4. Se suscribe con `ResizeObserver` al contenedor y limpia al desmontar.
 *
 * Flujo `useElementHeight`:
 * 1. Lee `offsetHeight` inicial y lo guarda.
 * 2. Observa con `ResizeObserver` y actualiza en cada cambio; limpia al desmontar.
 *
 * Decisiones de diseño:
 * - `avail - 16` deja respiro lateral para no pegar el documento al borde.
 * - `Math.min(1, ...)` evita escalar >1 (pixelación) cuando el contenedor es más grande que el doc.
 * - Umbral `0.001` evita loops de render por redondeos de `clientWidth`.
 * - Dependencias `[containerRef, docW]` / `[ref]`: el ref object es estable, pero se incluye para exhaustive-deps.
 * - `ResizeObserver.disconnect()` en cleanup previene leaks al desmontar el componente.
 */
import { useEffect, useState } from 'react'

/**
 * Hook que calcula un factor de escala para encajar un documento de ancho `docW` dentro del contenedor.
 * @param containerRef - Ref al elemento contenedor (ej. `div` que envuelve el preview).
 * @param docW - Ancho natural del documento en px (ej. ancho de hoja A4 en px: 794).
 * @returns Factor de escala `s` entre 0 y 1 (1 = sin escalar). Usar como `transform: scale(s)`.
 * @example
 * const contRef = useRef<HTMLDivElement>(null)
 * const scale = useFitScale(contRef, 794)
 * // <div ref={contRef}><div style={{ transform: `scale(${scale})` }}>...doc...</div></div>
 */
export function useFitScale(
  containerRef: React.RefObject<HTMLElement | null>,
  docW: number,
): number {
  // Estado del factor de escala; inicia en 1 (sin escalar) hasta la primera medición
  const [s, setS] = useState(1)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return // aún no montado
    // Recalcula `s` a partir del ancho disponible
    const update = () => {
      const avail = el.clientWidth - 16 // 16px de respiro lateral
      setS(prev => {
        const next = avail > 0 ? Math.min(1, avail / docW) : 1
        // Evitar re-renders por cambios insignificantes (<0.1%)
        return Math.abs(prev - next) > 0.001 ? next : prev
      })
    }
    update() // medición inicial
    const ro = new ResizeObserver(update) // re-medir en cada resize del contenedor
    ro.observe(el)
    return () => ro.disconnect() // cleanup al desmontar o cambiar deps
  }, [containerRef, docW])
  return s
}

/**
 * Hook que expone la altura (`offsetHeight`) de un elemento y la mantiene actualizada.
 * @param ref - Ref al elemento a medir.
 * @returns Altura en px o `null` si el elemento aún no está montado.
 * @example
 * const headerRef = useRef<HTMLDivElement>(null)
 * const h = useElementHeight(headerRef) // ej. para calcular `calc(100vh - h)`
 */
export function useElementHeight(ref: React.RefObject<HTMLElement | null>): number | null {
  const [h, setH] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setH(el.offsetHeight) // incluye padding y borde, excluye margin
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return h
}
