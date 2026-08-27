/**
 * @file MapaPin.tsx
 * @description Modal de mapa para seleccionar un único punto georreferenciado (pin).
 *              Permite colocar marcador, picar ubicación para resolver colonia/junta/ZAP/cobertura
 *              y calle/entre calles vía geolocalización inversa.
 *
 * Flujo:
 *  1. Carga capas GeoJSON (cargarCapas -> colonias, juntas, zonasZap, escuelas, iglesias, stv,
 *     coberturaAgua) y muestra loader. Centro por defecto Puebla [19.0414,-98.2063] zoom 13.
 *  2. Click en mapa: setMarker + lastClickRef (sin resolver aún). Botón "Picar ubicación" dispara
 *     detectarPunto(lat,lng,capas) -> DeteccionPunto (colonia, junta, zona_zap, cobertura_agua,
 *     fuera_alcance). Luego geolocalizarCalle para calle/entreCalles (async, spinner).
 *  3. Si fuera_alcance: muestra alerta azul e inputs manuales para colonia/junta (obligatorios).
 *     Si dentro: muestra colonia/junta/ZAP/cobertura + calle/entreCalles.
 *  4. Confirmar: onConfirm({lat,lng,colonia,junta,calle,entre_calles,zona_zap,cobertura_agua})
 *     con validación de manuales si fuera_alcance.
 *
 * Controles: satélite (Esri vs OSM), capas (GeoJSON), marcador SVG guinda divIcon.
 * Dependencias: react-leaflet (MapContainer, TileLayer, Marker, GeoJSON, useMapEvents),
 *               Leaflet, detectar-ubicacion, geolocalizarCalle.
 * Props: onConfirm, onClose, initialLat/Lng (re-edición).
 * Estilos: COLONIA_STYLE (guinda 0.08), JUNTA_STYLE (verde 0.05), ZONA_ZAP_STYLE (dorado 0.06).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, GeoJSON } from 'react-leaflet'
import L from 'leaflet'

import { X, Crosshair, MapPin, Info, Layers, Eye, EyeOff, Globe, Map, Navigation } from 'lucide-react'
import Button from '../shared/Button'
import { cargarCapas, detectarPunto } from './detectar-ubicacion'
import type { CapasGeoJSON, DeteccionPunto } from './detectar-ubicacion'
import { geolocalizarCalle } from '../lib/geolocalizarCalle'
import type { CalleInfo } from '../lib/geolocalizarCalle'

// --- Configuración inicial del mapa Puebla y estilos de capas ---
const DEFAULT_CENTER: [number, number] = [19.0414, -98.2063]
const DEFAULT_ZOOM = 13

const COLONIA_STYLE = {
  color: '#7d2447',
  weight: 2,
  fillColor: '#7d2447',
  fillOpacity: 0.08,
}

const JUNTA_STYLE = {
  color: '#2c6b2f',
  weight: 3,
  fillColor: '#2c6b2f',
  fillOpacity: 0.05,
}

const ZONA_ZAP_STYLE = {
  color: '#b8860b',
  weight: 2,
  fillColor: '#b8860b',
  fillOpacity: 0.06,
}

// Icono SVG guinda para el pin único
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

/** Props: onConfirm con datos resueltos, onClose, coords iniciales opcionales. */
interface MapaPinProps {
  onConfirm: (data: { lat: number; lng: number; colonia: string; junta_auxiliar: string; calle: string; entre_calles: string; zona_zap: boolean; cobertura_agua: boolean }) => void
  onClose: () => void
  initialLat?: string
  initialLng?: string
}

/** Captura click en mapa y delega a onMapClick. */
function ClickHandler({ onMapClick }: { onMapClick: (latlng: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng)
    },
  })
  return null
}

// --- Componente MapaPin: estados marker, detection, loading, capas, calleInfo ---
export default function MapaPin({ onConfirm, onClose, initialLat, initialLng }: MapaPinProps) {
  // capas GeoJSON cargadas; detection DeteccionPunto resuelta tras Picar
  const [capas, setCapas] = useState<CapasGeoJSON | null>(null)
  const [detection, setDetection] = useState<DeteccionPunto | null>(null)
  // marker: lat/lng del pin colocado (inicializa con initialLat/Lng si existen)
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: parseFloat(initialLat), lng: parseFloat(initialLng) } : null
  )
  const [loading, setLoading] = useState(true)
  // Toggles UI: capas GeoJSON y satélite
  const [showLayers, setShowLayers] = useState(false)
  const [satellite, setSatellite] = useState(false)
  // hasPicado indica si ya se resolvió detección (para mostrar botón Confirmar)
  const [hasPicado, setHasPicado] = useState(false)
  const [manualColonia, setManualColonia] = useState('')
  const [manualJunta, setManualJunta] = useState('')
  // calleInfo resuelta por geolocalizarCalle con spinner buscandoCalle
  const [calleInfo, setCalleInfo] = useState<CalleInfo | null>(null)
  const [buscandoCalle, setBuscandoCalle] = useState(false)
  const lastClick = useRef<{ lat: number; lng: number } | null>(null)

    // Carga capas GeoJSON al montar
