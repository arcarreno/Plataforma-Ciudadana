import { useEffect, useState, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Toaster } from 'sileo'
import 'sileo/styles.css'
import type { FontSize, Contrast, VoiceType } from '../core/theme'
import { useTalkBack } from '../hooks/useTalkBack'
import { detectarModo, suscribirModo, modoEnCache } from '../lib/backend'
import Header from './Header'
import Footer from './Footer'
import AccessibilityPanel from './AccessibilityPanel'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (typeof document !== 'undefined'
      ? (document.documentElement.getAttribute('data-font-size') as FontSize)
      : null) ?? 'normal'
  })

  const [contrast, setContrast] = useState<Contrast>(() => {
    return (typeof document !== 'undefined'
      ? (document.documentElement.getAttribute('data-contrast') as Contrast)
      : null) ?? 'light'
  })

  const [talkBackEnabled, setTalkBackEnabled] = useState(false)
  const [voiceType, setVoiceType] = useState<VoiceType>('female')
  const [navOpen, setNavOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [hideBtn, setHideBtn] = useState(false)
  const [btnPos, setBtnPos] = useState<{ x: number; y: number } | null>(null)
  const [modoRespaldo, setModoRespaldo] = useState<boolean>(() => modoEnCache() === 'supabase')
  const btnRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, origX: 0, origY: 0 })

  useTalkBack(talkBackEnabled, voiceType)

  useEffect(() => {
    detectarModo().then((m) => setModoRespaldo(m === 'supabase'))
    const unsub = suscribirModo((m) => setModoRespaldo(m === 'supabase'))
    return unsub
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize)
  }, [fontSize])

  useEffect(() => {
    document.documentElement.setAttribute('data-contrast', contrast)
  }, [contrast])

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        navOpen={navOpen}
        onNavToggle={() => setNavOpen((p) => !p)}
      />
      {modoRespaldo && (
        <div
          role="status"
          className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900"
        >
          Modo de respaldo activo: el servidor principal no está disponible. Tu información se
          guardará en la nube y se sincronizará automáticamente.
        </div>
      )}
      <main className="mx-auto w-full max-w-[1400px] flex-1 overflow-x-hidden px-4 py-6 md:px-8 lg:px-12">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="h-full"
        >
          <Outlet />
        </motion.div>
      </main>
      <Footer />
      <Toaster
        position="top-center"
        options={{ fill: '#ffffff', roundness: 14, duration: 5000, autopilot: true }}
      />

      <button
        ref={btnRef}
        type="button"
        onClick={() => { if (!dragRef.current.isDragging) setPanelOpen(true) }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-dismiss-btn]')) return
          const btn = btnRef.current
          if (!btn) return
          btn.setPointerCapture(e.pointerId)
          const rect = btn.getBoundingClientRect()
          dragRef.current = {
            isDragging: false,
            startX: e.clientX,
            startY: e.clientY,
            origX: btnPos?.x ?? rect.left,
            origY: btnPos?.y ?? rect.top,
          }
        }}
        onPointerMove={(e) => {
          const d = dragRef.current
          if (!d.startX && !d.startY) return
          const dx = e.clientX - d.startX
          const dy = e.clientY - d.startY
          if (!d.isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
            d.isDragging = true
          }
          if (d.isDragging) {
            setBtnPos({ x: d.origX + dx, y: d.origY + dy })
          }
        }}
        onPointerUp={() => {
          dragRef.current = { isDragging: false, startX: 0, startY: 0, origX: 0, origY: 0 }
        }}
        aria-label="Abrir panel de accesibilidad"
        className={`group fixed z-50 flex touch-none select-none items-center justify-center rounded-full bg-guinda p-3 text-white shadow-xl transition-all duration-300 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-guinda/50 focus:ring-offset-2 ${
          btnPos ? 'cursor-grab active:cursor-grabbing' : 'bottom-6 right-6 cursor-grab active:cursor-grabbing'
        } ${
          hideBtn ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        }`}
        style={btnPos ? { left: btnPos.x, top: btnPos.y } : undefined}
      >
        <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 pointer-events-none" aria-hidden="true">
          <circle cx="13" cy="13" r="11" />
          <circle cx="13" cy="5.5" r="2" />
          <line x1="13" y1="9" x2="13" y2="15" />
          <line x1="9.5" y1="10" x2="5.5" y2="7.5" />
          <line x1="16.5" y1="10" x2="20.5" y2="7.5" />
          <line x1="13" y1="15" x2="9.5" y2="20.5" />
          <line x1="13" y1="15" x2="16.5" y2="20.5" />
        </svg>

        <span
          data-dismiss-btn
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); setHideBtn(true) }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setHideBtn(true) } }}
          aria-label="Ocultar botón de accesibilidad"
          className="absolute -right-1 -top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-gray-400 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-500"
        >
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3 pointer-events-none">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </span>
      </button>

      <AccessibilityPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        contrast={contrast}
        onContrastChange={setContrast}
        voiceType={voiceType}
        onVoiceTypeChange={setVoiceType}
        talkBackEnabled={talkBackEnabled}
        onTalkBackToggle={() => setTalkBackEnabled((p) => !p)}
        onIniciarPeticionIA={() => {
          setPanelOpen(false)
          navigate(`/nueva-solicitud?ia=${Date.now()}`)
        }}
      />
    </div>
  )
}
