import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { X, MapPin, Ruler, FileText, Eye, School, Church, Bus, Calendar, User, Phone, Mail, FileWarning } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Solicitud } from '../types/solicitud'
import Card from '../shared/Card'

interface SolicitudDetailProps {
  solicitud: Solicitud
  onClose: () => void
}

const icon = L.divIcon({
  className: '',
  html: '<svg viewBox="0 0 32 48" width="24" height="36" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.16 0 0 7.16 0 16c0 10.6 12.8 26.6 14.6 28.8.6.8 1.8.8 2.4 0C18.8 42.6 32 26.6 32 16 32 7.16 24.84 0 16 0z" fill="#7D2447"/><circle cx="16" cy="16" r="10" fill="white" opacity="0.9"/><circle cx="16" cy="16" r="8" fill="#7D2447"/></svg>',
  iconSize: [24, 36],
  iconAnchor: [12, 36],
})

const marker1 = L.divIcon({
  className: 'flex items-center justify-center',
  html: '<div style="width:20px;height:20px;border-radius:50%;background:#7d2447;color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">1</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const marker2 = L.divIcon({
  className: 'flex items-center justify-center',
  html: '<div style="width:20px;height:20px;border-radius:50%;background:#7d2447;color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">2</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

function DetailMarker({ position, icon }: { position: L.LatLngExpression; icon: L.DivIcon }) {
  const map = useMap()
  useEffect(() => {
    const m = L.marker(position, { icon }).addTo(map)
    return () => { m.remove() }
  }, [map, position, icon])
  return null
}

export default function SolicitudDetail({ solicitud, onClose }: SolicitudDetailProps) {
  const s = solicitud
  const hasTramo = s.tramo_lat_ini && s.tramo_lng_ini && s.tramo_lat_fin && s.tramo_lng_fin

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/40 py-6">
      <div className="relative mx-auto w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-gray-institutional transition-colors hover:bg-gray-100 hover:text-guinda"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <p className="text-xs text-gray-institutional/50">Folio</p>
          <p className="text-xl font-bold tracking-wider text-guinda">{s.folio_unico}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Card title="Datos del solicitante">
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-guinda" />
                  <span className="text-gray-institutional">{s.nombre_solicitante}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileWarning className="h-4 w-4 text-guinda" />
                  <span className="font-mono text-xs text-gray-institutional/70">{s.curp}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-guinda" />
                  <span className="text-gray-institutional">{s.telefono}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-guinda" />
                  <span className="text-gray-institutional">{s.correo}</span>
                </div>
              </div>
            </Card>

            <Card title="Datos de la obra">
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-institutional/60">Tipo</span>
                  <span className="font-medium text-gray-institutional">{s.tipo_solicitud}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-institutional/60">Colonia</span>
                  <span className="font-medium text-gray-institutional">{s.colonia}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-institutional/60">Junta auxiliar</span>
                  <span className="font-medium text-green-700">{s.junta_auxiliar}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-institutional/60">Estatus</span>
                  <span className="rounded-lg bg-guinda/10 px-2 py-0.5 text-xs font-medium text-guinda">
                    {s.estatus_fase}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-institutional/60">Peso ranking</span>
                  <span className="font-medium text-gray-institutional">{s.peso_ranking}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-institutional/60">Fecha</span>
                  <span className="text-xs text-gray-institutional/70">
                    {s.fecha_creacion
                      ? new Date(s.fecha_creacion).toLocaleDateString('es-MX', {
                          day: '2-digit', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>
              </div>
            </Card>

            {s.descripcion && (
              <Card title="Descripción">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-institutional">
                  {s.descripcion}
                </p>
              </Card>
            )}

            {s.rutas_evidencia && s.rutas_evidencia.length > 0 && (
              <Card title={`Evidencia (${s.rutas_evidencia.length})`}>
                <div className="flex flex-wrap gap-2">
                  {s.rutas_evidencia.map((r, i) => (
                    <a
                      key={i}
                      href={supabase.storage.from('evidencias').getPublicUrl(r).data.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs text-guinda transition-colors hover:bg-guinda/5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="max-w-[160px] truncate">{r.split('/').pop()}</span>
                    </a>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <Card title="Ubicación">
              <div className="h-48 overflow-hidden rounded-xl">
                <MapContainer
                  center={[s.latitud, s.longitud]}
                  zoom={16}
                  className="h-full w-full"
                  zoomControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <DetailMarker position={[s.latitud, s.longitud]} icon={icon} />
                </MapContainer>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-institutional/60">
                <MapPin className="h-3.5 w-3.5 text-guinda" />
                {s.latitud.toFixed(6)}, {s.longitud.toFixed(6)}
              </div>
            </Card>

            {hasTramo && (
              <Card title="Tramo">
                <div className="h-48 overflow-hidden rounded-xl">
                  <MapContainer
                    center={[
                      (s.tramo_lat_ini! + s.tramo_lat_fin!) / 2,
                      (s.tramo_lng_ini! + s.tramo_lng_fin!) / 2,
                    ] as [number, number]}
                    zoom={17}
                    className="h-full w-full"
                    zoomControl={false}
                    dragging={false}
                    scrollWheelZoom={false}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Polyline
                      positions={[
                        [s.tramo_lat_ini!, s.tramo_lng_ini!],
                        [s.tramo_lat_fin!, s.tramo_lng_fin!],
                      ]}
                      pathOptions={{ color: '#7d2447', weight: 4, dashArray: '8 4' }}
                    />
                    <DetailMarker position={[s.tramo_lat_ini!, s.tramo_lng_ini!]} icon={marker1} />
                    <DetailMarker position={[s.tramo_lat_fin!, s.tramo_lng_fin!]} icon={marker2} />
                  </MapContainer>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-institutional/60">
                  <Ruler className="h-3.5 w-3.5 text-guinda" />
                  {s.tramo_lat_ini!.toFixed(6)}, {s.tramo_lng_ini!.toFixed(6)} → {s.tramo_lat_fin!.toFixed(6)}, {s.tramo_lng_fin!.toFixed(6)}
                </div>
              </Card>
            )}

            <Card title="Coordenadas">
              <div className="flex flex-col gap-1.5 text-xs font-mono text-gray-institutional/60">
                <div className="flex justify-between">
                  <span>Latitud:</span>
                  <span>{s.latitud.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Longitud:</span>
                  <span>{s.longitud.toFixed(6)}</span>
                </div>
                {hasTramo && (
                  <>
                    <hr className="my-1 border-gray-100" />
                    <div className="flex justify-between">
                      <span>Tramo inicio:</span>
                      <span>{s.tramo_lat_ini!.toFixed(6)}, {s.tramo_lng_ini!.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tramo fin:</span>
                      <span>{s.tramo_lat_fin!.toFixed(6)}, {s.tramo_lng_fin!.toFixed(6)}</span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
