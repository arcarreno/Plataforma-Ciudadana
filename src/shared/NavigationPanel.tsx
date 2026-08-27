/**
 * @file NavigationPanel.tsx
 * @description Panel lateral de navegación (drawer izquierdo) para vista móvil
 * y modo `compactNav` (fuente xlarge). Se desliza con `translate-x` y muestra
 * un overlay semitransparente que cierra el panel al hacer clic.
 * Renderiza links condicionales según autenticación (`/admin`, `/admin/mapas`)
 * y links públicos (Inicio, Nueva Solicitud, Consultar). Cada link cierra el
 * panel al navegar. Usa `role="dialog"` y `aria-modal` para accesibilidad.
 *
 * @props NavigationPanelProps
 * @prop {boolean} open - Si el drawer está visible.
 * @prop {() => void} onClose - Callback para cerrar el panel (overlay, botón X, o navegación).
 *
 * @uso Controlado por `Header`/`Layout` vía `navOpen` y `onNavToggle`.
 */
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** Props del panel de navegación móvil. */
interface NavigationPanelProps {
  /** Indica si el panel está abierto/visible. */
  open: boolean
  /** Callback para cerrar el panel. */
  onClose: () => void
}

/** Links públicos siempre visibles en el drawer. */
const navLinks = [
  { to: '/', label: 'Inicio' },
  { to: '/nueva-solicitud', label: 'Nueva Solicitud' },
]

/**
 * Drawer lateral izquierdo de navegación.
 * Incluye overlay, cabecera con botón de cierre y lista de enlaces.
 */
export default function NavigationPanel({ open, onClose }: NavigationPanelProps) {
  // Usuario actual para mostrar/ocultar links de administración
  const { user } = useAuth()
  const location = useLocation()

  return (
    <>
      {/* Overlay semitransparente — solo visible cuando open=true; clic cierra el panel */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer lateral — transición de deslizamiento horizontal */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-alabaster-dark/50 bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Panel de navegación"
        role="dialog"
        aria-modal={open}
      >
        {/* Cabecera del drawer: título + botón X de cierre */}
        <div className="flex items-center justify-between border-b border-alabaster-dark/30 px-5 py-4">
          <h2 className="font-semibold text-guinda">Menú</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-institutional transition-colors hover:bg-guinda/10 hover:text-guinda"
            aria-label="Cerrar menú"
          >
            {/* Icono X SVG inline */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Lista de navegación — flex-1 para empujar el footer del drawer al fondo */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          {/* Link a Peticiones (admin) — solo si hay sesión */}
          {user && (
            <Link
              to="/admin"
              onClick={onClose} // Cierra el drawer al navegar
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                location.pathname.startsWith('/admin') && location.pathname !== '/admin/mapas'
                  ? 'bg-guinda text-white shadow-button' // Activo: fondo guinda
                  : 'text-gray-institutional hover:bg-guinda/10 hover:text-guinda'
              }`}
            >
              Peticiones
            </Link>
          )}
          {/* Link a Mapas y Estadísticas — solo con sesión */}
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
          {/* Links públicos mapeados — resalta el activo con fondo guinda */}
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

          {/* Link de consulta — varia según autenticación */}
          <Link
            to={user ? '/consultar' : '/consultar-curp'}
            onClick={onClose}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
              location.pathname === (user ? '/consultar' : '/consultar-curp')
                ? 'bg-guinda text-white shadow-button'
                : 'text-gray-institutional hover:bg-guinda/10 hover:text-guinda'
            }`}
          >
            {user ? 'Consultar' : 'Consultar por CURP'}
          </Link>

          {/* Pie del drawer — mt-auto lo ancla al fondo */}
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
