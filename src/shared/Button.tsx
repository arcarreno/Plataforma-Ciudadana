import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const variantStyles = {
  primary:
    'bg-guinda text-white shadow-button hover:shadow-button-hover hover:brightness-110 active:brightness-90',
  secondary:
    'border-2 border-guinda/30 text-guinda hover:bg-guinda hover:text-white hover:border-guinda hover:shadow-button active:bg-guinda-dark',
  ghost:
    'text-gray-institutional hover:bg-guinda/10 hover:text-guinda active:bg-guinda/20',
}

const sizeStyles = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center rounded-xl font-medium transition-all duration-200 active:scale-[0.97] ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
