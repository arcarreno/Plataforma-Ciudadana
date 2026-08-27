/**
 * @file Button.tsx
 * @description Componente reutilizable de botón del Design System institucional.
 * Encapsula tres variantes visuales (primary/secondary/ghost) y tres tamaños
 * (sm/md/lg) con estilos Tailwind que usan los tokens `guinda`, `gray-institutional`
 * y sombras `shadow-button`. Extiende todos los atributos nativos de `<button>`
 * para mantener compatibilidad con `onClick`, `disabled`, `type`, etc.
 *
 * @props ButtonProps
 * @prop {'primary'|'secondary'|'ghost'} [variant='primary'] - Variante visual. `primary` fondo guinda,
 *        `secondary` borde guinda, `ghost` solo texto.
 * @prop {'sm'|'md'|'lg'} [size='md'] - Tamaño (padding y font-size).
 * @prop {string} [className] - Clases adicionales para overrides puntuales.
 * @prop {ReactNode} children - Contenido del botón (texto/iconos).
 *
 * @uso
 * ```tsx
 * <Button variant="primary" size="md" onClick={handleClick}>Guardar</Button>
 * <Button variant="secondary">Cancelar</Button>
 * ```
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Props del componente Button.
 * Extiende los atributos nativos de un `<button>` HTML.
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Variante visual del botón; controla colores, bordes y sombras. */
  variant?: 'primary' | 'secondary' | 'ghost'
  /** Tamaño del botón; controla padding y tamaño de fuente. */
  size?: 'sm' | 'md' | 'lg'
  /** Contenido interno del botón. */
  children: ReactNode
}

/** Mapa de clases Tailwind por variante visual. */
const variantStyles = {
  // Fondo guinda sólido con sombra y efecto brightness al hover/active
  primary:
    'bg-guinda text-white shadow-button hover:shadow-button-hover hover:brightness-110 active:brightness-90',
  // Borde guinda, texto guinda; al hover se rellena de guinda
  secondary:
    'border-2 border-guinda/30 text-guinda hover:bg-guinda hover:text-white hover:border-guinda hover:shadow-button active:bg-guinda-dark',
  // Solo texto, fondo transparente hasta hover
  ghost:
    'text-gray-institutional hover:bg-guinda/10 hover:text-guinda active:bg-guinda/20',
}

/** Mapa de clases Tailwind por tamaño. */
const sizeStyles = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
}

/**
 * Botón institucional reutilizable.
 * Aplica clases base (flex, rounded, transiciones, active:scale) y concatena
 * las clases de variante, tamaño y `className` externo.
 */
export default function Button({
  variant = 'primary', // Variante por defecto: guinda sólido
  size = 'md', // Tamaño por defecto: mediano
  className = '', // Clases extra opcionales del consumidor
  children, // Contenido del botón
  ...props // Resto de props nativas (onClick, disabled, type, etc.)
}: ButtonProps) {
  return (
    <button
      // Clases base + variante + tamaño + custom; incluye animación de escala al presionar
      className={`inline-flex cursor-pointer items-center justify-center rounded-xl font-medium transition-all duration-200 active:scale-[0.97] ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props} // Spread de atributos nativos del botón
    >
      {children}
    </button>
  )
}
