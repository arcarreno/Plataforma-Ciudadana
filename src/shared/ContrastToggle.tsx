import type { Contrast } from '../core/theme'

interface Props {
  contrast: Contrast
  onChange: (c: Contrast) => void
}

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-4.4 2.26 5.43 5.43 0 0 1-5.43-5.43c0-2.39 1.56-4.42 3.72-5.15A8.77 8.77 0 0 0 12 3Z" />
  </svg>
)

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1ZM4.93 4.93a1 1 0 0 1 1.41 0l.7.7a1 1 0 0 1-1.41 1.42l-.7-.7a1 1 0 0 1 0-1.42Zm14.14 0a1 1 0 0 1 0 1.42l-.7.7a1 1 0 1 1-1.42-1.42l.7-.7a1 1 0 0 1 1.42 0ZM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-9 3a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H3Zm17 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1ZM5.64 16.95a1 1 0 0 1 1.41 0l.7.7a1 1 0 0 1-1.42 1.42l-.7-.7a1 1 0 0 1 0-1.42Zm12.72 0a1 1 0 0 1 0 1.42l-.7.7a1 1 0 1 1-1.42-1.42l.7-.7a1 1 0 0 1 1.42 0ZM12 19a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0v-1a1 1 0 0 1 1-1Z" />
  </svg>
)

export default function ContrastToggle({ contrast, onChange }: Props) {
  const dark = contrast === 'dark'

  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={dark}
        onChange={() => onChange(dark ? 'light' : 'dark')}
        className="peer sr-only"
        aria-label="Alternar contraste oscuro/claro"
      />
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300
          ${dark
            ? 'bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-[#4d7cff] shadow-[inset_2px_2px_0_#2a2a4a,inset_-2px_-2px_0_#0a0a1e]'
            : 'bg-gradient-to-br from-[#fef9e7] to-[#fdebd0] text-[#f39c12] shadow-[inset_2px_2px_0_#fff,inset_-2px_-2px_0_#d4c5a0]'
          }
          before:absolute before:inset-0 before:rounded-full before:transition-all before:duration-300
          ${dark
            ? 'before:shadow-[11px_11px_22px_#0a0a1e,-11px_-11px_22px_#2a2a4a]'
            : 'before:shadow-[11px_11px_22px_#d4c5a0,-11px_-11px_22px_#fff]'
          }
        `}
      >
        <span className="relative z-10 h-7 w-7">
          {dark ? <MoonIcon /> : <SunIcon />}
        </span>
      </span>
    </label>
  )
}
