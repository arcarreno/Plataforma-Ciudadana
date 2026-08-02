import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, CheckCircle2 } from 'lucide-react'
import logoSemovinfra from '../assets/Logo_Semovinfra.jpg'
import { precargarCapasConProgreso, ALL_CAPAS } from '../solicitud/detectar-ubicacion'

const STORAGE_KEY = 'semovinfra_precarga_datos'

export default function ModalPrecarga() {
  const [show, setShow] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState('')
  const [pct, setPct] = useState(0)
  const iniciado = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(min-width: 768px)').matches) return
    if (sessionStorage.getItem(STORAGE_KEY)) return
    setShow(true)
  }, [])

  const iniciarDescarga = async () => {
    if (iniciado.current) return
    iniciado.current = true
    setDescargando(true)
    setError('')
    try {
      const { ok, fallos } = await precargarCapasConProgreso((done, total) => {
        setPct(total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0)
      })
      if (!ok) {
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
      setPct(100)
      setDescargando(false)
      setListo(true)
      sessionStorage.setItem(STORAGE_KEY, 'ok')
      setTimeout(() => setShow(false), 900)
    } catch {
      iniciado.current = false
      setDescargando(false)
      setError('Ocurrió un error al descargar. Revisa tu conexión e inténtalo de nuevo.')
    }
  }

  const cerrar = () => {
    if (descargando) return
    sessionStorage.setItem(STORAGE_KEY, 'skip')
    setShow(false)
  }

  if (!show) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        <button
          type="button"
          onClick={cerrar}
          disabled={descargando}
          className="absolute right-3 top-3 z-20 rounded-xl p-1.5 text-gray-institutional transition-colors hover:bg-gray-100 hover:text-guinda disabled:opacity-30"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

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

        <div className="bg-guinda px-4 pb-4 pt-4">
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
            {descargando && (
              <span
                className="absolute inset-y-0 left-0 bg-white/80 transition-[width] duration-200 ease-out"
                style={{ width: `${pct}%` }}
              />
            )}
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
