/**
 * @file Input.tsx
 * @description Par de componentes de formulario: `Input` (input de una línea) y
 * `Textarea` (área de texto multilínea). Ambos comparten el mismo sistema visual
 * — label asociado, clases de campo unificadas, estados de focus/error y
 * generación automática de `id` a partir del `label` si no se proporciona uno.
 * Incluyen soporte de accesibilidad (`aria-invalid`, `aria-label`) y mensaje
 * de error opcional bajo el campo.
 *
 * @props InputProps / TextareaProps
 * @prop {string} label - Etiqueta visible y usada para generar el `id` si no se da uno.
 * @prop {string} [error] - Mensaje de error; si existe activa `aria-invalid` y muestra texto rojo.
 * @prop {string} [id] - Id explícito; si se omite se deriva del label (lowercase + guiones).
 *
 * @uso
 * ```tsx
 * <Input label="Nombre completo" placeholder="Juan Pérez" error={errors.nombre} />
 * <Textarea label="Descripción" rows={4} />
 * ```
 */
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

/** Props para el componente Input (input nativo de una línea). */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Etiqueta visible del campo; también genera el id si no se provee uno. */
  label: string
  /** Mensaje de error a mostrar debajo del campo. */
  error?: string
}

/** Props para el componente Textarea (área multilínea). */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Etiqueta visible del campo. */
  label: string
  /** Mensaje de error a mostrar debajo del campo. */
  error?: string
}

/**
 * Clases Tailwind compartidas para ambos campos.
 * Incluye borde, fondo, padding, transiciones, estados de focus (anillo guinda)
 * y estado de error vía `aria-[invalid=true]`.
 */
const fieldClasses =
  'w-full rounded-xl border-2 border-alabaster-dark bg-white px-4 py-3 text-gray-institutional placeholder:text-gray-institutional/40 transition-all duration-200 focus:border-guinda focus:shadow-[0_0_0_3px_rgba(125,36,71,0.1)] focus:outline-none aria-[invalid=true]:border-red-400 aria-[invalid=true]:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]'

/**
 * Campo de entrada de una sola línea con label y mensaje de error.
 * Genera un `id` automático a partir del label para vincular `<label htmlFor>`.
 */
export function Input({ label, error, id, className, ...props }: InputProps) {
  // Id del input: usa el id explícito o lo deriva del label (ej: "Nombre Completo" -> "nombre-completo")
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {/* Etiqueta asociada al input vía htmlFor */}
      <label htmlFor={inputId} className="text-sm font-medium text-gray-institutional">
        {label}
      </label>
      {/* Input nativo con clases compartidas + clases extra opcionales; aria-invalid refleja error */}
      <input id={inputId} className={[fieldClasses, className].filter(Boolean).join(' ')} aria-invalid={!!error} aria-label={label} {...props} />
      {/* Mensaje de error condicional */}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

/**
 * Área de texto multilínea con el mismo sistema visual que Input.
 * Añade altura mínima y capacidad de redimensionar verticalmente.
 */
export function Textarea({ label, error, id, ...props }: TextareaProps) {
  // Id derivado igual que en Input para consistencia
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {/* Etiqueta asociada al textarea */}
      <label htmlFor={inputId} className="text-sm font-medium text-gray-institutional">
        {label}
      </label>
      <textarea
        id={inputId}
        // Reutiliza fieldClasses y añade altura mínima + resize vertical
        className={`${fieldClasses} min-h-[100px] resize-y`}
        aria-invalid={!!error}
        aria-label={label}
        {...props} // Spread de props nativas (rows, placeholder, value, onChange, etc.)
      />
      {/* Mensaje de error condicional */}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
