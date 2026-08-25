import { Volume2, VolumeX, Type, Sun, Moon, Accessibility, Mic } from 'lucide-react'
import { fontSizeOptions, fontLabels, voiceOptions } from '../core/theme'
import type { FontSize, Contrast, VoiceType } from '../core/theme'
import ContrastToggle from './ContrastToggle'

interface AccessibilityPanelProps {
  open: boolean
  onClose: () => void
  fontSize: FontSize
  onFontSizeChange: (size: FontSize) => void
  contrast: Contrast
  onContrastChange: (c: Contrast) => void
  voiceType: VoiceType
  onVoiceTypeChange: (v: VoiceType) => void
  talkBackEnabled: boolean
  onTalkBackToggle: () => void
  onIniciarPeticionIA: () => void
}

export default function AccessibilityPanel({
  open,
  onClose,
  fontSize,
  onFontSizeChange,
  contrast,
  onContrastChange,
  voiceType,
  onVoiceTypeChange,
  talkBackEnabled,
  onTalkBackToggle,
  onIniciarPeticionIA,
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
        className={`fixed right-0 top-0 z-50 flex h-full w-[min(320px,100vw)] max-w-full flex-col border-l border-alabaster-dark/50 bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Panel de accesibilidad"
        role="dialog"
        aria-modal={open}
      >
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-alabaster-dark/30 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <Accessibility size={20} className="shrink-0 text-guinda" />
            <h2 className="truncate font-semibold text-guinda">Accesibilidad</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-institutional transition-colors hover:bg-guinda/10 hover:text-guinda"
            aria-label="Cerrar panel de accesibilidad"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden p-5">
          <section>
            <button
              onClick={onIniciarPeticionIA}
              className="flex w-full items-center gap-3 rounded-2xl bg-guinda px-4 py-4 text-left text-white shadow-button transition-all duration-200 hover:bg-guindaLight"
              aria-label="Iniciar petición por voz"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Mic size={20} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold leading-tight">Petición por voz</span>
                <span className="text-xs text-white/70 leading-tight">
                  Captura tu solicitud hablando con el asistente
                </span>
              </span>
            </button>
          </section>

          <div className="h-px bg-alabaster-dark/50" />

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

            {talkBackEnabled && (
              <div className="mt-3">
                <p className="mb-2 text-xs text-gray-institutional/70">Voz</p>
                <div className="flex gap-2">
                  {voiceOptions.map((v) => (
                    <button
                      key={v}
                      onClick={() => onVoiceTypeChange(v)}
                      className={`flex flex-1 items-center justify-center rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 ${
                        voiceType === v
                          ? 'bg-guinda text-white shadow-button'
                          : 'border-2 border-alabaster-dark text-gray-institutional hover:border-guinda/30 hover:text-guinda'
                      }`}
                      aria-pressed={voiceType === v}
                    >
                      {v === 'female' ? 'Femenina' : 'Masculina'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}
