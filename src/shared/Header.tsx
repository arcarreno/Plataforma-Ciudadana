import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Accessibility } from 'lucide-react'
import type { FontSize } from '../core/theme'
import logoPuebla from '../assets/Puebla.png'
import AccessibilityPanel from './AccessibilityPanel'

interface HeaderProps {
  fontSize: FontSize
  onFontSizeChange: (size: FontSize) => void
  talkBackEnabled: boolean
  onTalkBackToggle: () => void
}

const navLinks = [
  { to: '/', label: 'Inicio' },
  { to: '/nueva-solicitud', label: 'Nueva Solicitud' },
  { to: '/consultar-folio', label: 'Consultar Folio' },
]

export default function Header({
  fontSize,
  onFontSizeChange,
  talkBackEnabled,
  onTalkBackToggle,
}: HeaderProps) {
  const [panelOpen, setPanelOpen] = useState(false)
  const location = useLocation()

  return (
    <>
      <header className="sticky top-0 z-30 border-b-2 border-guinda bg-white/80 shadow-header backdrop-blur-lg">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-[11px] md:px-8 lg:px-12">
          <Link
            to="/"
            className="flex shrink-0 transition-opacity hover:opacity-80"
          >
            <img src={logoPuebla} alt="Puebla" className="h-8 w-auto" />
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-guinda text-white shadow-button'
                        : 'text-gray-institutional hover:bg-guinda/10 hover:text-guinda'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
            <nav className="flex gap-1 md:hidden">
              {[
                { to: '/', label: 'Inicio' },
                { to: '/nueva-solicitud', label: 'Nueva' },
                { to: '/consultar-folio', label: 'Ver' },
              ].map((link) => {
                const isActive = location.pathname === link.to
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-guinda text-white shadow-button'
                        : 'text-gray-institutional hover:bg-guinda/10 hover:text-guinda'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>


            <button
              onClick={() => setPanelOpen(!panelOpen)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 ${
                panelOpen
                  ? 'rotate-90 bg-guinda text-white shadow-button'
                  : 'text-guinda hover:bg-guinda/10'
              }`}
              aria-label="Abrir panel de accesibilidad"
              aria-expanded={panelOpen}
            >
              <Accessibility size={22} />
            </button>
          </div>
        </div>
      </header>

      <AccessibilityPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        fontSize={fontSize}
        onFontSizeChange={onFontSizeChange}
        talkBackEnabled={talkBackEnabled}
        onTalkBackToggle={onTalkBackToggle}
      />
    </>
  )
}
