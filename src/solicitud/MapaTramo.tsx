import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, useMap, useMapEvents, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import { X, Crosshair, Ruler, School, Church, Bus, Layers, Eye, EyeOff, Globe, Map, Undo2 } from 'lucide-react'
import Button from '../shared/Button'
import { cargarCapas, detectarTramo } from './detectar-ubicacion'
import type { CapasGeoJSON, DeteccionTramo } from './detectar-ubicacion'

const DEFAULT_CENTER: [number, number] = [19.0414, -98.2063]
const DEFAULT_ZOOM = 15

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

interface MapaTramoProps {
  onConfirm: (data: {
    lat_ini: number; lng_ini: number; lat_fin: number; lng_fin: number
    puntos: { lat: number; lng: number }[]
    distancia_m: number; ancho_calle_m: number
    zona_zap: boolean; cobertura_agua: boolean; escuelas_cercanas: string[]; iglesias_cercanas: string[]; transportes_cercanos: string[]
  }) => void
  onClose: () => void
}

function TramoMarker({ position, icon }: { position: L.LatLngExpression; icon: L.DivIcon }) {
  const map = useMap()
  useEffect(() => {
    const m = L.marker(position, { icon }).addTo(map)
    return () => { m.remove() }
  }, [map, position, icon])
  return null
}

function ClickHandler({
  onMapClick,
  done,
}: {
  onMapClick: (latlng: { lat: number; lng: number }) => void
  done: boolean
}) {
  useMapEvents({
    click(e) {
      if (!done) onMapClick(e.latlng)
    },
  })
  return null
}

