import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap, useMapEvents, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import { X, Crosshair, MapPin, Info, Layers, Eye, EyeOff, Globe, Map, Navigation, Ruler, School, Church, Bus, Undo2, Check, ChevronRight, HelpCircle, LocateFixed } from 'lucide-react'
import Button from '../shared/Button'
import { correrTour, detenerTour } from './guiaTour'
import { cargarCapas, detectarPunto, detectarTramo } from './detectar-ubicacion'
import type { CapasGeoJSON, DeteccionPunto, DeteccionTramo } from './detectar-ubicacion'
import { geolocalizarCalle, cargarCalles } from '../lib/geolocalizarCalle'
import type { CalleInfo } from '../lib/geolocalizarCalle'
import logoSrc from '../assets/Logo_Semovinfra.jpg'

const DEFAULT_CENTER: [number, number] = [19.043702, -98.198194]
const DEFAULT_ZOOM = 13

const COLONIA_STYLE = { color: '#7d2447', weight: 2, fillColor: '#7d2447', fillOpacity: 0.08 }
const JUNTA_STYLE = { color: '#2c6b2f', weight: 3, fillColor: '#2c6b2f', fillOpacity: 0.05 }
const ZONA_ZAP_STYLE = { color: '#b8860b', weight: 2, fillColor: '#b8860b', fillOpacity: 0.06 }

const icon = L.divIcon({
  className: '',
  html: `<svg viewBox="0 0 32 48" width="28" height="42" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 10.6 12.8 26.6 14.6 28.8.6.8 1.8.8 2.4 0C18.8 42.6 32 26.6 32 16 32 7.16 24.84 0 16 0z" fill="#7D2447"/>
    <circle cx="16" cy="16" r="10" fill="white" opacity="0.9"/>
    <circle cx="16" cy="16" r="8" fill="#7D2447"/>
  </svg>`,
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -42],
})

type Step = 'punto' | 'tramo'

interface PinData {
  lat: number; lng: number; colonia: string; junta_auxiliar: string
  calle: string; entre_calles: string; zona_zap: boolean; cobertura_agua: boolean
}

interface TramoResult {
  lat_ini: number; lng_ini: number; lat_fin: number; lng_fin: number
  puntos: { lat: number; lng: number }[]
  distancia_m: number; ancho_calle_m: number
  escuelas_cercanas: string[]; iglesias_cercanas: string[]; transportes_cercanos: string[]
}

export interface MapaCombinadoResult {
  pin: PinData
  tramo?: TramoResult
}

interface MapaCombinadoProps {
  onConfirm: (data: MapaCombinadoResult) => void
  onClose: () => void
  initialLat?: string
  initialLng?: string
  inline?: boolean
  onPaso1?: () => void
}

