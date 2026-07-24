import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  children: ReactNode
  className?: string
  hover?: boolean
}

export default function Card({ title, children, className = '', hover = false }: CardProps) {
  return (
    <section
      className={`rounded-2xl border border-alabaster-dark/60 bg-white p-6 shadow-card transition-all duration-200 ${
        hover ? 'hover:shadow-card-hover hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      {title && (
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-guinda">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}