useEffect(() => {
    cargarCapas().then(c => {
      setCapas(c)
      setLoading(false)
    })
  }, [])

    // Guarda click sin resolver; espera a Picar para detectar
const handleMapClick = useCallback(
    (latlng: { lat: number; lng: number }) => {
      setMarker(latlng)
      lastClick.current = latlng
      setHasPicado(false)
      setDetection(null)
    },
    []
  )

    /** Resuelve colonia/junta/ZAP/cobertura con detectarPunto y calle con geolocalizarCalle. */
const handlePicar = () => {
    if (!lastClick.current || !capas) return
    const { lat, lng } = lastClick.current
    const d = detectarPunto(lat, lng, capas)
    setDetection(d)
    setHasPicado(true)
    setBuscandoCalle(true)
    geolocalizarCalle(lat, lng).then(info => {
      setCalleInfo(info)
      setBuscandoCalle(false)
    })
  }

  const d = detection
  const isOutside = d?.fuera_alcance

  // --- JSX modal fullscreen: header, mapa + controles, panel inferior con estados ---
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60">
      <div className="flex items-center justify-between bg-white px-4 py-3 shadow-md">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-institutional transition-all duration-200 hover:bg-gray-200 hover:text-guinda active:scale-[0.97]"
          aria-label="Cerrar mapa"
        >
          <X className="h-4 w-4" />
          Cancelar
        </button>
        <h2 className="text-sm font-semibold text-guinda">Seleccionar ubicación</h2>
        <div className="w-20" />
      </div>

      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-white">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-guinda/20 border-t-guinda" />
            <p className="text-sm text-gray-institutional/60">Cargando mapa...</p>
          </div>
        )}

        <MapContainer
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
          <ClickHandler onMapClick={handleMapClick} />
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
        </MapContainer>

              {/* Controles flotantes satélite/capas */}
  <div className="pointer-events-auto absolute right-3 top-3 z-[999] flex flex-col gap-1.5">
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

              {/* Panel inferior con estados: sin marker, con marker sin picar, con detection */}
  <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[999] bg-gradient-to-t from-black/60 to-transparent p-4 pt-8">
          <div className="pointer-events-auto mx-auto max-w-md space-y-2 rounded-2xl bg-white p-4 shadow-card">
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
                <Button type="button" size="sm" onClick={handlePicar} disabled={!capas}>
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
                      <span>Zona no encontrada en nuestra base de datos. Ingresa los datos de colonia y junta auxiliar de manera manual, por favor.</span>
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
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-gray-institutional">Colonia:</span>
                      <span className={d.colonia === 'Desconocida' ? 'text-amber-600' : 'text-guinda'}>
                        {d.colonia || '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-gray-institutional">Junta auxiliar:</span>
                      <span className={d.junta_auxiliar === 'Zona Metropolitana' ? 'text-amber-600' : 'text-green-700'}>
                        {d.junta_auxiliar}
                      </span>
                    </div>
                    {d.zona_zap && (
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-medium text-gray-institutional">Zona ZAP:</span>
                        <span className="text-amber-700">Si</span>
                      </div>
                    )}
                    {d.cobertura_agua && (
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-medium text-gray-institutional">Cobertura de agua:</span>
                        <span className="text-blue-600">Si</span>
                      </div>
                    )}

                    <hr className="border-gray-100" />
                    {buscandoCalle ? (
                      <div className="flex items-center gap-2 text-xs text-gray-institutional/60">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-guinda/20 border-t-guinda" />
                        Buscando dirección...
                      </div>
                    ) : calleInfo ? (
                      <>
                        {calleInfo.calle && (
                          <div className="flex items-center gap-2 text-xs">
                            <Navigation className="h-3.5 w-3.5 shrink-0 text-guinda" />
                            <span className="font-medium text-gray-institutional">{calleInfo.calle}</span>
                          </div>
                        )}
                        {calleInfo.entreCalles && (
                          <div className="flex items-center gap-2 pl-5 text-xs text-gray-institutional/60">
                            {calleInfo.entreCalles}
                          </div>
                        )}
                      </>
                    ) : null}
                  </>
                )}

                <Button
                  type="button"
                  size="sm"
                  className="mt-1"
                  disabled={isOutside && (!manualColonia.trim() || !manualJunta.trim())}
                  onClick={() => {
                    if (d) {
                      onConfirm({
                        lat: d.coordenadas.lat,
                        lng: d.coordenadas.lng,
                        colonia: isOutside ? manualColonia.trim() : d.colonia,
                        junta_auxiliar: isOutside ? manualJunta.trim() : d.junta_auxiliar,
                        calle: calleInfo?.calle || '',
                        entre_calles: calleInfo?.entreCalles || '',
                        zona_zap: d.zona_zap,
                        cobertura_agua: d.cobertura_agua,
                      })
                    }
                  }}
                >
                  <MapPin className="mr-1.5 h-4 w-4" />
                  Confirmar ubicación
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
