/**
 * @file LoginModal.tsx
 * @description Modal de inicio de sesión para acceso al panel de administración.
 * Se renderiza con `createPortal` en `document.body` para escapar del stacking
 * context del layout y aparecer por encima de todo (z-[9999]). Gestiona estado
 * local de usuario, contraseña, error y loading; valida campos vacíos y delega
 * la autenticación a `useAuth().iniciarSesion`. Al autenticarse con éxito
 * resetea el formulario y cierra el modal. Incluye logo de Semovinfra y
 * botón de cierre con `lucide-react` (X).
 *
 * @props LoginModalProps
 * @prop {boolean} open - Si el modal está visible; si es false retorna null (no se monta).
 * @prop {() => void} onClose - Callback para cerrar el modal (botón X o éxito).
 *
 * @uso Renderizado por `Footer`; se controla con `loginOpen` en el footer.
 * Usa `key={String(loginOpen)}` en el padre para forzar remount y limpiar estado.
 *
 * @portal Usa `createPortal(..., document.body)` porque el modal debe estar
 * fuera del flujo normal del DOM para que el overlay cubra toda la ventana
 * sin verse afectado por overflow/z-index de ancestros.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, LogIn, Lock, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logoSemovinfra from '../assets/Logo_Semovinfra.jpg'

/** Props del modal de login. */
interface LoginModalProps {
  /** Controla visibilidad del modal. */
  open: boolean
  /** Callback para cerrar el modal. */
  onClose: () => void
}

/**
 * Modal de autenticación con formulario de usuario/contraseña.
 */
export default function LoginModal({ open, onClose }: LoginModalProps) {
  // Función de autenticación del contexto global
  const { iniciarSesion } = useAuth()
  /** Estado del campo de usuario. */
  const [username, setUsername] = useState('')
  /** Estado del campo de contraseña. */
  const [password, setPassword] = useState('')
  /** Mensaje de error a mostrar bajo los campos. */
  const [error, setError] = useState('')
  /** Si la petición de login está en curso (deshabilita botón y muestra spinner). */
  const [loading, setLoading] = useState(false)

  // Si no está abierto, no renderiza nada (evita montar portal innecesario)
  if (!open) return null

  /**
   * Resetea todos los campos del formulario a su estado inicial.
   * Se llama tras login exitoso y podría usarse al cerrar.
   */
  const reset = () => {
    setUsername('')
    setPassword('')
    setError('')
    setLoading(false)
  }

  /**
   * Manejador de envío del formulario.
   * Valida que ambos campos tengan contenido, activa loading, llama a
   * `iniciarSesion` y maneja errores (credenciales inválidas o fallo de red).
   * En éxito resetea y cierra el modal.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validación básica de campos vacíos
    if (!username.trim() || !password.trim()) {
      setError('Ingresa usuario y contraseña')
      return
    }
    setLoading(true)
    setError('')
    try {
      // iniciarSesion retorna string de error o null/undefined si fue exitoso
      const err = await iniciarSesion(username.trim(), password)
      if (err) {
        setError(err)
        setLoading(false)
        return
      }
      reset()
      onClose()
    } catch {
      // Error de red / excepción no controlada
      setError('Error de conexión. Intenta de nuevo.')
      setLoading(false)
    }
  }

  // Portal al body para overlay de pantalla completa por encima de todo
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      {/* Tarjeta del modal — ancho máximo 448px, centrada */}
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        {/* Botón X de cierre en esquina superior derecha */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-xl p-1.5 text-gray-institutional transition-colors hover:bg-gray-100 hover:text-guinda"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Cabecera del modal: logo + título + subtítulo */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            <img src={logoSemovinfra} alt="Semovinfra" className="h-14 w-14 rounded-full object-cover" />
          </div>
          <h2 className="text-lg font-semibold text-guinda">Iniciar sesión</h2>
          <p className="mt-1 text-xs text-gray-institutional/60">Acceso al panel de administración</p>
        </div>

        {/* Formulario de credenciales */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Campo de usuario con icono */}
          <div className="flex items-center gap-3 rounded-xl bg-alabaster/30 px-4">
            <User className="h-5 w-5 shrink-0 text-gray-institutional/50" />
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Usuario"
              autoFocus // Enfoca automáticamente al abrir el modal
              className="w-full rounded-xl bg-transparent py-3 text-sm text-gray-institutional outline-none placeholder:text-gray-institutional/30 focus:ring-2 focus:ring-guinda"
            />
          </div>

          {/* Campo de contraseña con icono */}
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

          {/* Mensaje de error — render condicional */}
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          {/* Botón de envío — muestra spinner si loading, deshabilitado durante petición */}
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
    </div>,
    document.body // Destino del portal — body para cobertura total
  )
}
