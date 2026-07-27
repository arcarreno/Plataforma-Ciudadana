import { Volume2, VolumeX, Type, Sun, Moon, Accessibility } from 'lucide-react'
import { fontSizeOptions, fontLabels } from '../core/theme'
import type { FontSize, Contrast } from '../core/theme'
import ContrastToggle from './ContrastToggle'

interface AccessibilityPanelProps {
  open: boolean
  onClose: () => void
  fontSize: FontSize
  onFontSizeChange: (size: FontSize) => void
  contrast: Contrast
  onContrastChange: (c: Contrast) => void
  talkBackEnabled: boolean
  onTalkBackToggle: () => void
}

export default function AccessibilityPanel({
  open,
  onClose,
  fontSize,
  onFontSizeChange,
  contrast,
  onContrastChange,
  talkBackEnabled,
  onTalkBackToggle,
}: AccessibilityPanelProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-alabaster-dark/50 bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Panel de accesibilidad"
        role="dialog"
        aria-modal={open}
      >
        <div className="flex items-center justify-between border-b border-alabaster-dark/30 px-5 py-4">
          <div className="flex items-center gap-2">
            <Accessibility size={20} className="text-guinda" />
            <h2 className="font-semibold text-guinda">Accesibilidad</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-institutional transition-colors hover:bg-guinda/10 hover:text-guinda"
            aria-label="Cerrar panel de accesibilidad"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Type size={18} className="text-guinda" />
              <h3 className="text-sm font-medium text-guinda">Tamaño de letra</h3>
            </div>
            <div className="flex gap-2">
              {fontSizeOptions.map((size) => (
                <button
                  key={size}
                  onClick={() => onFontSizeChange(size)}
                  className={`flex flex-1 items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200 ${
                    fontSize === size
                      ? 'bg-guinda text-white shadow-button'
                      : 'border-2 border-alabaster-dark text-gray-institutional hover:border-guinda/30 hover:text-guinda'
                  }`}
                  aria-label={`Tamaño de letra ${size === 'normal' ? 'normal' : size === 'large' ? 'grande' : 'muy grande'}`}
                  aria-pressed={fontSize === size}
                >
                  {fontLabels[size]}
                </button>
              ))}
            </div>
          </section>

          <div className="h-px bg-alabaster-dark/50" />

          <section>
            <div className="mb-3 flex items-center gap-2">
              {contrast === 'dark' ? (
                <Moon size={18} className="text-guinda" />
              ) : (
                <Sun size={18} className="text-guinda" />
              )}
              <h3 className="text-sm font-medium text-guinda">Contraste</h3>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-institutional">
                {contrast === 'dark' ? 'Oscuro' : 'Claro'}
              </span>
              <ContrastToggle contrast={contrast} onChange={onContrastChange} />
            </div>
          </section>

          <div className="h-px bg-alabaster-dark/50" />

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Volume2 size={18} className="text-guinda" />
              <h3 className="text-sm font-medium text-guinda">Lectura en voz alta</h3>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-gray-institutional/70">
              Al activar esta opción, puedes presionar cualquier texto o botón y se leerá en voz alta.
            </p>
            <button
              onClick={onTalkBackToggle}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                talkBackEnabled
                  ? 'bg-guinda text-white shadow-button'
                  : 'border-2 border-alabaster-dark text-gray-institutional hover:border-guinda/30 hover:text-guinda'
              }`}
              aria-label={talkBackEnabled ? 'Desactivar lectura en voz alta' : 'Activar lectura en voz alta'}
              aria-pressed={talkBackEnabled}
            >
              {talkBackEnabled ? (
                <>
                  <Volume2 size={18} />
                  Activado
                </>
              ) : (
                <>
                  <VolumeX size={18} />
                  Desactivado
                </>
              )}
            </button>
          </section>
        </div>
      </aside>
    </>
  )
}
