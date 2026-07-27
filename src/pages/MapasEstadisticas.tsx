import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Solicitud } from '../types/solicitud'
import Card from '../shared/Card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import { MapPin, TrendingUp, TrendingDown, Layers, Building2, Maximize2, Minimize2, Globe, Map, Eye, EyeOff } from 'lucide-react'
import { cargarCapas } from '../solicitud/detectar-ubicacion'
import type { CapasGeoJSON } from '../solicitud/detectar-ubicacion'

const markerIcon = new L.DivIcon({
  html: '<svg viewBox="0 0 32 48" width="24" height="36" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.16 0 0 7.16 0 16c0 10.6 12.8 26.6 14.6 28.8.6.8 1.8.8 2.4 0C18.8 42.6 32 26.6 32 16 32 7.16 24.84 0 16 0z" fill="#7D2447"/><circle cx="16" cy="16" r="10" fill="white" opacity="0.9"/><circle cx="16" cy="16" r="8" fill="#7D2447"/></svg>',
  className: '',
  iconSize: [24, 36],
  iconAnchor: [12, 36],
})

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

const CHART_COLORS = ['#7d2447', '#a3325f', '#c44d78', '#41504D', '#DBC6B3', '#636569', '#5c1a34', '#2d8f6f', '#e07b39', '#3b82f6']

