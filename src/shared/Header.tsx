/**
 * @file Header.tsx
 * @description Cabecera sticky de la aplicación. Muestra el logo de Puebla,
 * mosaico decorativo y navegación principal con indicador deslizante animado.
 * Características:
 *  - Navegación responsive: en desktop muestra links inline; en móvil/xlarge
 *    oculta la nav y muestra botón hamburguesa que abre `NavigationPanel`.
 *  - Indicador animado (pill guinda) que se posiciona bajo el link activo;
 *    mide DOM con `getBoundingClientRect`, observa cambios con `MutationObserver`,
 *    `ResizeObserver` implícito vía `resize` y `document.fonts`.
 *  - Autenticación: si hay `user` muestra links de admin y botón de logout.
 *  - `compactNav` detecta `data-font-size === 'xlarge'` para colapsar la nav
 *    aunque sea desktop (accesibilidad).
 *
 * @props HeaderProps
 * @prop {boolean} navOpen - Si el panel de navegación móvil está abierto.
 * @prop {() => void} onNavToggle - Callback para alternar el panel móvil.
 *
 * @uso Renderizado por `Layout` como cabecera fija.
 */
import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, LogOut } from 'lucide-react'
import logoPuebla from '../assets/Puebla.png'
import mosaico from '../assets/mosaico.svg'
import NavigationPanel from './NavigationPanel'
import { useAuth } from '../contexts/AuthContext'

/** Props del Header. */
interface HeaderProps {
  /** Indica si el NavigationPanel móvil está abierto (controlado por Layout). */
  navOpen: boolean
  /** Callback para alternar el estado del panel móvil. */
  onNavToggle: () => void
}

/** Links estáticos siempre visibles (no dependen de autenticación). */
const navLinks = [
  { to: '/', label: 'Inicio' },
  { to: '/nueva-solicitud', label: 'Nueva Solicitud' },
]

/**
 * Cabecera principal con logo, navegación, indicador activo y controles de sesión.
 */
