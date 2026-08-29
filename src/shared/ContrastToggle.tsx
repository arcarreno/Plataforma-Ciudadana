/**
 * @file ContrastToggle.tsx
 * @description Toggle visual para alternar entre contraste claro y alto contraste.
 * Renderiza un `<label>` con un `<input type="checkbox">` oculto (`sr-only` + `peer`)
 * y un `<span>` circular estilizado que actúa como botón. Muestra icono de Sol
 * en modo claro y Luna en modo alto contraste, con gradientes y sombras neumórficas
 * (inset + outer shadow) que cambian según el estado `high`.
 * Usa `onChange` para alternar entre 'light' y 'high' (tipo `Contrast`).
 *
 * @props Props
 * @prop {Contrast} contrast - Valor actual ('light' | 'high'); determina icono y estilos.
 * @prop {(c: Contrast) => void} onChange - Callback al alternar; recibe el nuevo valor.
 *
 * @uso
 * ```tsx
 * <ContrastToggle contrast={contrast} onChange={setContrast} />
 * ```
 * Normalmente embebido en `AccessibilityPanel`.
 *
 * @accesibilidad El input oculto tiene `aria-label` y el label es clickeable;
 * el estado visual refleja `checked={high}`.
 */
import type { Contrast } from '../core/theme'

/** Props del toggle de contraste. */
interface Props {
  /** Contraste actual — 'light' muestra sol, 'high' muestra luna. */
  contrast: Contrast
  /** Callback al cambiar; recibe el nuevo valor de contraste. */
  onChange: (c: Contrast) => void
}

/** Icono de luna (SVG inline, fill currentColor) para modo oscuro. */
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-4.4 2.26 5.43 5.43 0 0 1-5.43-5.43c0-2.39 1.56-4.42 3.72-5.15A8.77 8.77 0 0 0 12 3Z" />
  </svg>
)

/** Icono de sol (SVG inline, fill currentColor) para modo claro — con rayos y círculo central. */
const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1ZM4.93 4.93a1 1 0 0 1 1.41 0l.7.7a1 1 0 0 1-1.41 1.42l-.7-.7a1 1 0 0 1 0-1.42Zm14.14 0a1 1 0 0 1 0 1.42l-.7.7a1 1 0 1 1-1.42-1.42l.7-.7a1 1 0 0 1 1.42 0ZM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-9 3a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H3Zm17 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1ZM5.64 16.95a1 1 0 0 1 1.41 0l.7.7a1 1 0 0 1-1.42 1.42l-.7-.7a1 1 0 0 1 0-1.42Zm12.72 0a1 1 0 0 1 0 1.42l-.7.7a1 1 0 1 1-1.42-1.42l.7-.7a1 1 0 0 1 1.42 0ZM12 19a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0v-1a1 1 0 0 1 1-1Z" />
  </svg>
)

/**
 * Toggle circular de contraste claro/alto contraste con iconos animados y efecto neumórfico.
 */
export default function ContrastToggle({ contrast, onChange }: Props) {
  /** True si el contraste actual es alto contraste. */
  const high = contrast === 'high'

  return (
    // Label clickeable que envuelve el input oculto y el span visual
    <label className="relative inline-flex cursor-pointer items-center">
      {/* Input checkbox oculto — su estado checked refleja `high`; onChange alterna el valor */}
      <input
        type="checkbox"
        checked={high}
        onChange={() => onChange(high ? 'light' : 'high')}
        className="peer sr-only" // sr-only lo oculta visualmente pero mantiene accesibilidad
        aria-label="Alternar alto contraste"
      />
      {/* Círculo visual del toggle — gradiente, sombra inset y outer shadow según modo */}
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300
          ${high
            ? 'bg-gradient-to-br from-[#000000] to-[#1a1a1a] text-[#ffcc00] shadow-[inset_2px_2px_0_#333,inset_-2px_-2px_0_#000]'
            : 'bg-gradient-to-br from-[#fef9e7] to-[#fdebd0] text-[#f39c12] shadow-[inset_2px_2px_0_#fff,inset_-2px_-2px_0_#d4c5a0]'
          }
          before:absolute before:inset-0 before:rounded-full before:transition-all before:duration-300
          ${high
            ? 'before:shadow-[11px_11px_22px_#000,-11px_-11px_22px_#333]'
            : 'before:shadow-[11px_11px_22px_#d4c5a0,-11px_-11px_22px_#fff]'
          }
        `}
      >
        {/* Icono centrado — luna si high, sol si light */}
        <span className="relative z-10 h-7 w-7">
          {high ? <MoonIcon /> : <SunIcon />}
        </span>
      </span>
    </label>
  )
}
