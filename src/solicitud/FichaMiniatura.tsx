/**
 * @file FichaMiniatura.tsx
 * @description Miniatura de solo lectura de la ficha técnica para la vista de
 * fichas del panel (todos los perfiles). Reutiliza VistaFichaEditable con el
 * banner forzado por prioridad y auto-escala interna al ancho de la celda.
 * Clic (o Enter/Espacio) abre el detalle completo.
 *
 * @props solicitud - Petición a mostrar; onAbrir - abre el detalle.
 */
import { memo } from 'react'
import VistaFichaEditable, { bannerPorPeso } from './VistaFichaEditable'
import type { Solicitud } from '../types/solicitud'

/** Props: solicitud a mostrar y callback para abrir el detalle. */
interface FichaMiniaturaProps {
  /** Petición cuya ficha se previsualiza. */
  solicitud: Solicitud
  /** Abre el detalle completo de la petición. */
  onAbrir: () => void
}

/**
 * Tarjeta-ficha no interactiva (los clics los recibe el contenedor).
 */
function FichaMiniatura({ solicitud, onAbrir }: FichaMiniaturaProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAbrir() }}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{ height: 360 }}
    >
      <div className="pointer-events-none h-full w-full overflow-hidden">
        <VistaFichaEditable
          solicitud={solicitud}
          bannerForzado={bannerPorPeso(solicitud.peso_ranking)}
          soloLectura
        />
      </div>
    </div>
  )
}

export default memo(FichaMiniatura)
