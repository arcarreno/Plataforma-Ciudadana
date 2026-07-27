import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface NavigationPanelProps {
  open: boolean
  onClose: () => void
}

const navLinks = [
  { to: '/', label: 'Inicio' },
  { to: '/nueva-solicitud', label: 'Nueva Solicitud' },
  { to: '/consultar-folio', label: 'Consultar Folio' },
]

export default function NavigationPanel({ open, onClose }: NavigationPanelProps) {
  const { user } = useAuth()
  const location = useLocation()

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
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-alabaster-dark/50 bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Panel de navegación"
        role="dialog"
        aria-modal={open}
      >
        <div className="flex items-center justify-between border-b border-alabaster-dark/30 px-5 py-4">
          <h2 className="font-semibold text-guinda">Menú</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-institutional transition-colors hover:bg-guinda/10 hover:text-guinda"
            aria-label="Cerrar menú"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          {user && (
            <Link
              to="/admin"
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
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
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
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
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-guinda text-white shadow-button'
                    : 'text-gray-institutional hover:bg-guinda/10 hover:text-guinda'
                }`}
              >
                {link.label}
              </Link>
            )
          })}

          <div className="mt-auto border-t border-alabaster-dark/30 pt-4">
            <p className="px-4 text-xs text-gray-institutional/40">
              Plataforma Ciudadana
            </p>
          </div>
        </nav>
      </aside>
    </>
  )
}
