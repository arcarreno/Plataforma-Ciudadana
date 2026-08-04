import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { X, PersonStanding, Loader2 } from 'lucide-react'

const MAPILLARY_TOKEN = import.meta.env.VITE_MAPILLARY_TOKEN ?? ''

interface StreetViewProps {
  active: boolean
  initialPoint: [number, number]
}

interface Point {
  lat: number
  lng: number
}

type MapillaryModule = typeof import('mapillary-js')
type MlyViewer = InstanceType<MapillaryModule['Viewer']>

interface MlyErrorEmitter {
  on(type: string, handler: (event: unknown) => void): void
}

const monitoIcon = L.divIcon({
  className: '',
  html: `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:34px;background:#7d2447;border-radius:9px;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid #fff"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/></svg></div>`,
  iconSize: [26, 34],
  iconAnchor: [13, 30],
})

function MonitoMarker({ initial, onDrop }: { initial: Point; onDrop: (p: Point) => void }) {
  const map = useMap()
  const markerRef = useRef<L.Marker | null>(null)
  const onDropRef = useRef(onDrop)

  useEffect(() => {
    onDropRef.current = onDrop
  }, [onDrop])

  useEffect(() => {
    const m = L.marker([initial.lat, initial.lng], { icon: monitoIcon, draggable: true }).addTo(map)
    markerRef.current = m
    const handle = () => {
      const p = m.getLatLng()
      onDropRef.current({ lat: p.lat, lng: p.lng })
    }
    m.on('dragend', handle)
    return () => {
      m.off('dragend', handle)
      m.remove()
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  useEffect(() => {
    markerRef.current?.setLatLng([initial.lat, initial.lng])
  }, [initial.lat, initial.lng])

  return null
}

function MapillaryViewer({ imageId, onClose }: { imageId: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewerError, setViewerError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    let viewer: MlyViewer | null = null
    async function init() {
      try {
        const mod: MapillaryModule = await import('mapillary-js')
        await import('mapillary-js/dist/mapillary.css')
        if (disposed || !containerRef.current) return
        viewer = new mod.Viewer({
          accessToken: MAPILLARY_TOKEN,
          container: containerRef.current,
          imageId,
          component: { cover: false },
        })
        ;(viewer as unknown as MlyErrorEmitter).on('error', () => {})
        setTimeout(() => viewer?.resize(), 120)
      } catch {
        setViewerError('No se pudo cargar el visor de Mapillary')
      }
    }
    init()
    return () => {
      disposed = true
      try { viewer?.remove() } catch { /* ignore */ }
    }
  }, [imageId])

  return createPortal(
    <div className="fixed inset-0 z-[10002] flex items-stretch justify-end">
      <div className="flex h-full w-full flex-col bg-white shadow-xl sm:w-[440px]">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-guinda">
            <PersonStanding className="h-4 w-4" />
            Vista a nivel de calle
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-guinda"
            aria-label="Cerrar vista a nivel de calle"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {viewerError ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-red-500">
            {viewerError}
          </div>
        ) : (
          <div ref={containerRef} className="min-h-0 flex-1" />
        )}
        <div className="border-t border-gray-100 px-4 py-2 text-[10px] text-gray-400">
          Fotografías:{' '}
          <a
            href="https://www.mapillary.com"
            target="_blank"
            rel="noreferrer"
            className="text-guinda underline"
          >
            Mapillary
          </a>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function StreetView({ active, initialPoint }: StreetViewProps) {
  const [point, setPoint] = useState<Point>({ lat: initialPoint[0], lng: initialPoint[1] })
  const [imageId, setImageId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'notfound' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const buscarImagen = useCallback(async (lat: number, lng: number) => {
    if (!MAPILLARY_TOKEN) {
      setStatus('error')
      setMsg('Mapillary no configurado (VITE_MAPILLARY_TOKEN)')
      return
    }
    setStatus('searching')
    setMsg('Buscando fotografía cercana...')
    try {
      const params = new URLSearchParams({
        access_token: MAPILLARY_TOKEN,
        fields: 'id,geometry,captured_at,compass_angle',
        lat: String(lat),
        lng: String(lng),
        radius: '50',
        limit: '1',
      })
      const res = await fetch(`https://graph.mapillary.com/images?${params}`)
      const json = await res.json()
      let found: string | null = json?.data?.[0]?.id ?? null
      if (!found) {
        const d = 0.003
        const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`
        const res2 = await fetch(
          `https://graph.mapillary.com/images?access_token=${MAPILLARY_TOKEN}&fields=id&bbox=${bbox}&limit=1`
        )
        const json2 = await res2.json()
        found = json2?.data?.[0]?.id ?? null
      }
      if (found) {
        setImageId(String(found))
        setStatus('found')
        setMsg('')
      } else {
        setImageId(null)
        setStatus('notfound')
        setMsg('No hay fotografías cercanas (50 m). Prueba más cerca de la vialidad.')
      }
    } catch {
      setImageId(null)
      setStatus('error')
      setMsg('Error al consultar Mapillary')
    }
  }, [])

  const handlePoint = useCallback(
    (p: Point) => {
      setPoint(p)
      buscarImagen(p.lat, p.lng)
    },
    [buscarImagen]
  )

  useMapEvents({
    click(e) {
      if (active) {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng }
        setPoint(p)
        buscarImagen(p.lat, p.lng)
      }
    },
  })

  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => {
      buscarImagen(point.lat, point.lng)
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <>
      {active && <MonitoMarker initial={point} onDrop={handlePoint} />}
      {active && status !== 'found' && status !== 'idle' && (
        <div className="absolute left-3 top-16 z-[10005] max-w-[300px] rounded-xl bg-white/95 px-3 py-2 shadow-lg">
          <div className="flex items-start gap-2 text-xs text-gray-institutional">
            {status === 'searching' && (
              <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-guinda" />
            )}
            {status === 'notfound' && (
              <PersonStanding className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            )}
            {status === 'error' && (
              <PersonStanding className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
            )}
            <span>{msg}</span>
          </div>
        </div>
      )}
      {imageId && status === 'found' && (
        <MapillaryViewer imageId={imageId} onClose={() => setStatus('idle')} />
      )}
    </>
  )
}
