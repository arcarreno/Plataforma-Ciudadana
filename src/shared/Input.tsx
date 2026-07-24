import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

const fieldClasses =
  'w-full rounded-xl border-2 border-alabaster-dark bg-white px-4 py-3 text-gray-institutional placeholder:text-gray-institutional/40 transition-all duration-200 focus:border-guinda focus:shadow-[0_0_0_3px_rgba(125,36,71,0.1)] focus:outline-none aria-[invalid=true]:border-red-400 aria-[invalid=true]:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]'

export function Input({ label, error, id, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-institutional">
        {label}
      </label>
      <input id={inputId} className={fieldClasses} aria-invalid={!!error} aria-label={label} {...props} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, id, ...props }: TextareaProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-institutional">
        {label}
      </label>
      <textarea
        id={inputId}
        className={`${fieldClasses} min-h-[100px] resize-y`}
        aria-invalid={!!error}
        aria-label={label}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
