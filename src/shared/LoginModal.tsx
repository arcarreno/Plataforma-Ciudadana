import { useState } from 'react'
import { X, LogIn, Lock, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logoSemovinfra from '../assets/Logo_Semovinfra.jpg'

interface LoginModalProps {
  open: boolean
  onClose: () => void
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { iniciarSesion } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const reset = () => {
    setUsername('')
    setPassword('')
    setError('')
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Ingresa usuario y contraseña')
      return
    }
    setLoading(true)
    setError('')
    try {
      const err = await iniciarSesion(username.trim(), password)
      if (err) {
        setError(err)
        setLoading(false)
        return
      }
      reset()
      onClose()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-xl p-1.5 text-gray-institutional transition-colors hover:bg-gray-100 hover:text-guinda"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            <img src={logoSemovinfra} alt="Semovinfra" className="h-14 w-14 rounded-full object-cover" />
          </div>
          <h2 className="text-lg font-semibold text-guinda">Iniciar sesión</h2>
          <p className="mt-1 text-xs text-gray-institutional/60">Acceso al panel de administración</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl bg-alabaster/30 px-4">
            <User className="h-5 w-5 shrink-0 text-gray-institutional/50" />
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Usuario"
              autoFocus
              className="w-full rounded-xl bg-transparent py-3 text-sm text-gray-institutional outline-none placeholder:text-gray-institutional/30 focus:ring-2 focus:ring-guinda"
            />
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-alabaster/30 px-4">
            <Lock className="h-5 w-5 shrink-0 text-gray-institutional/50" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full rounded-xl bg-transparent py-3 text-sm text-gray-institutional outline-none placeholder:text-gray-institutional/30 focus:ring-2 focus:ring-guinda"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-guinda px-6 py-3 text-sm font-medium text-white shadow-button transition-all duration-200 hover:brightness-110 active:brightness-90 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {loading ? 'Entrando' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
