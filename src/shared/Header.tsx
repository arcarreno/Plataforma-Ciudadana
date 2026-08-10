import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, LogOut } from 'lucide-react'
import logoPuebla from '../assets/Puebla.png'
import mosaico from '../assets/mosaico.svg'
import NavigationPanel from './NavigationPanel'
import { useAuth } from '../contexts/AuthContext'

interface HeaderProps {
  navOpen: boolean
  onNavToggle: () => void
}

const navLinks = [
  { to: '/', label: 'Inicio' },
  { to: '/nueva-solicitud', label: 'Nueva Solicitud' },
]

export default function Header({
  navOpen,
  onNavToggle,
}: HeaderProps) {
  const { user, cerrarSesion } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const navRef = useRef<HTMLElement>(null)
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)
  const indicatorRef = useRef(indicator)
  indicatorRef.current = indicator

  const compactNav = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-font-size') === 'xlarge'
    : false

  function isActive(path: string) {
    if (path === '/admin') return location.pathname.startsWith('/admin') && location.pathname !== '/admin/mapas'
    return location.pathname === path
  }

  function medirIndicador() {
    const nav = navRef.current
    if (!nav) return
    const active = nav.querySelector<HTMLElement>('[data-active="true"]')
    if (!active) return
    const activeRect = active.getBoundingClientRect()
    if (activeRect.width === 0 || activeRect.height === 0) return
    const navRect = nav.getBoundingClientRect()
    const siguiente = { left: activeRect.left - navRect.left, width: activeRect.width }
    const actual = indicatorRef.current
    if (!actual || Math.abs(actual.left - siguiente.left) > 1 || Math.abs(actual.width - siguiente.width) > 1) {
      setIndicator(siguiente)
    }
  }

  useEffect(() => {
    medirIndicador()
    const t = setTimeout(medirIndicador, 400)
    const alCambiarLayout = () => medirIndicador()
    document.fonts?.ready.then(alCambiarLayout).catch(() => {})
    document.fonts?.addEventListener('loadingdone', alCambiarLayout)
    window.addEventListener('resize', alCambiarLayout)
    const obs = new MutationObserver(alCambiarLayout)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-font-size', 'data-contrast'] })
    return () => {
      clearTimeout(t)
      document.fonts?.removeEventListener('loadingdone', alCambiarLayout)
      window.removeEventListener('resize', alCambiarLayout)
      obs.disconnect()
    }
  }, [location.pathname, user])

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/80 shadow-header backdrop-blur-lg">
        <div className="relative mx-auto flex max-w-[1400px] items-center justify-between px-4 py-[11px] md:px-8 lg:px-12">
          <img src={mosaico} alt="" className="contrast-mosaico pointer-events-none absolute -bottom-[15px] left-0 w-full h-[31px]" />
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex shrink-0 transition-opacity hover:opacity-80"
            title="Ir al inicio"
          >
            <img src={logoPuebla} alt="Puebla" className="h-8 w-auto" />
          </button>

          <div className="flex items-center gap-2">
            <nav
              ref={navRef}
              className={`${compactNav ? 'hidden' : 'hidden md:flex'} relative items-center gap-1`}
            >
              {indicator && (
                <div
                  className="absolute bottom-1 top-1 rounded-xl bg-guinda shadow-button transition-all duration-300 ease-in-out"
                  style={{ left: indicator.left, width: indicator.width }}
                />
              )}
              {user && (
                <Link
                  to="/admin"
                  data-active={isActive('/admin')}
                  className={`relative z-10 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive('/admin')
                      ? 'text-white'
                      : 'text-gray-institutional hover:bg-guinda/10 hover:text-guinda'
                  }`}
                >
                  Peticiones
                </Link>
              )}
              {user && (
                <Link
                  to="/admin/mapas"
                  data-active={isActive('/admin/mapas')}
                  className={`relative z-10 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive('/admin/mapas')
                      ? 'text-white'
                      : 'text-gray-institutional hover:bg-guinda/10 hover:text-guinda'
                  }`}
                >
                  Mapas y Estadísticas
                </Link>
              )}
              {navLinks.map((link) => {
                const active = isActive(link.to)
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    data-active={active}
                    className={`relative z-10 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                      active
                        ? 'text-white'
                        : 'text-gray-institutional hover:bg-guinda/10 hover:text-guinda'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
              <Link
                to={user ? '/consultar' : '/consultar-curp'}
                data-active={isActive(user ? '/consultar' : '/consultar-curp')}
                className={`relative z-10 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive(user ? '/consultar' : '/consultar-curp')
                    ? 'text-white'
                    : 'text-gray-institutional hover:bg-guinda/10 hover:text-guinda'
                }`}
              >
                {user ? 'Consultar' : 'Consultar por CURP'}
              </Link>
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

          </div>
        </div>
      </header>

      <NavigationPanel
        open={navOpen}
        onClose={() => onNavToggle()}
      />


    </>
  )
}
