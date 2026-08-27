/**
 * @file ModalPrecarga.tsx
 * @description Modal de precarga de capas geográficas pesadas para el mapa.
 * Se muestra automáticamente al cargar la app bajo ciertas condiciones:
 *  - Solo en móvil (`matchMedia('(min-width: 768px)').matches === false` → no en desktop).
 *  - Solo si no hay valor previo en `sessionStorage` con la clave `semovinfra_precarga_datos`
 *    (evita mostrarlo de nuevo en la misma sesión si el usuario ya eligió descargar u omitir).
 * Gestiona descarga con progreso vía `precargarCapasConProgreso` (callback `done/total` → %),
 * estados de `descargando` / `listo` / `error` y guarda `ok` o `skip` en sessionStorage.
 * Usa `createPortal` a `document.body` para overlay full-screen y `useRef` (`iniciado`)
 * para evitar doble ejecución si el usuario hace doble clic en "Descargar".
 * El botón de descarga muestra barra de progreso animada (span con `width: pct%`).
 *
 * @uso Se monta de forma autónoma (sin props) típicamente en el Layout o App root;
 * se auto-gestiona y se oculta solo tras completar o descartar.
 *
 * @portal `createPortal(..., document.body)` para que el overlay cubra toda la viewport
 * sin verse afectado por overflow/z-index de contenedores padres.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, CheckCircle2 } from 'lucide-react'
import logoSemovinfra from '../assets/Logo_Semovinfra.jpg'
import { precargarCapasConProgreso, ALL_CAPAS } from '../solicitud/detectar-ubicacion'

/** Clave de sessionStorage para recordar si el usuario ya vio/interactuó con el modal. */
const STORAGE_KEY = 'semovinfra_precarga_datos'

/**
 * Modal de descarga de datos geográficos.
 * No recibe props; su visibilidad se controla internamente con `show`.
 */
