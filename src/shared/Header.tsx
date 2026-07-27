import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Accessibility, LogOut } from 'lucide-react'
import type { FontSize, Contrast } from '../core/theme'
import logoPuebla from '../assets/Puebla.png'
import mosaico from '../assets/mosaico.svg'
import AccessibilityPanel from './AccessibilityPanel'
import NavigationPanel from './NavigationPanel'
import LoginModal from './LoginModal'
import { useAuth } from '../contexts/AuthContext'

interface HeaderProps {
  fontSize: FontSize
  onFontSizeChange: (size: FontSize) => void
  contrast: Contrast
  onContrastChange: (c: Contrast) => void
  talkBackEnabled: boolean
  onTalkBackToggle: () => void
  navOpen: boolean
  onNavToggle: () => void
}

const navLinks = [
  { to: '/', label: 'Inicio' },
  { to: '/nueva-solicitud', label: 'Nueva Solicitud' },
  { to: '/consultar-folio', label: 'Consultar Folio' },
]

export default function Header({
  fontSize,
  onFontSizeChange,
  contrast,
  onContrastChange,
  talkBackEnabled,
  onTalkBackToggle,
  navOpen,
  onNavToggle,
}: HeaderProps) {
  const { user, cerrarSesion } = useAuth()
  const [panelOpen, setPanelOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const compactNav = fontSize === 'xlarge'

  return (
    <>
      <LoginModal key={String(loginOpen)} open={loginOpen} onClose={() => setLoginOpen(false)} />
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
            <nav className={`${compactNav ? 'hidden' : 'hidden md:flex'} items-center gap-1`}>
              {user && (
                <Link
                  to="/admin"
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    location.pathname.startsWith('/admin') && location.pathname !== '/admin/mapas'
                      ? 'bg-guinda text-white shadow-button'
                      : 'text-gray-institutional hover:bg-guinda/10 hover:text-guinda'
                  }`}
                >
                  Admin
                </Link>
              )}
              {user && (
                <Link
                  to="/admin/mapas"
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    location.pathname === '/admin/mapas'
                      ? 'bg-guinda text-white shadow-button'
                      : 'text-gray-institutional hover:bg-guinda/10 hover:text-guinda'
                  }`}
                >
                  Mapas y Estadísticas
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



            {user && (
              <div className="flex items-center gap-2 border-r border-gray-200 pr-3">
                <span className="hidden text-xs text-gray-institutional/60 md:inline">
                  {user.rol === 'admin' ? 'Admin' : user.rol === 'diputado' ? 'Diputado' : user.rol === 'senador' ? 'Senador' : 'Revisor'}
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
              type="button"
              onClick={onNavToggle}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 ${compactNav ? '' : 'md:hidden'} ${
                navOpen
                  ? 'bg-guinda text-white shadow-button'
                  : 'text-guinda hover:bg-guinda/10'
              }`}
              aria-label="Abrir menú de navegación"
              aria-expanded={navOpen}
            >
              <Menu size={22} />
            </button>
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

      <NavigationPanel
        open={navOpen}
        onClose={() => onNavToggle()}
      />

      <AccessibilityPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        fontSize={fontSize}
        onFontSizeChange={onFontSizeChange}
        contrast={contrast}
        onContrastChange={onContrastChange}
        talkBackEnabled={talkBackEnabled}
        onTalkBackToggle={onTalkBackToggle}
      />
    </>
  )
}
