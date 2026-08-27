/**
 * @file Card.tsx
 * @description Contenedor tipo tarjeta (Card) del Design System.
 * Renderiza un `<section>` con borde, fondo blanco, sombra `shadow-card` y
 * padding uniforme. Opcionalmente muestra un título y efecto hover elevado.
 * Se usa como envoltorio para agrupar contenido relacionado (formularios,
 * estadísticas, paneles, etc.).
 *
 * @props CardProps
 * @prop {string} [title] - Título opcional renderizado como `<h2>` guinda.
 * @prop {ReactNode} children - Contenido interno de la tarjeta.
 * @prop {string} [className] - Clases adicionales para personalizar la tarjeta.
 * @prop {boolean} [hover=false] - Si es `true` añade sombra y traslación al hover.
 *
 * @uso
 * ```tsx
 * <Card title="Nueva Solicitud" hover>
 *   <p>Contenido de la tarjeta</p>
 * </Card>
 * ```
 */
import type { ReactNode } from 'react'

/** Props del componente Card. */
interface CardProps {
  /** Título opcional que se muestra en la cabecera de la tarjeta. */
  title?: string
  /** Contenido interno de la tarjeta. */
  children: ReactNode
  /** Clases Tailwind adicionales para el contenedor. */
  className?: string
  /** Activa efecto hover (sombra más intensa y leve elevación). */
  hover?: boolean
}

/**
 * Componente Card — sección con estilo de tarjeta institucional.
 * Usa `<section>` semántico y aplica estilos de borde, sombra y transición.
 */
export default function Card({ title, children, className = '', hover = false }: CardProps) {
  return (
    <section
      // Estilos base: borde suave, fondo blanco, sombra y padding; hover condicional
      className={`rounded-2xl border border-alabaster-dark/60 bg-white p-6 shadow-card transition-all duration-200 ${
        hover ? 'hover:shadow-card-hover hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      {/* Título opcional — solo se renderiza si se proporciona la prop `title` */}
      {title && (
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-guinda">
          {title}
        </h2>
      )}
      {/* Slot principal del contenido hijo */}
      {children}
    </section>
  )
}