export default function ModalPrecarga() {
  /** Si el modal está visible. */
  const [show, setShow] = useState(false)
  /** Si la descarga está en curso (deshabilita cerrar y cambia UI del botón). */
  const [descargando, setDescargando] = useState(false)
  /** Si la descarga completó con éxito (muestra check y mensaje de listo). */
  const [listo, setListo] = useState(false)
  /** Mensaje de error si la descarga falló (permite reintentar). */
  const [error, setError] = useState('')
  /** Porcentaje de progreso 0–100 para la barra visual. */
  const [pct, setPct] = useState(0)
  /** Ref para evitar doble inicio de descarga por doble clic (guard contra race). */
  const iniciado = useRef(false)

  /**
   * Efecto de montaje: decide si mostrar el modal.
   * Condiciones para NO mostrar:
   *  - SSR (`window` undefined).
   *  - Desktop (ancho >= 768px) — en desktop no se necesita precarga inmediata.
   *  - Ya existe valor en sessionStorage (usuario ya descargó u omitió en esta sesión).
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(min-width: 768px)').matches) return
    if (sessionStorage.getItem(STORAGE_KEY)) return
    setShow(true)
  }, [])

  /**
   * Inicia la descarga de todas las capas geográficas.
   * Usa `precargarCapasConProgreso` que reporta progreso vía callback.
   * Maneja tres escenarios: éxito (ok), fallo parcial (ok=false con lista de fallos),
   * y excepción de red. En fallo resetea `iniciado` para permitir reintento.
   */
  const iniciarDescarga = async () => {
    if (iniciado.current) return // Guard contra doble ejecución
    iniciado.current = true
    setDescargando(true)
    setError('')
    try {
      // Llama a la función de precarga que invoca el callback por cada capa completada
      const { ok, fallos } = await precargarCapasConProgreso((done, total) => {
        setPct(total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0)
      })
      if (!ok) {
        // Fallo parcial: resetea guard y estados para permitir reintentar
        iniciado.current = false
        setDescargando(false)
        const que = fallos?.length
          ? ` (${fallos.map(f => f.split('/').pop()).join(', ')})`
          : ''
        setError(
          `No se pudieron descargar ${fallos?.length ?? 0} de ${ALL_CAPAS.length} capas${que}. Revisa tu conexión e inténtalo de nuevo.`
        )
        return
      }
      // Éxito completo
      setPct(100)
      setDescargando(false)
      setListo(true)
      sessionStorage.setItem(STORAGE_KEY, 'ok') // Marca como completado para no volver a mostrar
      setTimeout(() => setShow(false), 900) // Auto-cierra tras 900ms mostrando "Datos listos"
    } catch {
      // Error de red / excepción inesperada
      iniciado.current = false
      setDescargando(false)
      setError('Ocurrió un error al descargar. Revisa tu conexión e inténtalo de nuevo.')
    }
  }

  /**
   * Cierra el modal sin descargar.
   * No permite cerrar mientras `descargando` es true.
   * Guarda 'skip' en sessionStorage para no volver a mostrar en esta sesión.
   */
  const cerrar = () => {
    if (descargando) return
    sessionStorage.setItem(STORAGE_KEY, 'skip')
    setShow(false)
  }

  // Si no debe mostrarse, no renderiza nada
  if (!show) return null

  // Portal a body para overlay de pantalla completa
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      {/* Tarjeta del modal — ancho máximo 448px */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Botón X de cierre — deshabilitado durante descarga */}
        <button
          type="button"
          onClick={cerrar}
          disabled={descargando}
          className="absolute right-3 top-3 z-20 rounded-xl p-1.5 text-gray-institutional transition-colors hover:bg-gray-100 hover:text-guinda disabled:opacity-30"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Cabecera: logo + título + descripción explicativa */}
        <div className="flex flex-col items-center px-6 pb-5 pt-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center">
            <img src={logoSemovinfra} alt="Semovinfra" className="h-14 w-14 rounded-full object-cover" />
          </div>
          <h2 className="mt-3 text-lg font-semibold text-guinda">Descarga de datos</h2>
          <p className="mt-2 text-xs leading-relaxed text-gray-institutional/70">
            Debido a que usamos capas pesadas para extraer la información del mapa a
            nuestra base de datos, necesitamos descargar los datos ahora mismo para
            garantizar que tu experiencia sea la mejor.
          </p>
        </div>

        {/* Zona inferior guinda con botón de acción y mensaje de estado */}
        <div className="bg-guinda px-4 pb-4 pt-4">
          {/* Botón principal — cambia apariencia según estado (idle/descargando/listo) */}
          <button
            type="button"
            onClick={iniciarDescarga}
            disabled={descargando}
            className={`relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-semibold transition-all duration-300 ${
              descargando || listo
                ? 'bg-guinda border-2 border-white/40'
                : 'bg-white text-guinda shadow-button hover:brightness-105'
            }`}
          >
            {/* Barra de progreso — span absoluto cuyo ancho crece con pct */}
            {descargando && (
              <span
                className="absolute inset-y-0 left-0 bg-white/80 transition-[width] duration-200 ease-out"
                style={{ width: `${pct}%` }}
              />
            )}
            {/* Contenido del botón — color de texto adapta contraste según progreso */}
            <span
              className={`relative z-10 flex items-center gap-2 transition-colors duration-150 ${
                listo || (descargando && pct < 50) ? 'text-white' : descargando ? 'text-guinda' : 'text-guinda'
              }`}
            >
              {listo ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : descargando ? (
                <span className="text-xs">{pct}%</span>
              ) : (
                <Download className="h-4 w-4" />
              )}
              {listo ? 'Datos listos' : descargando ? 'Descargando…' : error ? 'Reintentar descarga' : 'Descargar datos'}
            </span>
          </button>
          {/* Mensaje de estado bajo el botón — cambia según error/listo/descargando */}
          <p className={`mt-2 text-center text-[11px] ${error ? 'text-yellow-200' : 'text-white/70'}`}>
            {error
              ? error
              : listo
                ? 'Todo listo, el mapa funcionará al 100%'
                : descargando
                  ? 'Preparando las capas geográficas…'
                  : 'Solo toma unos segundos la primera vez'}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