function HeatmapLayer({ puntos }: { puntos: { latitud: number; longitud: number }[] }) {
  const map = useMap()
  const layerRef = useRef<L.HeatLayer | null>(null)

  useEffect(() => {
    if (!puntos.length) return
    const data: L.HeatLatLngTuple[] = puntos.map(p => [p.latitud, p.longitud, 1])
    if (layerRef.current) {
      layerRef.current.setLatLngs(data)
    } else {
      layerRef.current = L.heatLayer(data, {
        radius: 25,
        blur: 18,
        maxZoom: 16,
        max: 1,
        gradient: { 0.2: '#636569', 0.4: '#7d2447', 0.6: '#a3325f', 0.8: '#c44d78', 1.0: '#e07b39' },
      }).addTo(map)
    }
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [map, puntos])

  return null
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function agruparPor(arr: string[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {}
  arr.forEach(v => { if (v) counts[v] = (counts[v] || 0) + 1 })
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-semibold text-gray-institutional">{label}</p>
      <p className="mt-1 text-lg font-bold text-guinda">{payload[0].value}</p>
      <p className="text-[10px] text-gray-institutional/50">solicitud(es)</p>
    </div>
  )
}

export default function MapasEstadisticas() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const [satellite, setSatellite] = useState(false)
  const [capas, setCapas] = useState<CapasGeoJSON | null>(null)
  const [showLayers, setShowLayers] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/'); return }
    cargarSolicitudes()
  }, [user])

  useEffect(() => {
    cargarCapas().then(setCapas)
  }, [])

  async function cargarSolicitudes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('solicitudes')
      .select('id_solicitud, folio_unico, nombre_solicitante, latitud, longitud, colonia, junta_auxiliar, tipo_solicitud, fecha_creacion')
      .limit(500)
    if (!error && data) setSolicitudes(data as Solicitud[])
    setLoading(false)
  }

  const porColonia = useMemo(() => agruparPor(solicitudes.map(s => s.colonia)).slice(0, 10), [solicitudes])
  const porJunta = useMemo(() => agruparPor(solicitudes.map(s => s.junta_auxiliar)), [solicitudes])
  const porTipo = useMemo(() => agruparPor(solicitudes.map(s => s.tipo_solicitud)), [solicitudes])

  const porDiaSemana = useMemo(() => {
    const counts = new Array(7).fill(0)
    solicitudes.forEach(s => {
      if (s.fecha_creacion) {
        const d = new Date(s.fecha_creacion)
        counts[d.getDay()]++
      }
    })
    return DIAS_SEMANA.map((name, i) => ({ name: name.slice(0, 3), value: counts[i] }))
  }, [solicitudes])

  const diaMax = useMemo(() => {
    if (porDiaSemana.length === 0) return null
    return porDiaSemana.reduce((a, b) => a.value > b.value ? a : b)
  }, [porDiaSemana])

  const diaMin = useMemo(() => {
    if (porDiaSemana.length === 0) return null
    return porDiaSemana.reduce((a, b) => a.value < b.value ? a : b)
  }, [porDiaSemana])

  const puntos = useMemo(
    () => solicitudes.filter(s => s.latitud && s.longitud),
    [solicitudes]
  )

  const center = useMemo(() => {
    if (puntos.length === 0) return [19.0414, -98.2063] as [number, number]
    const lat = puntos.reduce((a, s) => a + s.latitud, 0) / puntos.length
    const lng = puntos.reduce((a, s) => a + s.longitud, 0) / puntos.length
    return [lat, lng] as [number, number]
  }, [puntos])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-guinda/20 border-t-guinda" />
        <p className="text-sm text-gray-institutional/50">Cargando estadísticas...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 lg:px-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-guinda">Mapas y Estadísticas</h1>
        <p className="mt-1 text-sm text-gray-institutional/50">Panel visual de todas las solicitudes registradas</p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-guinda/10 bg-gradient-to-br from-guinda to-guinda-dark p-5 shadow-card">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{solicitudes.length}</p>
              <p className="text-xs font-medium text-white/60">Total solicitudes</p>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#41504D]/10 bg-gradient-to-br from-[#41504D] to-[#2d3835] p-5 shadow-card">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{porColonia.length}</p>
              <p className="text-xs font-medium text-white/60">Colonias distintas</p>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#DBC6B3]/20 bg-gradient-to-br from-[#DBC6B3] to-[#c4a999] p-5 shadow-card">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <Layers className="h-6 w-6 text-guinda-dark" />
            </div>
            <div>
              <p className="text-3xl font-bold text-guinda-dark">{porJunta.length}</p>
              <p className="text-xs font-medium text-guinda-dark/60">Juntas auxiliares</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mapa */}
      <Card title="Mapa de solicitudes">
        <div className="relative h-[520px] w-full overflow-hidden rounded-xl" style={{ isolation: 'isolate' }}>
          <MapContainer center={center} zoom={12} className="h-full w-full" zoomControl>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
            {showHeatmap && <HeatmapLayer puntos={puntos} />}
            {!showHeatmap && puntos.map(s => (
              <Marker
                key={s.id_solicitud}
                position={[s.latitud, s.longitud]}
                icon={markerIcon}
              >
                <Popup maxWidth={240} className="custom-popup">
                  <div className="py-1">
                    <p className="font-bold text-guinda" style={{ fontSize: '13px' }}>{s.folio_unico}</p>
                    <p className="mt-0.5 text-xs text-gray-700">{s.nombre_solicitante}</p>
                    <p className="text-[11px] text-gray-400">{s.colonia} &mdash; {s.tipo_solicitud}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          <div className="absolute right-2 top-2 z-[2000] flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setShowHeatmap(prev => !prev)}
              className={`rounded-lg p-1.5 shadow-lg transition-colors hover:bg-gray-50 ${showHeatmap ? 'bg-guinda text-white' : 'bg-white text-gray-700'}`}
              title={showHeatmap ? 'Ver puntos individuales' : 'Ver mapa de calor'}
            >
              <MapPin className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMapFullscreen(true)}
              className="rounded-lg bg-white p-1.5 shadow-lg hover:bg-gray-50"
            >
              <Maximize2 className="h-4 w-4 text-gray-700" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-gray-institutional/40">
            {puntos.length} punto(s) mapeado(s) de {solicitudes.length} solicitud(es) total
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-institutional/40">
            {showHeatmap ? (
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #636569, #7d2447, #e07b39)' }} />
            ) : (
              <MapPin className="h-3.5 w-3.5 text-guinda" />
            )}
            {showHeatmap ? 'Mapa de calor' : 'Punto de solicitud'}
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card title="Obras por colonia">
          <p className="mb-3 text-xs text-gray-institutional/40">Top 10 colonias con más solicitudes</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porColonia} margin={{ top: 5, right: 10, bottom: 50, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#636569' }} angle={-40} textAnchor="end" interval={0} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#636569' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(125,36,71,0.04)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                {porColonia.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Obras por junta auxiliar">
          <p className="mb-3 text-xs text-gray-institutional/40">Distribución por junta auxiliar</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porJunta} margin={{ top: 5, right: 10, bottom: 50, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#636569' }} angle={-40} textAnchor="end" interval={0} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#636569' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(125,36,71,0.04)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                {porJunta.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Obras por tipo">
          <p className="mb-3 text-xs text-gray-institutional/40">Tipos de obra más solicitados</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porTipo} margin={{ top: 5, right: 10, bottom: 50, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#636569' }} angle={-40} textAnchor="end" interval={0} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#636569' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(125,36,71,0.04)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                {porTipo.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Solicitudes por día de la semana">
          <p className="mb-3 text-xs text-gray-institutional/40">Volumen de peticiones por día</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porDiaSemana} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#636569' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#636569' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(125,36,71,0.04)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={36}>
                {porDiaSemana.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={
                      entry.name === diaMax?.name
                        ? '#7d2447'
                        : entry.name === diaMin?.name
                          ? '#d5d2c8'
                          : 'rgba(125,36,71,0.35)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {diaMax && diaMin && (
            <div className="mt-3 flex flex-wrap gap-4 border-t border-gray-100 pt-3">
              <span className="flex items-center gap-1.5 rounded-lg bg-guinda/5 px-3 py-1.5 text-xs font-medium text-guinda">
                <TrendingUp className="h-3.5 w-3.5" />
                Más peticiones: {diaMax.name} ({diaMax.value})
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-institutional/60">
                <TrendingDown className="h-3.5 w-3.5" />
                Menos peticiones: {diaMin.name} ({diaMin.value})
              </span>
            </div>
          )}
        </Card>
      </div>

      {/* Mapa fullscreen */}
      {mapFullscreen && (
        <div className="fixed inset-0 z-[10001] bg-black">
          <div className="h-full w-full">
            <MapContainer center={center} zoom={12} className="h-full w-full" zoomControl>
              {!satellite ? (
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
              ) : (
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" />
              )}
              {puntos.map(s => (
                <Marker
                  key={s.id_solicitud}
                  position={[s.latitud, s.longitud]}
                  icon={markerIcon}
                >
                  <Popup maxWidth={240} className="custom-popup">
                    <div className="py-1">
                      <p className="font-bold text-guinda" style={{ fontSize: '13px' }}>{s.folio_unico}</p>
                      <p className="mt-0.5 text-xs text-gray-700">{s.nombre_solicitante}</p>
                      <p className="text-[11px] text-gray-400">{s.colonia} &mdash; {s.tipo_solicitud}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {showLayers && capas?.colonias && (
                <GeoJSON key="colonias" data={capas.colonias} style={COLONIA_STYLE} interactive={false} />
              )}
              {showLayers && capas?.juntas && (
                <GeoJSON key="juntas" data={capas.juntas} style={JUNTA_STYLE} interactive={false} />
              )}
              {showLayers && capas?.zonasZap && (
                <GeoJSON key="zonasZap" data={capas.zonasZap} style={ZONA_ZAP_STYLE} interactive={false} />
              )}
              <div className="absolute right-4 top-4 z-[10000] flex flex-col items-end gap-1.5">
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
                <button
                  type="button"
                  onClick={() => setMapFullscreen(false)}
                  className="rounded-lg bg-white/90 p-2 shadow-lg hover:bg-white"
                >
                  <Minimize2 className="h-5 w-5 text-gray-700" />
                </button>
              </div>
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  )
}
