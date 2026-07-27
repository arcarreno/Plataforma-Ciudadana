import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, LayersControl, Popup } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Solicitud } from '../types/solicitud'
import Card from '../shared/Card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { MapPin, BarChart3, TrendingUp, TrendingDown } from 'lucide-react'

const markerIcon = new L.DivIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#7d2447;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const CHART_COLORS = ['#7d2447', '#a3325f', '#c44d78', '#41504D', '#DBC6B3', '#636569', '#d5d2c8', '#5c1a34', '#2d8f6f', '#e07b39']

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function agruparPor(arr: string[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {}
  arr.forEach(v => { if (v) counts[v] = (counts[v] || 0) + 1 })
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export default function MapasEstadisticas() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { navigate('/'); return }
    cargarSolicitudes()
  }, [user])

  async function cargarSolicitudes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('solicitudes')
      .select('*')
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
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-guinda/20 border-t-guinda" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 lg:px-12">
      <h1 className="mb-6 text-2xl font-bold text-guinda">Mapas y Estadísticas</h1>

      <Card title="Mapa de solicitudes">
        <div className="h-[500px] w-full overflow-hidden rounded-xl">
          <MapContainer center={center} zoom={12} className="h-full w-full" zoomControl>
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Estándar">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satélite">
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" />
              </LayersControl.BaseLayer>
            </LayersControl>
            {puntos.map(s => (
              <Marker
                key={s.id_solicitud}
                position={[s.latitud, s.longitud]}
                icon={markerIcon}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold text-guinda">{s.folio_unico}</p>
                    <p>{s.nombre_solicitante}</p>
                    <p className="text-gray-500">{s.colonia} — {s.tipo_solicitud}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        <p className="mt-2 text-xs text-gray-institutional/50">
          {puntos.length} punto(s) mapeado(s) de {solicitudes.length} solicitud(es) total
        </p>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card title="Obras por colonia">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={porColonia} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {porColonia.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Obras por junta auxiliar">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={porJunta} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {porJunta.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Obras por tipo">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={porTipo} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {porTipo.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Solicitudes por día de la semana">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={porDiaSemana} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {porDiaSemana.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.name === diaMax?.name ? '#7d2447' : entry.name === diaMin?.name ? '#d5d2c8' : '#a3325f'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {diaMax && diaMin && (
            <div className="mt-2 flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1 text-guinda">
                <TrendingUp className="h-3.5 w-3.5" />
                Más peticiones: <strong>{diaMax.name}</strong> ({diaMax.value})
              </span>
              <span className="flex items-center gap-1 text-gray-institutional/60">
                <TrendingDown className="h-3.5 w-3.5" />
                Menos peticiones: <strong>{diaMin.name}</strong> ({diaMin.value})
              </span>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-alabaster-dark/60 bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-guinda/10">
              <MapPin className="h-5 w-5 text-guinda" />
            </div>
            <div>
              <p className="text-2xl font-bold text-guinda">{solicitudes.length}</p>
              <p className="text-xs text-gray-institutional/50">Total solicitudes</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-alabaster-dark/60 bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-guinda/10">
              <BarChart3 className="h-5 w-5 text-guinda" />
            </div>
            <div>
              <p className="text-2xl font-bold text-guinda">{porColonia.length}</p>
              <p className="text-xs text-gray-institutional/50">Colonias distintas</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-alabaster-dark/60 bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-guinda/10">
              <MapPin className="h-5 w-5 text-guinda" />
            </div>
            <div>
              <p className="text-2xl font-bold text-guinda">{porJunta.length}</p>
              <p className="text-xs text-gray-institutional/50">Juntas auxiliares</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