function TramoMarker({ position, label }: { position: L.LatLngExpression; label: number }) {
  const map = useMap()
  useEffect(() => {
    const m = L.marker(position, {
      icon: L.divIcon({
        className: 'flex items-center justify-center',
        html: `<div style="width:24px;height:24px;border-radius:50%;background:#7d2447;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${label}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map)
    return () => { m.remove() }
  }, [map, position, label])
  return null
}

function ResizeHandler({ inline }: { inline?: boolean }) {
  const map = useMap()
  const firstValid = useRef(true)
  useEffect(() => {
    const el = map.getContainer()
    const resize = () => {
      map.invalidateSize()
      if (firstValid.current && el.offsetWidth > 200) {
        firstValid.current = false
        if (map.getZoom() < 10) {
          map.setZoom(13)
        }
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    const timers: ReturnType<typeof setTimeout>[] = []
    if (inline) {
      timers.push(
        setTimeout(resize, 100),
        setTimeout(resize, 400),
        setTimeout(resize, 800),
        setTimeout(resize, 1200),
        setTimeout(resize, 1600),
      )
    } else {
      timers.push(setTimeout(resize, 1200))
      resize()
    }
    return () => {
      ro.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [map, inline])
  return null
}

function ZoomTracker({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMap()
  useEffect(() => {
    const report = () => onZoom(map.getZoom())
    report()
    map.on('zoomend', report)
    return () => {
      map.off('zoomend', report)
    }
  }, [map, onZoom])
  return null
}

function LocateOnMount({
  onLocated,
  onLocateError,
  userRequested,
}: {
  onLocated?: (latlng: { lat: number; lng: number }) => void
  onLocateError?: (msg: string) => void
  userRequested: React.MutableRefObject<boolean>
}) {
  const map = useMap()
  useEffect(() => {
    const marker = L.circleMarker([0, 0], {
      radius: 8,
      fillColor: '#3b82f6',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    })
    const circle = L.circle([0, 0], {
      radius: 100,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
      weight: 1,
    })

    let highAccuracyFallback = true

    const onFound = (e: L.LocationEvent) => {
      marker.setLatLng(e.latlng).addTo(map)
      circle.setLatLng(e.latlng).setRadius(e.accuracy ?? 100).addTo(map)
      map.setView(e.latlng, 16)
      map.stopLocate()
      onLocated?.({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
    const onError = (err: L.ErrorEvent) => {
      // codigo 1 = PERMISSION_DENIED: reintentar no ayuda
      if (err.code !== 1 && highAccuracyFallback) {
        highAccuracyFallback = false
        map.locate({ enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 })
        return
      }
      // Solo mostrar mensaje cuando el usuario presiono el boton
      // (el auto-locate de montaje debe ser silencioso)
      if (userRequested.current) {
        onLocateError?.(
          err.code === 1
            ? 'Permiso de ubicación denegado. Actívalo en la configuración del navegador y vuelve a intentar.'
            : 'No se pudo obtener tu ubicación. Revisa que tengas GPS/ubicación activada.'
        )
      }
    }

    map.on('locationfound', onFound)
    map.on('locationerror', onError)
    map.locate({ enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 })

    return () => {
      map.stopLocate()
      map.off('locationfound', onFound)
      map.off('locationerror', onError)
      marker.remove()
      circle.remove()
    }
  }, [map, onLocated, onLocateError, userRequested])
  return null
}

function ClickHandler({
  stepRef,
  onPuntoClick,
  onTramoClick,
}: {
  stepRef: React.RefObject<Step | null>
  onPuntoClick: (latlng: { lat: number; lng: number }) => void
  onTramoClick: (latlng: { lat: number; lng: number }) => void
}) {
  useMapEvents({
    click(e) {
      if (stepRef.current === 'punto') {
        onPuntoClick(e.latlng)
      } else {
        onTramoClick(e.latlng)
      }
    },
  })
  return null
}

export default function MapaCombinado({ onConfirm, onClose, initialLat, initialLng, inline, onPaso1 }: MapaCombinadoProps) {
  const [capas, setCapas] = useState<CapasGeoJSON | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>(initialLat && initialLng ? 'tramo' : 'punto')
  const stepRef = useRef<Step>(step)
  stepRef.current = step
  const paso1TourFired = useRef(false)
  const mapRef = useRef<L.Map | null>(null)
  const userRequestedLocate = useRef(false)
  const [locating, setLocating] = useState(false)
  const [locateMsg, setLocateMsg] = useState<string | null>(null)

  const localizar = useCallback(() => {
    const map = mapRef.current
    if (!map || locating) return
    if (!('geolocation' in navigator)) {
      setLocateMsg('Tu navegador no soporta geolocalización.')
      return
    }
    userRequestedLocate.current = true
    setLocating(true)
    setLocateMsg(null)
    map.locate({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }, [locating])

  const handleLocateError = useCallback((msg: string) => {
    setLocating(false)
    setLocateMsg(msg)
  }, [])

  useEffect(() => {
    if (loading || paso1TourFired.current) return
    paso1TourFired.current = true
    if (onPaso1) onPaso1()
  }, [loading, onPaso1])

  useEffect(() => () => detenerTour(), [])

  const [showLayers, setShowLayers] = useState(false)
  const [satellite, setSatellite] = useState(false)
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM)

  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: parseFloat(initialLat), lng: parseFloat(initialLng) } : null
  )
  const [detection, setDetection] = useState<DeteccionPunto | null>(null)
  const [hasPicado, setHasPicado] = useState(false)
  const [manualColonia, setManualColonia] = useState('')
  const [manualJunta, setManualJunta] = useState('')
  const [calleInfo, setCalleInfo] = useState<CalleInfo | null>(null)
  const [buscandoCalle, setBuscandoCalle] = useState(false)
  const [manualCalle, setManualCalle] = useState('')
  const [manualEntreCalles, setManualEntreCalles] = useState('')
  const lastClick = useRef<{ lat: number; lng: number } | null>(null)
  const pinDataRef = useRef<PinData | null>(null)

  const [tramoPoints, setTramoPoints] = useState<{ lat: number; lng: number }[]>([])
  const [tramoDetection, setTramoDetection] = useState<DeteccionTramo | null>(null)
  const [tramoDone, setTramoDone] = useState(false)
  const [tramoError, setTramoError] = useState<string | null>(null)
  const [tramoConfirmed, setTramoConfirmed] = useState(false)
  const [showTramoInfoCard, setShowTramoInfoCard] = useState(false)
  const tramoCalcTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (tramoCalcTimer.current) clearTimeout(tramoCalcTimer.current)
    }
  }, [])

  const programarDeteccionTramo = (puntos: { lat: number; lng: number }[]) => {
    if (tramoCalcTimer.current) clearTimeout(tramoCalcTimer.current)
    if (puntos.length < 2 || !capas) {
      setTramoDetection(null)
      return
    }
    tramoCalcTimer.current = setTimeout(() => {
      setTramoDetection(detectarTramo(puntos, capas))
      tramoCalcTimer.current = null
    }, 150)
  }

  useEffect(() => {
    cargarCapas(['colonias', 'juntas', 'zonasZap', 'escuelas', 'iglesias', 'stv', 'coberturaAgua']).then(c => {
      setCapas(c)
      if (inline) {
        setTimeout(() => setLoading(false), 1500)
      } else {
        setLoading(false)
      }
    })
  }, [inline])

  const handlePuntoClick = useCallback((latlng: { lat: number; lng: number }) => {
    setMarker(latlng)
    lastClick.current = latlng
    setHasPicado(false)
    setDetection(null)
  }, [])

  const handleLocated = useCallback((latlng: { lat: number; lng: number }) => {
    setLocating(false)
    setLocateMsg(null)
    if (stepRef.current === 'punto') {
      handlePuntoClick(latlng)
    }
  }, [handlePuntoClick])

  const handleTramoClick = useCallback((latlng: { lat: number; lng: number }) => {
    if (tramoDone) return
    if (!marker) return

    const markerLL = L.latLng(marker.lat, marker.lng)
    const clickLL = L.latLng(latlng.lat, latlng.lng)
    const distM = markerLL.distanceTo(clickLL)
    const limit = tramoPoints.length === 0 ? 500 : 5000

    if (distM > limit) {
      const label = limit === 500 ? '500 m' : '5 km'
      setTramoError(`El punto está a ${Math.round(distM)} m del marcador (máximo ${label})`)
      return
    }
    setTramoError(null)
    setTramoConfirmed(false)

    const next = [...tramoPoints, latlng]
    setTramoPoints(next)
    programarDeteccionTramo(next)
  }, [tramoPoints, tramoDone, capas, marker])

  const handlePicar = async () => {
    if (!lastClick.current || !capas) return
    setBuscandoCalle(true)
    await cargarCalles()
    const { lat, lng } = lastClick.current
    const d = detectarPunto(lat, lng, capas)
    setDetection(d)
    setHasPicado(true)
    geolocalizarCalle(lat, lng).then(info => {
      setCalleInfo(info)
      setBuscandoCalle(false)
    })
  }

  const handleConfirmarPunto = () => {
    if (!detection) return
    const isOutside = detection?.fuera_alcance
    if (isOutside && (!manualColonia.trim() || !manualJunta.trim())) return

    const entreCalles = (() => {
      if (calleInfo?.entreCallesDetected === 1) {
        const manual = manualEntreCalles.trim().toUpperCase()
        return manual ? `${calleInfo.entreCalles} Y ${manual}` : calleInfo.entreCalles
      }
      if (calleInfo?.entreCallesDetected === 0 || !calleInfo) {
        return manualEntreCalles.trim().toUpperCase() || ''
      }
      return calleInfo?.entreCalles || ''
    })()

    pinDataRef.current = {
      lat: detection.coordenadas.lat,
      lng: detection.coordenadas.lng,
      colonia: isOutside ? manualColonia.trim() : detection.colonia,
      junta_auxiliar: isOutside ? manualJunta.trim() : detection.junta_auxiliar,
      calle: calleInfo?.calle || manualCalle.trim().toUpperCase() || '',
      entre_calles: entreCalles,
      zona_zap: detection.zona_zap,
      cobertura_agua: detection.cobertura_agua,
    }
    setStep('tramo')
  }

  const handleUndoLast = () => {
    if (tramoPoints.length === 0) return
    const next = tramoPoints.slice(0, -1)
    setTramoPoints(next)
    programarDeteccionTramo(next)
  }

  const handleResetTramo = () => {
    if (tramoCalcTimer.current) clearTimeout(tramoCalcTimer.current)
    setTramoPoints([])
    setTramoDetection(null)
    setTramoDone(false)
    setTramoConfirmed(false)
  }

  const handleConfirmarTramo = () => {
    if (!pinDataRef.current) return
    if (tramoDetection) {
      const result: MapaCombinadoResult = {
        pin: pinDataRef.current,
        tramo: {
          lat_ini: tramoDetection.coordenadas.lat_ini,
          lng_ini: tramoDetection.coordenadas.lng_ini,
          lat_fin: tramoDetection.coordenadas.lat_fin,
          lng_fin: tramoDetection.coordenadas.lng_fin,
          puntos: tramoPoints,
          distancia_m: tramoDetection.distancia_m,
          ancho_calle_m: tramoDetection.ancho_calle_m,
          escuelas_cercanas: tramoDetection.escuelas_cercanas,
          iglesias_cercanas: tramoDetection.iglesias_cercanas,
          transportes_cercanos: tramoDetection.transportes_cercanos,
        },
      }
      setTramoConfirmed(true)
      onConfirm(result)
    }
  }

  const d = detection
  const isOutside = d?.fuera_alcance
  const td = tramoDetection

  return (
    <div data-tour="mapa-completo" className={inline ? 'flex h-full w-full flex-col bg-white' : 'fixed inset-0 z-50 flex flex-col bg-black/60'}>
      <div className="flex items-center justify-between bg-white px-4 py-3 shadow-md">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-institutional transition-all duration-200 hover:bg-gray-200 hover:text-guinda active:scale-[0.97]"
          aria-label="Cerrar mapa"
        >
          <X className="h-4 w-4" />
          {inline ? 'Cerrar' : 'Cancelar'}
        </button>
        <h2 className="text-sm font-semibold text-guinda">
          {step === 'punto' ? 'Seleccionar ubicación' : 'Dibujar tramo'}
        </h2>
        <div className="flex items-center gap-1.5 text-xs text-gray-institutional/60" data-tour="pasos">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${step === 'punto' ? 'bg-guinda text-white' : 'bg-green-100 text-green-700'}`}>
            {step === 'tramo' ? <Check className="h-3 w-3" /> : '1'}
          </span>
          <span className="text-gray-institutional/30">—</span>
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${tramoConfirmed ? 'bg-green-100 text-green-700' : step === 'tramo' ? 'bg-guinda text-white' : 'bg-gray-100 text-gray-institutional/40'}`}>
            {tramoConfirmed ? <Check className="h-3 w-3" /> : '2'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => correrTour(false)}
          className="hidden h-7 w-7 items-center justify-center rounded-full bg-guinda/5 text-guinda transition-colors hover:bg-guinda hover:text-white md:flex"
          aria-label="Ver guía de uso"
          title="Ver guía de uso"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-white">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-guinda/20 border-t-guinda" />
            <p className="text-sm text-gray-institutional/60">Cargando mapa...</p>
          </div>
        )}

        <MapContainer
          ref={mapRef}
          center={marker ?? DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          className="h-full w-full"
          zoomControl={true}
        >
          {satellite ? (
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">ESRI</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}

          <LocateOnMount onLocated={handleLocated} onLocateError={handleLocateError} userRequested={userRequestedLocate} />
          <ResizeHandler inline={inline} />
          <ZoomTracker onZoom={setMapZoom} />

          <ClickHandler
            stepRef={stepRef}
            onPuntoClick={handlePuntoClick}
            onTramoClick={handleTramoClick}
          />

          {showLayers && capas?.colonias && (
            <GeoJSON key="colonias" data={capas.colonias} style={COLONIA_STYLE} interactive={false} />
          )}
          {showLayers && capas?.juntas && (
            <GeoJSON key="juntas" data={capas.juntas} style={JUNTA_STYLE} interactive={false} />
          )}
          {showLayers && capas?.zonasZap && (
            <GeoJSON key="zonasZap" data={capas.zonasZap} style={ZONA_ZAP_STYLE} interactive={false} />
          )}

          {marker && <Marker position={[marker.lat, marker.lng]} icon={icon} />}

          {step === 'tramo' && marker && tramoPoints.length === 0 && mapZoom <= 14 && (
            <Circle center={[marker.lat, marker.lng]} radius={500} pathOptions={{ color: '#7d2447', weight: 1.5, fillOpacity: 0.04, dashArray: '5,5' }} />
          )}
          {step === 'tramo' && marker && tramoPoints.length >= 1 && mapZoom <= 14 && (
            <Circle center={[marker.lat, marker.lng]} radius={5000} pathOptions={{ color: '#7d2447', weight: 1, fillOpacity: 0.03, dashArray: '5,5' }} />
          )}

          {tramoPoints.map((p, i) => (
            <TramoMarker key={i} position={[p.lat, p.lng]} label={i + 1} />
          ))}
          {tramoPoints.length >= 2 && (
            <Polyline
              positions={tramoPoints.map(p => [p.lat, p.lng])}
              pathOptions={{ color: '#7d2447', weight: 4 }}
            />
          )}
        </MapContainer>

        <div className="pointer-events-auto absolute right-3 top-3 z-[999] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={localizar}
            disabled={locating}
            aria-label="Ir a mi ubicación"
            title="Ir a mi ubicación"
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs text-guinda shadow-card transition-colors hover:bg-guinda hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LocateFixed className={`h-3.5 w-3.5 ${locating ? 'animate-pulse' : ''}`} />
            Mi ubicación
          </button>
          <button
            type="button"
            onClick={() => setSatellite(prev => !prev)}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs text-guinda shadow-card transition-colors hover:bg-guinda hover:text-white"
            aria-label={satellite ? 'Vista calle' : 'Vista satélite'}
          >
            {satellite ? <Map className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
            {satellite ? 'Calle' : 'Satélite'}
          </button>
          <button
            type="button"
            onClick={() => setShowLayers(prev => !prev)}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs text-guinda shadow-card transition-colors hover:bg-guinda hover:text-white"
            aria-label={showLayers ? 'Ocultar capas' : 'Mostrar capas'}
          >
            {showLayers ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <Layers className="h-3.5 w-3.5" />
            Capas
          </button>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[999] bg-gradient-to-t from-black/60 to-transparent p-4 pt-8">
          <div className="pointer-events-auto mx-auto max-w-md space-y-2 rounded-2xl bg-white p-4 shadow-card" data-tour="panel">
            {locateMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <Info className="h-4 w-4 shrink-0" />
                <span>{locateMsg}</span>
              </div>
            )}
            {step === 'punto' ? (
              <>
                {!marker && (
                  <div className="flex items-center gap-3 text-sm text-gray-institutional/70">
                    <Crosshair className="h-5 w-5 shrink-0 text-guinda" />
                    <span>Haz clic en el mapa para colocar el marcador</span>
                  </div>
                )}

                {marker && !hasPicado && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="h-5 w-5 shrink-0 text-guinda" />
                      <span className="font-mono text-xs text-gray-institutional">
                        {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}
                      </span>
                    </div>
                    <Button type="button" size="sm" onClick={handlePicar} disabled={!capas} data-tour="picar-ubicacion">
                      <Crosshair className="mr-1.5 h-4 w-4" />
                      Picar ubicación
                    </Button>
                  </div>
                )}

                {d && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="h-5 w-5 shrink-0 text-guinda" />
                      <span className="font-mono text-xs text-gray-institutional">
                        {d.coordenadas.lat.toFixed(6)}, {d.coordenadas.lng.toFixed(6)}
                      </span>
                    </div>

                    {isOutside ? (
                      <>
                        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                          <Info className="h-4 w-4 shrink-0" />
                          <span>Zona no encontrada. Ingresa colonia y junta auxiliar manualmente.</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={manualColonia}
                            onChange={e => setManualColonia(e.target.value)}
                            placeholder="Colonia"
                            className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                          />
                          <input
                            type="text"
                            value={manualJunta}
                            onChange={e => setManualJunta(e.target.value)}
                            placeholder="Junta auxiliar"
                            className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs">
                          <span className="font-medium text-gray-institutional">Colonia: </span>
                          <span className={d.colonia === 'Desconocida' ? 'text-amber-600' : 'text-guinda'}>{d.colonia || '—'}</span>
                        </div>
                        <div className="text-xs">
                          <span className="font-medium text-gray-institutional">Junta auxiliar: </span>
                          <span className={d.junta_auxiliar === 'Zona Metropolitana' ? 'text-amber-600' : 'text-green-700'}>{d.junta_auxiliar}</span>
                        </div>
                        {d.zona_zap && <div className="text-xs"><span className="font-medium text-gray-institutional">Zona ZAP: </span><span className="text-amber-700">Si</span></div>}
                        {d.cobertura_agua && <div className="text-xs"><span className="font-medium text-gray-institutional">Cobertura de agua: </span><span className="text-blue-600">Si</span></div>}

                        <hr className="border-gray-100" />
                        {buscandoCalle ? (
                          <div className="flex items-center gap-2 text-xs text-gray-institutional/60">
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-guinda/20 border-t-guinda" />
                            Buscando dirección
                          </div>
                        ) : (
                          <>
                            {calleInfo?.calle && (
                              <div className="flex items-center gap-2 text-xs">
                                <Navigation className="h-3.5 w-3.5 shrink-0 text-guinda" />
                                <span className="font-medium text-gray-institutional">{calleInfo.calle}</span>
                              </div>
                            )}
                            {!calleInfo?.calle && (
                              <input
                                type="text"
                                value={manualCalle}
                                onChange={e => setManualCalle(e.target.value)}
                                placeholder="Nombre de la calle (no detectada)..."
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                              />
                            )}
                            {calleInfo && calleInfo.entreCallesDetected >= 2 ? (
                              <div className="flex items-center gap-2 pl-5 text-xs text-gray-institutional/60">
                                {calleInfo.entreCalles}
                              </div>
                            ) : (
                              <div className={`flex flex-col gap-1.5 ${calleInfo?.calle ? 'pl-5' : ''}`}>
                                {calleInfo?.entreCallesDetected === 1 && (
                                  <div className="flex items-center gap-2 text-xs text-gray-institutional/60">
                                    <span>{calleInfo.entreCalles}</span>
                                  </div>
                                )}
                                <input
                                  type="text"
                                  value={manualEntreCalles}
                                  onChange={e => setManualEntreCalles(e.target.value)}
                                  placeholder={
                                    calleInfo?.entreCallesDetected === 1
                                      ? 'Entre calle faltante...'
                                      : 'Entre qué calles se encuentra? (ej: Reforma y 5 de Mayo)'
                                  }
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      className="mt-1"
                      disabled={buscandoCalle || (isOutside && (!manualColonia.trim() || !manualJunta.trim()))}
                      onClick={handleConfirmarPunto}
                    >
                      <MapPin className="mr-1.5 h-4 w-4" />
                      Confirmar ubicación
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-xs text-green-700">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Ubicación confirmada</span>
                </div>

                {tramoError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>{tramoError}</span>
                  </div>
                )}

                {!td ? (
                  <>
                    {tramoPoints.length === 0 && (
                      <div className="flex items-center gap-3 text-sm text-gray-institutional/70">
                        <Crosshair className="h-5 w-5 shrink-0 text-guinda" />
                        <span>Haz clic en el punto de inicio del tramo (máx. 500 m del marcador)</span>
                      </div>
                    )}
                    {tramoPoints.length >= 1 && (
                      <div className="flex items-center gap-3 text-sm text-gray-institutional/70">
                        <Crosshair className="h-5 w-5 shrink-0 text-guinda" />
                        <span>
                          {tramoPoints.length === 1
                            ? 'Haz clic en el siguiente punto del tramo (máx. 5 km del marcador)'
                            : `Sigue agregando puntos o presiona "Terminar" (${tramoPoints.length} puntos)`}
                        </span>
                        <button
                          type="button"
                          onClick={handleUndoLast}
                          className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl text-gray-institutional/50 transition-colors hover:bg-gray-100 hover:text-guinda"
                          aria-label="Deshacer último punto"
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {tramoPoints.length >= 2 && (
                      <div className="mt-1 flex gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={handleResetTramo}>
                          Reiniciar
                        </Button>
                        <Button type="button" size="sm" className="flex-1" onClick={() => setTramoDone(true)} data-tour="terminar-tramo">
                          <Ruler className="mr-1.5 h-4 w-4" />
                          Terminar tramo
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-institutional">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">Distancia:</span>
                        <span className="text-guinda">{td.distancia_m} m</span>
                      </div>
                      <span className="text-gray-institutional/30">|</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">Ancho calle:</span>
                        <span className="text-guinda">~{td.ancho_calle_m} m</span>
                      </div>
                      <span className="text-gray-institutional/30">|</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">Puntos:</span>
                        <span className="text-guinda">{tramoPoints.length}</span>
                      </div>
                    </div>

                    {td.escuelas_cercanas.length > 0 && (
                      <div className="flex items-start gap-2 text-xs text-gray-institutional">
                        <School className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                        <span className="line-clamp-1">{td.escuelas_cercanas.slice(0, 3).join(', ')}{td.escuelas_cercanas.length > 3 ? ` (+${td.escuelas_cercanas.length - 3})` : ''}</span>
                      </div>
                    )}
                    {td.iglesias_cercanas.length > 0 && (
                      <div className="flex items-start gap-2 text-xs text-gray-institutional">
                        <Church className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-600" />
                        <span className="line-clamp-1">{td.iglesias_cercanas.slice(0, 3).join(', ')}{td.iglesias_cercanas.length > 3 ? ` (+${td.iglesias_cercanas.length - 3})` : ''}</span>
                      </div>
                    )}
                    {td.transportes_cercanos.length > 0 && (
                      <div className="flex items-start gap-2 text-xs text-gray-institutional">
                        <Bus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-600" />
                        <span className="line-clamp-1">{td.transportes_cercanos.slice(0, 3).join(', ')}{td.transportes_cercanos.length > 3 ? ` (+${td.transportes_cercanos.length - 3})` : ''}</span>
                      </div>
                    )}

                    <div>
                      {tramoConfirmed ? (
                          <Button type="button" size="sm" className="w-full !bg-[#636569] !text-white !shadow-none" onClick={() => setShowTramoInfoCard(true)} data-tour="ver-resumen">
                            <Check className="mr-1.5 h-4 w-4" />
                            Realizado
                          </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="secondary" className="flex-1" onClick={handleResetTramo}>
                            Borrar
                          </Button>
                          <Button type="button" size="sm" className="flex-1" onClick={handleConfirmarTramo} data-tour="confirmar-tramo">
                            <Check className="mr-1.5 h-4 w-4" />
                            Confirmar tramo
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </>
            )}
          </div>
        </div>
      </div>

      {showTramoInfoCard && pinDataRef.current && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowTramoInfoCard(false)}>
          <div data-tour="resumen-obra" className="relative mx-auto max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="rounded-t-2xl bg-guinda px-6 pb-6 pt-4" />
            <div className="flex flex-col gap-4 px-6 pb-6 pt-0">
              <div className="-mt-9 flex justify-center">
                <img src={logoSrc} alt="Semovinfra" className="h-16 w-16 rounded-full object-cover shadow-lg" />
              </div>
              <p className="text-sm leading-relaxed text-gray-institutional">
                Los datos de ubicación y tramo ya han sido rellenados de manera automática.
                Solo necesita explicarnos la razón de su problema, subir evidencias si es que
                las tiene y enviarnos su solicitud con el botón del final.
              </p>
              <div className="flex flex-col gap-1.5 rounded-xl border border-guinda/10 bg-guinda/5 px-3 py-3 text-xs text-gray-institutional">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-guinda" />
                  <span className="font-medium">Punto:</span>
                  <span className="font-mono">{pinDataRef.current.lat.toFixed(6)}, {pinDataRef.current.lng.toFixed(6)}</span>
                </div>
                {td && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Ruler className="h-3.5 w-3.5 shrink-0 text-guinda" />
                    <span className="font-medium">Tramo:</span>
                    <span className="font-mono">{td.coordenadas.lat_ini.toFixed(6)}, {td.coordenadas.lng_ini.toFixed(6)} → {td.coordenadas.lat_fin.toFixed(6)}, {td.coordenadas.lng_fin.toFixed(6)}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Navigation className="h-3.5 w-3.5 shrink-0 text-green-700" />
                  <span className="font-medium">Colonia:</span>
                  <span>{pinDataRef.current.colonia}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Navigation className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                  <span className="font-medium">Junta auxiliar:</span>
                  <span>{pinDataRef.current.junta_auxiliar}</span>
                </div>
                {pinDataRef.current.calle && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Navigation className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span className="font-medium">Calle:</span>
                    <span>{pinDataRef.current.calle}</span>
                  </div>
                )}
                {pinDataRef.current.entre_calles && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Navigation className="h-3.5 w-3.5 shrink-0 text-purple-600" />
                    <span className="font-medium">Entre calles:</span>
                    <span>{pinDataRef.current.entre_calles}</span>
                  </div>
                )}
              </div>
              <Button type="button" size="sm" onClick={() => setShowTramoInfoCard(false)}>
                Entendido <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
