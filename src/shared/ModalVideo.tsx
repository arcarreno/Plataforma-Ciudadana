/**
 * @file ModalVideo.tsx
 * @description Modal institucional para reproducir videos (ej. demos de las cards
 * de Inicio). Header guinda con título + X, reproductor con autoplay y pie con
 * descripción. Portal a body (z-[9999]); al cerrar se pausa el video.
 *
 * @props open - visible; onClose - cerrar; src - ruta del mp4; titulo - header.
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, PlayCircle } from 'lucide-react'

/** Props: visibilidad, cierre, fuente del video y título del header. */
interface ModalVideoProps {
  /** Si el modal está visible. */
  open: boolean
  /** Cierra el modal. */
  onClose: () => void
  /** Ruta del video (ej. /videos/solicita-obras.mp4). */
  src: string
  /** Título del header guinda. */
  titulo: string
  /** Descripción bajo el reproductor. */
  descripcion?: string
}

export default function ModalVideo({ open, onClose, src, titulo, descripcion }: ModalVideoProps) {
  /** Ref al <video> para pausarlo al cerrar. */
  const videoRef = useRef<HTMLVideoElement>(null)

  /** Al desmontar/cerrar, pausa para que no siga sonando de fondo. */
  useEffect(() => {
    if (!open && videoRef.current) videoRef.current.pause()
  }, [open ])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header guinda con título */}
        <div className="flex items-center gap-3 bg-guinda px-6 py-4">
          <PlayCircle className="h-5 w-5 text-white" />
          <h2 className="text-sm font-bold tracking-wide text-white">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-xl p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Cerrar video"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Reproductor */}
        <video
          ref={videoRef}
          src={src}
          controls
          autoPlay
          playsInline
          className="aspect-video w-full bg-black"
        />
        {descripcion && (
          <p className="px-6 py-4 text-center text-sm text-gray-institutional/70">{descripcion}</p>
        )}
      </div>
    </div>,
    document.body,
  )
}
