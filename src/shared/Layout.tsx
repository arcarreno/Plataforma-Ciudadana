/**
 * @file Layout.tsx
 * @description Layout principal de la aplicación — envoltorio global que compone
 * `Header`, `Footer`, área de contenido con `<Outlet>` de react-router y paneles
 * flotantes. Gestiona:
 *  - Estados de accesibilidad: tamaño de fuente (`FontSize`), contraste (`Contrast`),
 *    TalkBack (lectura en voz alta) y tipo de voz.
 *  - Navegación: apertura/cierre del panel lateral de navegación.
 *  - Botón flotante de accesibilidad: arrastrable con Pointer Events, con botón
 *    de descarte (ocultar) y apertura del `AccessibilityPanel`.
 *  - Animación de transición entre rutas con `framer-motion`.
 *  - Toast notifications vía `sileo` (Toaster).
 *
 * Usa `document.documentElement.getAttribute` para inicializar fontSize/contrast
 * desde atributos ya seteados en el DOM (hidratación / persistencia externa).
 * El botón flotante usa `btnRef` + `dragRef` para implementar drag sin librerías.
 *
 * @uso Se monta como `element` del route raíz en react-router; las páginas hijas
 * se renderizan dentro de `<Outlet />`.
 */
import { useEffect, useState, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Toaster } from 'sileo'
import 'sileo/styles.css'
import type { FontSize, Contrast, VoiceType } from '../core/theme'
import { useTalkBack } from '../hooks/useTalkBack'
import Header from './Header'
import Footer from './Footer'
import AccessibilityPanel from './AccessibilityPanel'

/**
 * Componente Layout — estructura global de la app.
 * No recibe props; todo el estado es interno y se propaga a Header/Footer/Panel.
 */
