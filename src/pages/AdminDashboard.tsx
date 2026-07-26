import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Solicitud } from '../types/solicitud'
import { ESTATUS_OPCIONES } from '../core/constants'
import type { EstatusFase } from '../core/constants'
import { FileText, ArrowUpDown, Search, Ruler, Filter } from 'lucide-react'
import Button from '../shared/Button'
import SolicitudDetail from '../solicitud/SolicitudDetail'

const ESTATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Planeacion - Evaluacion': { bg: 'bg-gray-100', text: 'text-gray-700' },
  'Concluido favorable': { bg: 'bg-green-100', text: 'text-green-700' },
  'Concluido no favorable': { bg: 'bg-red-100', text: 'text-red-700' },
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Solicitud | null>(null)
  const [search, setSearch] = useState('')
  const [sortAsc, setSortAsc] = useState(false)
  const [filtroEstatus, setFiltroEstatus] = useState<string>('')

  useEffect(() => {
    if (!user) { navigate('/'); return }
    cargarSolicitudes()
  }, [user])

  async function cargarSolicitudes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('solicitudes')
      .select('*')
      .order('fecha_creacion', { ascending: sortAsc })
    if (!error && data) setSolicitudes(data as Solicitud[])
    setLoading(false)
  }

  const filtradas = solicitudes.filter(s => {
    const matchSearch = !search.trim() || (() => {
      const q = search.toLowerCase()
      return (
        s.folio_unico?.toLowerCase().includes(q) ||
        s.nombre_solicitante.toLowerCase().includes(q) ||
        s.curp.toLowerCase().includes(q) ||
        s.tipo_solicitud.toLowerCase().includes(q) ||
        s.colonia.toLowerCase().includes(q) ||
        s.junta_auxiliar.toLowerCase().includes(q)
      )
    })()
    const matchEstatus = !filtroEstatus || s.estatus_fase === filtroEstatus
    return matchSearch && matchEstatus
  })

  const handleEstatusChange = async (solicitud: Solicitud, nuevoEstatus: EstatusFase) => {
    const { error } = await supabase
      .from('solicitudes')
      .update({ estatus_fase: nuevoEstatus })
      .eq('id_solicitud', solicitud.id_solicitud)
    if (!error) {
      setSolicitudes(prev => prev.map(s =>
        s.id_solicitud === solicitud.id_solicitud ? { ...s, estatus_fase: nuevoEstatus } : s
      ))
      setSelected(prev => prev && prev.id_solicitud === solicitud.id_solicitud
        ? { ...prev, estatus_fase: nuevoEstatus }
        : prev
      )
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {selected && (
        <SolicitudDetail
          solicitud={selected}
          onClose={() => setSelected(null)}
          onEstatusChange={(nuevo) => handleEstatusChange(selected, nuevo)}
          userRole={user?.rol}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-guinda">Panel de administración</h1>
          <p className="text-sm text-gray-institutional/60">
            {filtradas.length} de {solicitudes.length} solicitud(es)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-3 py-2">
            <Search className="h-4 w-4 text-gray-institutional/40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-36 bg-transparent text-sm text-gray-institutional outline-none placeholder:text-gray-institutional/30 md:w-48"
            />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-3 py-2">
              <Filter className="h-4 w-4 text-gray-institutional/40" />
              <select
                value={filtroEstatus}
                onChange={e => setFiltroEstatus(e.target.value)}
                className="bg-transparent text-sm text-gray-institutional outline-none"
              >
                <option value="">Todos los estatus</option>
                <option value="Planeacion - Evaluacion">Planeación - Evaluación</option>
                {ESTATUS_OPCIONES.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSortAsc(p => !p)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-institutional/50 transition-colors hover:bg-gray-100 hover:text-guinda"
            title={sortAsc ? 'Más recientes primero' : 'Más antiguas primero'}
          >
            <ArrowUpDown className={`h-4 w-4 transition-transform ${sortAsc ? 'rotate-180' : ''}`} />
          </button>
          {user?.rol === 'admin' && (
            <Button size="sm" className="w-full md:w-auto" onClick={() => navigate('/admin/usuarios')}>
              <FileText className="mr-1.5 h-4 w-4" />
              Usuarios
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-guinda/20 border-t-guinda" />
        </div>
      ) : filtradas.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-institutional/50">
          {solicitudes.length === 0
            ? 'No hay solicitudes registradas.'
            : 'Ninguna solicitud coincide con la búsqueda.'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map(s => {
            const esPrioridad = s.peso_ranking != null && s.peso_ranking >= 15
            const esMaxRanking = s.peso_ranking === 10
            const estatusColor = ESTATUS_COLORS[s.estatus_fase || ''] || ESTATUS_COLORS['Planeacion - Evaluacion']
            return (
              <button
                key={s.id_solicitud}
                type="button"
                onClick={() => setSelected(s)}
                className={`group cursor-pointer rounded-2xl p-5 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                  esMaxRanking
                    ? 'border border-[#41504D]/30 bg-[#41504D] text-[#DBC6B3]'
                    : esPrioridad
                      ? 'border border-guinda/20 bg-guinda text-white'
                      : 'border border-gray-100 bg-white'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className={`font-mono text-sm font-bold tracking-wider ${
                    esMaxRanking ? 'text-[#DBC6B3]' : esPrioridad ? 'text-white/90' : 'text-guinda'
                  }`}>
                    {s.folio_unico}
                  </p>
                  <span className={`rounded-lg px-2 py-0.5 text-[10px] font-medium ${
                    esMaxRanking
                      ? 'bg-[#DBC6B3]/20 text-[#DBC6B3]'
                      : esPrioridad
                        ? 'bg-white/20 text-white'
                        : `${estatusColor.bg} ${estatusColor.text}`
                  }`}>
                    {s.estatus_fase}
                  </span>
                </div>

                <p className={`mb-3 text-sm font-medium ${
                  esMaxRanking ? 'text-[#DBC6B3]' : esPrioridad ? 'text-white' : 'text-gray-institutional'
                }`}>
                  {s.nombre_solicitante}
                </p>

                <div className={`flex flex-col gap-1 text-xs ${
                  esMaxRanking ? 'text-[#DBC6B3]/70' : esPrioridad ? 'text-white/70' : 'text-gray-institutional/60'
                }`}>
                  <div className="flex justify-between">
                    <span>CURP:</span>
                    <span className="font-mono">{s.curp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tipo:</span>
                    <span>{s.tipo_solicitud}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Colonia:</span>
                    <span>{s.colonia}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Junta aux.:</span>
                    <span className={esMaxRanking ? 'text-[#DBC6B3]/80' : esPrioridad ? 'text-white/80' : 'text-green-700'}>{s.junta_auxiliar}</span>
                  </div>
                </div>

                {(s.zona_zap != null || s.cobertura_agua != null || s.distancia_tramo_m != null || s.ancho_calle_m != null) && (
                  <div className={`mt-2 flex flex-wrap gap-2 text-[10px] ${
                    esMaxRanking ? 'text-[#DBC6B3]/60' : esPrioridad ? 'text-white/60' : 'text-gray-institutional/50'
                  }`}>
                    {s.zona_zap != null && (
                      <span className="flex items-center gap-1">
                        ZAP: {s.zona_zap ? 'Si' : 'No'}
                      </span>
                    )}
                    {s.cobertura_agua != null && (
                      <span className="flex items-center gap-1">
                        Agua: {s.cobertura_agua ? 'Si' : 'No aplica'}
                      </span>
                    )}
                    {s.distancia_tramo_m != null && (
                      <span className="flex items-center gap-1">
                        <Ruler className="h-3 w-3" />
                        {s.distancia_tramo_m}m
                      </span>
                    )}
                    {s.ancho_calle_m != null && (
                      <span className="flex items-center gap-1">
                        <Ruler className="h-3 w-3 rotate-90" />
                        ~{s.ancho_calle_m}m ancho
                      </span>
                    )}
                  </div>
                )}

                {s.rutas_evidencia && s.rutas_evidencia.length > 0 && (
                  <div className={`mt-3 flex items-center gap-1.5 text-xs ${
                    esMaxRanking ? 'text-[#DBC6B3]/80' : esPrioridad ? 'text-white/80' : 'text-guinda'
                  }`}>
                    <FileText className="h-3.5 w-3.5" />
                    <span>{s.rutas_evidencia.length} archivo(s)</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