export default function MapaTramo({ onConfirm, onClose }: MapaTramoProps) {
  const [capas, setCapas] = useState<CapasGeoJSON | null>(null)
  const [points, setPoints] = useState<{ lat: number; lng: number }[]>([])
  const [detection, setDetection] = useState<DeteccionTramo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLayers, setShowLayers] = useState(false)
  const [satellite, setSatellite] = useState(false)

  useEffect(() => {
    cargarCapas().then(c => {
      setCapas(c)
      setLoading(false)
    })
  }, [])

  const [done, setDone] = useState(false)

  const handleMapClick = (latlng: { lat: number; lng: number }) => {
    const next = [...points, latlng]
    setPoints(next)
    if (next.length >= 2 && capas) {
      setDetection(detectarTramo(next, capas))
    } else {
      setDetection(null)
    }
  }

  const handleUndoLast = () => {
    if (points.length === 0) return
    const next = points.slice(0, -1)
    setPoints(next)
    if (next.length >= 2 && capas) {
      setDetection(detectarTramo(next, capas))
    } else {
      setDetection(null)
    }
  }

  const handleReset = () => {
    setPoints([])
    setDetection(null)
    setDone(false)
  }

  const d = detection

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
        <h2 className="text-sm font-semibold text-guinda">Dibujar tramo</h2>
        <div className="w-20" />
      </div>

      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-alabaster">
            <div className="flex items-center gap-3 text-gray-institutional">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-guinda border-t-transparent" />
              <span className="text-sm">Cargando mapa...</span>
            </div>
          </div>
        )}

        <MapContainer
          center={DEFAULT_CENTER}
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
          <ClickHandler onMapClick={handleMapClick} done={done} />
          {showLayers && capas?.colonias && (
            <GeoJSON key="colonias" data={capas.colonias} style={COLONIA_STYLE} interactive={false} />
          )}
          {showLayers && capas?.juntas && (
            <GeoJSON key="juntas" data={capas.juntas} style={JUNTA_STYLE} interactive={false} />
          )}
          {showLayers && capas?.zonasZap && (
            <GeoJSON key="zonasZap" data={capas.zonasZap} style={ZONA_ZAP_STYLE} interactive={false} />
          )}
          {points.map((p, i) => (
            <TramoMarker
              key={i}
              position={[p.lat, p.lng]}
              icon={L.divIcon({
                className: 'flex items-center justify-center',
                html: `<div style="width:24px;height:24px;border-radius:50%;background:#7d2447;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${i + 1}</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
            />
          ))}
          {points.length >= 2 && (
            <Polyline
              positions={points.map(p => [p.lat, p.lng])}
              pathOptions={{ color: '#7d2447', weight: 4 }}
            />
          )}
        </MapContainer>

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

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[999] bg-gradient-to-t from-black/60 to-transparent p-4 pt-8">
          <div className="pointer-events-auto mx-auto max-w-md rounded-2xl bg-white p-4 shadow-card">
            {!d ? (
              <>
                {points.length === 0 && (
                  <div className="flex items-center gap-3 text-sm text-gray-institutional/70">
                    <Crosshair className="h-5 w-5 shrink-0 text-guinda" />
                    <span>Haz clic en el punto de inicio del tramo</span>
                  </div>
                )}
                {points.length >= 1 && (
                  <div className="flex items-center gap-3 text-sm text-gray-institutional/70">
                    <Crosshair className="h-5 w-5 shrink-0 text-guinda" />
                    <span>
                      {points.length === 1
                        ? 'Haz clic en el siguiente punto del tramo'
                        : `Sigue agregando puntos o presiona "Terminar" para finalizar el tramo (${points.length} puntos)`}
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
                {points.length >= 2 && (
                  <div className="mt-1 flex gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={handleReset}>
                      Reiniciar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      onClick={() => setDone(true)}
                    >
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
                    <span className="text-guinda">{d.distancia_m} m</span>
                  </div>
                  <span className="text-gray-institutional/30">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Ancho calle:</span>
                    <span className="text-guinda">~{d.ancho_calle_m} m</span>
                  </div>
                  <span className="text-gray-institutional/30">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Puntos:</span>
                    <span className="text-guinda">{points.length}</span>
                  </div>
                </div>

                {d.colonias.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-gray-institutional">Colonias:</span>
                    <span className="line-clamp-1 text-guinda">{d.colonias.join(', ')}</span>
                  </div>
                )}
                {d.juntas_auxiliares.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-gray-institutional">Juntas:</span>
                    <span className="line-clamp-1 text-green-700">{d.juntas_auxiliares.join(', ')}</span>
                  </div>
                )}
                {d.zonas_zap.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-gray-institutional">Zonas ZAP:</span>
                    <span className="line-clamp-1 text-amber-700">{d.zonas_zap.join(', ')}</span>
                  </div>
                )}
                {d.escuelas_cercanas.length > 0 && (
                  <div className="flex items-start gap-2 text-xs text-gray-institutional">
                    <School className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                    <span className="line-clamp-1">{d.escuelas_cercanas.slice(0, 3).join(', ')}{d.escuelas_cercanas.length > 3 ? ` (+${d.escuelas_cercanas.length - 3})` : ''}</span>
                  </div>
                )}
                {d.iglesias_cercanas.length > 0 && (
                  <div className="flex items-start gap-2 text-xs text-gray-institutional">
                    <Church className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-600" />
                    <span className="line-clamp-1">{d.iglesias_cercanas.slice(0, 3).join(', ')}{d.iglesias_cercanas.length > 3 ? ` (+${d.iglesias_cercanas.length - 3})` : ''}</span>
                  </div>
                )}
                {d.transportes_cercanos.length > 0 && (
                  <div className="flex items-start gap-2 text-xs text-gray-institutional">
                    <Bus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-600" />
                    <span className="line-clamp-1">{d.transportes_cercanos.slice(0, 3).join(', ')}{d.transportes_cercanos.length > 3 ? ` (+${d.transportes_cercanos.length - 3})` : ''}</span>
                  </div>
                )}

                <div className="mt-1 flex gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={handleReset}>
                    Reiniciar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      onConfirm({
                        lat_ini: d.coordenadas.lat_ini,
                        lng_ini: d.coordenadas.lng_ini,
                        lat_fin: d.coordenadas.lat_fin,
                        lng_fin: d.coordenadas.lng_fin,
                        puntos: points,
                        distancia_m: d.distancia_m,
                        ancho_calle_m: d.ancho_calle_m,
                        zona_zap: d.zonas_zap,
                        cobertura_agua: d.cobertura_agua,
                        escuelas_cercanas: d.escuelas_cercanas,
                        iglesias_cercanas: d.iglesias_cercanas,
                        transportes_cercanos: d.transportes_cercanos,
                      })
                    }
                  >
                    <Ruler className="mr-1.5 h-4 w-4" />
                    Confirmar tramo
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
