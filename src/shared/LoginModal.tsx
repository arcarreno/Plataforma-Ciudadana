/**
 * @file LoginModal.tsx
 * @description Modal de acceso (card + portal) que envuelve `ContenidoAcceso`
 * (login/registro/revisa). Se monta/remonta por `key` desde el padre, así que
 * cada apertura parte de estados frescos. Al autenticar se cierra vía `onClose`.
 */

import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import ContenidoAcceso from './ContenidoAcceso'

/** Props del modal de acceso. */
interface LoginModalProps {
  /** Controla visibilidad del modal. */
  open: boolean
  /** Callback para cerrar el modal. */
  onClose: () => void
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-xl p-1.5 text-gray-institutional transition-colors hover:bg-gray-100 hover:text-guinda"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        <ContenidoAcceso onAutenticado={onClose} />
      </div>
    </div>,
    document.body,
  )
}