export default function Layout() {
  // Hooks de router para animación de ruta y navegación programática
  const location = useLocation()
  const navigate = useNavigate()
  /**
   * Estado de tamaño de fuente. Inicializador lazy: lee `data-font-size` del
   * `<html>` si existe (seteado por persistencia/SSR), si no usa 'normal'.
   */
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (typeof document !== 'undefined'
      ? (document.documentElement.getAttribute('data-font-size') as FontSize)
      : null) ?? 'normal'
  })

  /**
   * Estado de contraste (light/high). Mismo patrón de inicialización que fontSize.
   */
  const [contrast, setContrast] = useState<Contrast>(() => {
    return (typeof document !== 'undefined'
      ? (document.documentElement.getAttribute('data-contrast') as Contrast)
      : null) ?? 'light'
  })

  /** Si la lectura en voz alta (TalkBack) está activa. */
  const [talkBackEnabled, setTalkBackEnabled] = useState(false)
  /** Tipo de voz para TalkBack: femenina o masculina. */
  const [voiceType, setVoiceType] = useState<VoiceType>('female')
  /** Controla apertura del panel de navegación lateral (Header). */
  const [navOpen, setNavOpen] = useState(false)
  /** Controla apertura del panel de accesibilidad flotante. */
  const [panelOpen, setPanelOpen] = useState(false)
  /** Si el botón flotante de accesibilidad está oculto por el usuario (botón X). */
  const [hideBtn, setHideBtn] = useState(false)
  /** Posición absoluta del botón flotante cuando ha sido arrastrado (null = posición por defecto bottom-6 right-6). */
  const [btnPos, setBtnPos] = useState<{ x: number; y: number } | null>(null)
  /** Ref al elemento del botón flotante para medir bounding rect y setPointerCapture. */
  const btnRef = useRef<HTMLButtonElement>(null)
  /**
   * Ref mutable para estado de arrastre (no dispara re-render).
   * Guarda si se está arrastrando, coords iniciales del pointer y posición original del botón.
   */
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, origX: 0, origY: 0 })

  /**
   * Hook que activa la funcionalidad de TalkBack: al habilitarse, intercepta
   * clics en textos/botones y los lee en voz alta con la voz seleccionada.
   */
  useTalkBack(talkBackEnabled, voiceType)

  /**
   * Efecto: sincroniza el estado `fontSize` con el atributo `data-font-size`
   * en `<html>`. El CSS global reacciona a este atributo para escalar fuentes.
   */
  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize)
  }, [fontSize])

  /**
   * Efecto: sincroniza el estado `contrast` con `data-contrast` en `<html>`.
   * El sistema de contraste lee este atributo para aplicar tema oscuro/claro.
   */
  useEffect(() => {
    document.documentElement.setAttribute('data-contrast', contrast)
  }, [contrast])

  return (
    <div className="flex min-h-screen flex-col">
      {/* Cabecera sticky con navegación y botón de menú hamburguesa */}
      <Header
        navOpen={navOpen}
        onNavToggle={() => setNavOpen((p) => !p)} // Toggle del panel de navegación
      />
            {/* Área principal de contenido — max-width centrado, animada con framer-motion por cambio de ruta */}
            <main className="mx-auto w-full max-w-[1400px] flex-1 overflow-x-hidden px-4 py-6 md:px-8 lg:px-12">
        <motion.div
          key={location.pathname} // Key por pathname fuerza re-animación al navegar
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="h-full"
        >
          {/* Outlet de react-router donde se renderiza la página hija */}
          <Outlet />
        </motion.div>
      </main>
      {/* Pie de página con logo/slogan y login */}
      <Footer />
      {/* Contenedor de toasts globales (librería sileo) */}
      <Toaster
        position="top-center"
        options={{ fill: '#ffffff', roundness: 14, duration: 5000, autopilot: true }}
      />

      {/* Botón flotante de accesibilidad — arrastrable con Pointer Events, con botón de descarte */}
      <button
        ref={btnRef}
        type="button"
        // Solo abre el panel si no hubo arrastre (evita abrir al soltar después de drag)
        onClick={() => { if (!dragRef.current.isDragging) setPanelOpen(true) }}
        onPointerDown={(e) => {
          // Ignora pointerDown si se hizo sobre el botón de cerrar (X) interno
          if ((e.target as HTMLElement).closest('[data-dismiss-btn]')) return
          const btn = btnRef.current
          if (!btn) return
          // Captura el pointer para recibir move/up aunque el cursor salga del botón
          btn.setPointerCapture(e.pointerId)
          const rect = btn.getBoundingClientRect()
          // Guarda posición inicial del pointer y posición original del botón
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
          // Si no hay inicio registrado, no hacer nada
          if (!d.startX && !d.startY) return
          const dx = e.clientX - d.startX
          const dy = e.clientY - d.startY
          // Umbral de 4px para considerar que es un drag y no un clic
          if (!d.isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
            d.isDragging = true
          }
          if (d.isDragging) {
            // Actualiza posición del botón sumando desplazamiento al origen
            setBtnPos({ x: d.origX + dx, y: d.origY + dy })
          }
        }}
        onPointerUp={() => {
          // Resetea estado de arrastre al soltar
          dragRef.current = { isDragging: false, startX: 0, startY: 0, origX: 0, origY: 0 }
        }}
        aria-label="Abrir panel de accesibilidad"
        // Posición fija si no hay btnPos (bottom-6 right-6), o absoluta con left/top si fue arrastrado
        className={`group fixed z-50 flex touch-none select-none items-center justify-center rounded-full bg-guinda p-3 text-white shadow-xl transition-all duration-300 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-guinda/50 focus:ring-offset-2 ${
          btnPos ? 'cursor-grab active:cursor-grabbing' : 'bottom-6 right-6 cursor-grab active:cursor-grabbing'
        } ${
          hideBtn ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        }`}
        style={btnPos ? { left: btnPos.x, top: btnPos.y } : undefined}
      >
        {/* Icono de figura humana (accesibilidad) — SVG inline */}
        <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 pointer-events-none" aria-hidden="true">
          <circle cx="13" cy="13" r="11" />
          <circle cx="13" cy="5.5" r="2" />
          <line x1="13" y1="9" x2="13" y2="15" />
          <line x1="9.5" y1="10" x2="5.5" y2="7.5" />
          <line x1="16.5" y1="10" x2="20.5" y2="7.5" />
          <line x1="13" y1="15" x2="9.5" y2="20.5" />
          <line x1="13" y1="15" x2="16.5" y2="20.5" />
        </svg>

        {/* Botón pequeño "X" para ocultar el botón flotante (aparece al hover del grupo) */}
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

      {/* Panel lateral de accesibilidad (drawer derecho) */}
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
          // Cierra el panel y navega a nueva solicitud en modo IA (timestamp para forzar remount)
          setPanelOpen(false)
          navigate(`/nueva-solicitud?ia=${Date.now()}`)
        }}
      />
    </div>
  )
}
