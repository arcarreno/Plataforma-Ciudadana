import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: readonly string[]
  placeholder?: string
  error?: string
}

export default function Select({
  label,
  options,
  placeholder = 'Seleccionar',
  error,
  id,
  ...props
}: SelectProps) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-gray-institutional">
        {label}
      </label>
      <select
        id={selectId}
        className="w-full rounded-xl border-2 border-alabaster-dark bg-white px-4 py-3 text-gray-institutional transition-all duration-200 focus:border-guinda focus:shadow-[0_0_0_3px_rgba(125,36,71,0.1)] focus:outline-none aria-[invalid=true]:border-red-400"
        aria-label={label}
        {...props}
      >
        <option value="" className="text-gray-institutional/40">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
