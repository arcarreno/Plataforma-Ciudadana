import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import lottie, { type AnimationItem } from 'lottie-web'
import trashAnimation from '../assets/lottie/trash.json'

interface DeleteConfirmModalProps {
  isOpen: boolean
  itemName: string
  itemSubtitle?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function DeleteConfirmModal({
  isOpen,
  itemName,
  itemSubtitle,
  onConfirm,
  onCancel,
  loading = false,
}: DeleteConfirmModalProps) {
  const [phase, setPhase] = useState<'idle' | 'animating' | 'done'>('idle')
  const lottieRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)

  useEffect(() => {
    if (!isOpen || !lottieRef.current) return

    setPhase('idle')

    animRef.current = lottie.loadAnimation({
      container: lottieRef.current,
      animationData: trashAnimation,
      loop: false,
      autoplay: false,
    })

    return () => {
      animRef.current?.destroy()
      animRef.current = null
    }
  }, [isOpen])

  const handleConfirm = () => {
    if (phase !== 'idle') return
    setPhase('animating')
    animRef.current?.play()
  }

  useEffect(() => {
    if (phase !== 'animating' || !animRef.current) return

    const onComplete = () => {
      setPhase('done')
      onConfirm()
    }

    animRef.current.addEventListener('complete', onComplete)
    return () => {
      animRef.current?.removeEventListener('complete', onComplete)
    }
  }, [phase, onConfirm])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: 'fadeInUp 0.3s ease-out' }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={loading || phase === 'animating'}
          className="absolute right-3 top-3 z-20 rounded-xl p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
          aria-label="Cerrar"
        >
          ✕
        </button>

        <div className="flex flex-col items-center px-6 pt-8 pb-4 text-center">
          <div
            ref={lottieRef}
            className={`w-28 h-28 ${phase === 'idle' ? '' : ''}`}
          />

          <div className="mt-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-bold text-gray-900">Eliminar</h3>
          </div>

          <p className="mt-2 text-sm font-medium text-gray-700">{itemName}</p>
          {itemSubtitle && (
            <p className="mt-1 text-xs text-gray-500">{itemSubtitle}</p>
          )}

          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            Esta acción es irreversible
          </p>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading || phase === 'animating'}
            className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-[0.97] disabled:opacity-30"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || phase !== 'idle'}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-700 hover:shadow-red-600/30 active:scale-[0.97] disabled:opacity-60"
          >
            {phase === 'animating' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Eliminando…
              </span>
            ) : (
              'Eliminar'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body
  )
}
