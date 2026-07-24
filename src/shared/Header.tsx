import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Accessibility, LogOut } from 'lucide-react'
import type { FontSize } from '../core/theme'
import logoPuebla from '../assets/Puebla.png'
import mosaico from '../assets/mosaico.svg'
import AccessibilityPanel from './AccessibilityPanel'
import LoginModal from './LoginModal'
import { useAuth } from '../contexts/AuthContext'

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
  const { user, cerrarSesion } = useAuth()
  const [panelOpen, setPanelOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <header className="sticky top-0 z-30 bg-white/80 shadow-header backdrop-blur-lg">
        <div className="relative mx-auto flex max-w-[1400px] items-center justify-between px-4 py-[11px] md:px-8 lg:px-12">
          <img src={mosaico} alt="" className="pointer-events-none absolute -bottom-[15px] left-0 w-full h-[31px]" />
          <button
            type="button"
            onClick={() => {
              if (user) { navigate('/admin'); return }
              setLoginOpen(true)
            }}
            className="flex shrink-0 transition-opacity hover:opacity-80"
            title={user ? `Admin: ${user.username}` : 'Iniciar sesión'}
          >
            <img src={logoPuebla} alt="Puebla" className="h-8 w-auto" />
          </button>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              {user && (
                <Link
                  to="/admin"
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    location.pathname.startsWith('/admin')
                      ? 'bg-guinda text-white shadow-button'
                      : 'text-gray-institutional hover:bg-guinda/10 hover:text-guinda'
                  }`}
                >
                  Admin
                </Link>
              )}
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


            {user && (
              <div className="flex items-center gap-2 border-r border-gray-200 pr-3">
                <span className="hidden text-xs text-gray-institutional/60 md:inline">
                  {user.rol === 'admin' ? 'Admin' : 'Revisor'}
                </span>
                <button
                  type="button"
                  onClick={() => { cerrarSesion(); navigate('/') }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-institutional/50 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}

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
