/**
 * @file DeleteConfirmModal.tsx
 * @description Modal de confirmación de eliminación con animación Lottie.
 * Renderizado con `createPortal` en `document.body` (overlay z-[9999]), muestra
 * una animación de bote de basura (`trash.json`), nombre del ítem a eliminar,
 * subtítulo opcional y advertencia de irreversibilidad. Flujo de confirmación
 * en tres fases:
 *  - `idle`: muestra botón "Eliminar" habilitado; al hacer clic pasa a `animating`.
 *  - `animating`: reproduce la animación Lottie (`lottie-web`), deshabilita botones.
 *  - `done`: al completarse la animación (`complete` event) llama a `onConfirm`.
 * Usa dos `useEffect`: uno para inicializar/destruir la animación Lottie al abrir/cerrar,
 * y otro para escuchar el evento `complete` cuando `phase === 'animating'`.
 * El botón "Cancelar" y la X llaman a `onCancel` (deshabilitados durante animación/loading).
 *
 * @props DeleteConfirmModalProps
 * @prop {boolean} isOpen - Si el modal está visible; si false retorna null.
 * @prop {string} itemName - Nombre del elemento a eliminar (mostrado destacado).
 * @prop {string} [itemSubtitle] - Subtítulo/descripción adicional del ítem.
 * @prop {() => void} onConfirm - Callback tras completar la animación (ejecuta borrado real).
 * @prop {() => void} onCancel - Callback para cancelar/cerrar.
 * @prop {boolean} [loading=false] - Si hay operación async en curso (deshabilita botones).
 *
 * @uso
 * ```tsx
 * <DeleteConfirmModal isOpen={show} itemName="Solicitud #123" onConfirm={handleDelete} onCancel={() => setShow(false)} />
 * ```
 *
 * @portal `createPortal(..., document.body)` para overlay full-screen.
 * @animacion Usa `lottie-web` con `trash.json`; `autoplay: false` para control manual.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import lottie, { type AnimationItem } from 'lottie-web'
import trashAnimation from '../assets/lottie/trash.json'

/** Props del modal de confirmación de borrado. */
interface DeleteConfirmModalProps {
  /** Controla visibilidad del modal. */
  isOpen: boolean
  /** Nombre del ítem a eliminar (ej. "Solicitud #123"). */
  itemName: string
  /** Subtítulo opcional con detalle del ítem. */
  itemSubtitle?: string
  /** Callback que se ejecuta tras la animación de confirmación. */
  onConfirm: () => void
  /** Callback para cancelar y cerrar el modal. */
  onCancel: () => void
  /** Si hay una operación de borrado en curso en el padre. */
  loading?: boolean
}

/**
 * Modal de confirmación de eliminación con animación Lottie de bote de basura.
 */
export default function DeleteConfirmModal({
  isOpen,
  itemName,
  itemSubtitle,
  onConfirm,
  onCancel,
  loading = false,
}: DeleteConfirmModalProps) {
  /**
   * Fase del flujo de confirmación:
   * - idle: esperando clic en "Eliminar"
   * - animating: reproducción de Lottie en curso
   * - done: animación completada, onConfirm ya llamado
   */
  const [phase, setPhase] = useState<'idle' | 'animating' | 'done'>('idle')
  /** Ref al div contenedor donde Lottie renderiza la animación. */
  const lottieRef = useRef<HTMLDivElement>(null)
  /** Ref a la instancia de animación Lottie para controlar play/destroy. */
  const animRef = useRef<AnimationItem | null>(null)

  /**
   * Efecto que inicializa la animación Lottie cada vez que el modal se abre.
   * - Resetea phase a 'idle'.
   * - Carga la animación con `lottie.loadAnimation` (loop false, autoplay false).
   * - Al desmontar/cerrar destruye la animación para liberar recursos.
   */
  useEffect(() => {
    if (!isOpen || !lottieRef.current) return

    setPhase('idle')

    animRef.current = lottie.loadAnimation({
      container: lottieRef.current, // Div donde se inyecta el SVG/canvas de Lottie
      animationData: trashAnimation, // Datos JSON de la animación de bote de basura
      loop: false, // No repetir — se reproduce una sola vez al confirmar
      autoplay: false, // No arranca solo; se inicia manualmente en handleConfirm
    })

    return () => {
      animRef.current?.destroy()
      animRef.current = null
    }
  }, [isOpen])

  /**
   * Manejador del botón "Eliminar".
   * Solo actúa si está en fase idle; cambia a animating y dispara `play()` de Lottie.
   * El guard `phase !== 'idle'` evita doble trigger.
   */
  const handleConfirm = () => {
    if (phase !== 'idle') return
    setPhase('animating')
    animRef.current?.play()
  }

  /**
   * Efecto que escucha el evento 'complete' de Lottie cuando está en fase animating.
   * Al completarse la animación cambia a 'done' y llama a `onConfirm` (borrado real).
   * Limpia el listener al desmontar o cambiar de fase.
   */
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

  // Si no está abierto, no renderiza nada
  if (!isOpen) return null

  // Portal a body — overlay oscuro con blur y tarjeta centrada
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      {/* Tarjeta del modal — animación de entrada fadeInUp */}
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: 'fadeInUp 0.3s ease-out' }}
      >
        {/* Botón X de cierre — deshabilitado durante loading o animación */}
        <button
          type="button"
          onClick={onCancel}
          disabled={loading || phase === 'animating'}
          className="absolute right-3 top-3 z-20 rounded-xl p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
          aria-label="Cerrar"
        >
          ✕
        </button>

        {/* Zona superior centrada: animación Lottie + título + detalles del ítem */}
        <div className="flex flex-col items-center px-6 pt-8 pb-4 text-center">
          {/* Contenedor de la animación Lottie — w-28 h-28 */}
          <div
            ref={lottieRef}
            className={`w-28 h-28 ${phase === 'idle' ? '' : ''}`}
          />

          {/* Título "Eliminar" con icono de advertencia */}
          <div className="mt-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-bold text-gray-900">Eliminar</h3>
          </div>

          {/* Nombre del ítem a eliminar */}
          <p className="mt-2 text-sm font-medium text-gray-700">{itemName}</p>
          {/* Subtítulo opcional */}
          {itemSubtitle && (
            <p className="mt-1 text-xs text-gray-500">{itemSubtitle}</p>
          )}

          {/* Badge de advertencia de irreversibilidad */}
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            Esta acción es irreversible
          </p>
        </div>

        {/* Zona de botones: Cancelar y Eliminar */}
        <div className="flex gap-3 px-6 pb-6">
          {/* Botón Cancelar — outline gris */}
          <button
            type="button"
            onClick={onCancel}
            disabled={loading || phase === 'animating'}
            className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-[0.97] disabled:opacity-30"
          >
            Cancelar
          </button>
          {/* Botón Eliminar — rojo; muestra spinner si phase === 'animating' */}
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

      {/* Keyframes de animación de entrada de la tarjeta */}
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
