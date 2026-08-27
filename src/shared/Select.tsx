/**
 * @file Select.tsx
 * @description Componente Select (desplegable nativo) del Design System.
 * Envuelve un `<select>` HTML con label, placeholder como primera opción vacía,
 * lista de opciones tipada como `readonly string[]` y mensaje de error opcional.
 * Mantiene el mismo lenguaje visual que `Input`/`Textarea` (borde, focus guinda).
 * Genera `id` automático desde el label si no se proporciona.
 *
 * @props SelectProps
 * @prop {string} label - Etiqueta visible y base para el id automático.
 * @prop {readonly string[]} options - Array de opciones a renderizar como `<option>`.
 * @prop {string} [placeholder='Seleccionar'] - Texto de la opción vacía inicial.
 * @prop {string} [error] - Mensaje de error mostrado bajo el select.
 * @prop {string} [id] - Id explícito; si se omite se deriva del label.
 * Extiende todos los atributos nativos de `<select>` (value, onChange, disabled, etc.).
 *
 * @uso
 * ```tsx
 * <Select label="Municipio" options={municipios} value={val} onChange={e => setVal(e.target.value)} />
 * ```
 */
import type { SelectHTMLAttributes } from 'react'

/** Props del componente Select; extiende atributos nativos de `<select>`. */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Etiqueta visible del campo. */
  label: string
  /** Lista de opciones; cada string es value y texto visible. */
  options: readonly string[]
  /** Texto de la opción placeholder (value=""). Por defecto "Seleccionar". */
  placeholder?: string
  /** Mensaje de error opcional. */
  error?: string
}

/**
 * Select nativo estilizado con label, placeholder y manejo de error.
 */
export default function Select({
  label, // Etiqueta del campo
  options, // Opciones a renderizar
  placeholder = 'Seleccionar', // Texto placeholder por defecto
  error, // Mensaje de error opcional
  id, // Id explícito opcional
  ...props // Resto de props nativas (value, onChange, required, disabled, etc.)
}: SelectProps) {
  // Genera id automático desde el label si no se proporciona uno explícito
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {/* Label asociado al select */}
      <label htmlFor={selectId} className="text-sm font-medium text-gray-institutional">
        {label}
      </label>
      <select
        id={selectId}
        // Estilos consistentes con Input: borde, transición, focus guinda, borde rojo si aria-invalid
        className="w-full rounded-xl border-2 border-alabaster-dark bg-white px-4 py-3 text-gray-institutional transition-all duration-200 focus:border-guinda focus:shadow-[0_0_0_3px_rgba(125,36,71,0.1)] focus:outline-none aria-[invalid=true]:border-red-400"
        aria-label={label}
        {...props} // Spread de atributos nativos del select
      >
        {/* Opción placeholder con value vacío — permite detectar "sin selección" */}
        <option value="" className="text-gray-institutional/40">{placeholder}</option>
        {/* Renderiza cada opción del array; key y value son el propio string */}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {/* Mensaje de error condicional bajo el campo */}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