export default function Header({
  navOpen,
  onNavToggle,
}: HeaderProps) {
  // Contexto de autenticación: usuario actual y función de cierre de sesión
  const { user, cerrarSesion } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  /** Ref al elemento <nav> para medir posición del indicador. */
  const navRef = useRef<HTMLElement>(null)
  /** Estado del indicador deslizante: posición left y ancho del link activo. */
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)
  /** Ref espejo de `indicator` para comparar sin causar re-render en medirIndicador. */
  const indicatorRef = useRef(indicator)
  indicatorRef.current = indicator

  /**
   * Determina si la navegación debe colapsar a modo móvil.
   * Cuando el tamaño de fuente es 'xlarge' los links no caben y se fuerza menú hamburguesa.
   */
  const compactNav = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-font-size') === 'xlarge'
    : false

  /**
   * Determina si un path está activo para resaltar el link.
   * Caso especial: '/admin' se considera activo para cualquier subruta de /admin
   * excepto /admin/mapas (que tiene su propio link).
   */
  function isActive(path: string) {
    if (path === '/admin') return location.pathname.startsWith('/admin') && location.pathname !== '/admin/mapas'
    return location.pathname === path
  }

  /**
   * Mide la posición y ancho del link activo y actualiza el estado `indicator`.
   * Solo actualiza si hay un cambio significativo (>1px) para evitar renders innecesarios.
   * Usa `getBoundingClientRect` relativo al contenedor nav.
   */
  function medirIndicador() {
    const nav = navRef.current
    if (!nav) return
    // Busca el elemento marcado con data-active="true"
    const active = nav.querySelector<HTMLElement>('[data-active="true"]')
    if (!active) return
    const activeRect = active.getBoundingClientRect()
    // Si el elemento aún no tiene dimensiones (render inicial), no actualizar
    if (activeRect.width === 0 || activeRect.height === 0) return
    const navRect = nav.getBoundingClientRect()
    const siguiente = { left: activeRect.left - navRect.left, width: activeRect.width }
    const actual = indicatorRef.current
    // Solo setea si hay diferencia perceptible para evitar bucles de render
    if (!actual || Math.abs(actual.left - siguiente.left) > 1 || Math.abs(actual.width - siguiente.width) > 1) {
      setIndicator(siguiente)
    }
  }

  /**
   * Efecto que mantiene el indicador sincronizado:
   * - Mide al montar y al cambiar de ruta/usuario.
   * - Re-mide tras 400ms (por si hay transición CSS pendiente).
   * - Escucha `resize`, `document.fonts` (carga de fuentes cambia medidas) y
   *   mutaciones de atributos `data-font-size` / `data-contrast` en <html>.
   * - Limpia todos los listeners al desmontar o cambiar dependencias.
   */
  useEffect(() => {
    medirIndicador()
    const t = setTimeout(medirIndicador, 400) // Segunda medición por si el layout aún no se estabilizó
    const alCambiarLayout = () => medirIndicador()
    // Si las fuentes aún cargan, re-medir cuando estén listas
    document.fonts?.ready.then(alCambiarLayout).catch(() => {})
    document.fonts?.addEventListener('loadingdone', alCambiarLayout)
    window.addEventListener('resize', alCambiarLayout)
    // Observa cambios de atributos de accesibilidad en <html> (font-size / contrast)
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
      {/* Header sticky con fondo semitransparente y blur */}
      <header className="sticky top-0 z-30 bg-white/80 shadow-header backdrop-blur-lg">
        <div className="relative mx-auto flex max-w-[1400px] items-center justify-between px-4 py-[11px] md:px-8 lg:px-12">
          {/* Mosaico decorativo institucional en la parte inferior del header */}
          <img src={mosaico} alt="" className="contrast-mosaico pointer-events-none absolute -bottom-[15px] left-0 w-full h-[31px]" />
          {/* Logo Puebla clickeable — navega al inicio */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex shrink-0 transition-opacity hover:opacity-80"
            title="Ir al inicio"
          >
            <img src={logoPuebla} alt="Puebla" className="h-8 w-auto" />
          </button>

          <div className="flex items-center gap-2">
            {/* Navegación desktop — oculta en móvil o cuando compactNav es true */}
            <nav
              ref={navRef}
              className={`${compactNav ? 'hidden' : 'hidden md:flex'} relative items-center gap-1`}
            >
              {/* Indicador deslizante guinda bajo el link activo */}
              {indicator && (
                <div
                  className="absolute bottom-1 top-1 rounded-xl bg-guinda shadow-button transition-all duration-300 ease-in-out"
                  style={{ left: indicator.left, width: indicator.width }}
                />
              )}
              {/* Link de administración — solo visible si hay sesión */}
              {user && (
                <Link
                  to="/admin"
                  data-active={isActive('/admin')} // Usado por medirIndicador para encontrar el activo
                  className={`relative z-10 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive('/admin')
                      ? 'text-white' // Activo: texto blanco sobre pill guinda
                      : 'text-gray-institutional hover:bg-guinda/10 hover:text-guinda'
                  }`}
                >
                  Peticiones
                </Link>
              )}
              {/* Link de mapas y estadísticas — solo con sesión */}
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
              {/* Links estáticos (Inicio, Nueva Solicitud) */}
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
              {/* Link de consulta — destino distinto según autenticación */}
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



            {/* Área de usuario autenticado: badge de rol + botón de logout */}
            {user && (
              <div className="flex items-center gap-2 border-r border-gray-200 pr-3">
                {/* Badge de rol — visible solo en desktop */}
                <span className="hidden text-xs text-gray-institutional/60 md:inline">
                  {user.rol === 'admin' ? 'Admin' : user.rol === 'diputado' ? 'Diputado' : user.rol === 'senador' ? 'Senador' : 'Revisor'}
                </span>
                <button
                  type="button"
                  onClick={() => { cerrarSesion(); navigate('/') }} // Cierra sesión y redirige al inicio
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-institutional/50 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Botón hamburguesa — visible en móvil o compactNav; cambia estilo si navOpen */}
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

      {/* Panel lateral de navegación para móvil (drawer izquierdo) */}
      <NavigationPanel
        open={navOpen}
        onClose={() => onNavToggle()}
      />


    </>
  )
}
