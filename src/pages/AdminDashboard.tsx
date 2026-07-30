import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Solicitud } from '../types/solicitud'
import { ESTATUS_OPCIONES } from '../core/constants'
import type { EstatusFase } from '../core/constants'
import { FileText, ArrowUpDown, Search, Ruler, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '../shared/Button'
import SolicitudDetail from '../solicitud/SolicitudDetail'

const ESTATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Revision: { bg: 'bg-amber-100', text: 'text-amber-800' },
  'Dirección General de Planeación y Proyectos': { bg: 'bg-blue-100', text: 'text-blue-800' },
  'Departamento de Pavimentos, Mantenimiento y Conservación': { bg: 'bg-sky-100', text: 'text-sky-800' },
  'Departamento de Espacios Educativos': { bg: 'bg-teal-100', text: 'text-teal-800' },
  'Departamento de Espacios Públicos': { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  'Departamento de Infraestructura Urbana': { bg: 'bg-violet-100', text: 'text-violet-800' },
  'Concluido favorable': { bg: 'bg-green-100', text: 'text-green-700' },
  'Concluido no favorable': { bg: 'bg-red-100', text: 'text-red-700' },
}

const PAGE_SIZE = 50

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Solicitud | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortAsc, setSortAsc] = useState(false)
  const [filtroEstatus, setFiltroEstatus] = useState<string>('')
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const debounceRef = useRef<number | undefined>(undefined)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const cargarSolicitudes = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('solicitudes')
      .select('*', { count: 'exact' })

    const q = searchQuery.trim()
    if (q) {
      query = query.or(
        `folio_unico.ilike.%${q}%,` +
        `nombre_solicitante.ilike.%${q}%,` +
        `curp.ilike.%${q}%,` +
        `tipo_solicitud.ilike.%${q}%,` +
        `colonia.ilike.%${q}%,` +
        `junta_auxiliar.ilike.%${q}%`
      )
    }
    if (filtroEstatus) {
      query = query.eq('estatus_fase', filtroEstatus)
    }
    if (filtroPrioridad === 'alta') {
      query = query.eq('peso_ranking', 15)
    } else if (filtroPrioridad === 'media-alta') {
      query = query.eq('peso_ranking', 12)
    } else if (filtroPrioridad === 'media') {
      query = query.eq('peso_ranking', 10)
    } else if (filtroPrioridad === 'baja') {
      query = query.eq('peso_ranking', 5)
    }

    const from = (page - 1) * PAGE_SIZE
    const { data, count, error } = await query
      .order('fecha_creacion', { ascending: sortAsc })
      .range(from, from + PAGE_SIZE - 1)

    if (!error && data) {
      setSolicitudes(data as Solicitud[])
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }, [searchQuery, filtroEstatus, filtroPrioridad, page, sortAsc])

  useEffect(() => {
    if (!user) { navigate('/'); return }
    cargarSolicitudes()
  }, [user, cargarSolicitudes])

  const handleSearch = (val: string) => {
    setSearchInput(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchQuery(val)
      setPage(1)
    }, 300)
  }

  const handleEstatusFilter = (val: string) => {
    setFiltroEstatus(val)
    setPage(1)
  }

  const handlePrioridadFilter = (val: string) => {
    setFiltroPrioridad(val)
    setPage(1)
  }

  const toggleSort = () => {
    setSortAsc(p => !p)
  }

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
          onNavigate={(s) => setSelected(s)}
          userRole={user?.rol}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-guinda">Panel de administración</h1>
          <p className="text-sm text-gray-institutional/60">
            Página {page} de {totalPages} ({totalCount} solicitudes)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-3 py-2 focus-within:ring-2 focus-within:ring-guinda/40 focus-within:border-transparent">
            <Search className="h-4 w-4 text-gray-institutional/40" />
            <input
              type="text"
              value={searchInput}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-36 bg-transparent text-sm text-gray-institutional [outline:0] placeholder:text-gray-institutional/30 md:w-48"
            />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-3 py-2 focus-within:ring-2 focus-within:ring-guinda/40 focus-within:border-transparent">
              <Filter className="h-4 w-4 text-gray-institutional/40" />
              <select
                value={filtroEstatus}
                onChange={e => handleEstatusFilter(e.target.value)}
                className="max-w-[140px] truncate bg-transparent text-sm text-gray-institutional [outline:0]"
              >
                <option value="">Todos los estatus</option>
                <option value="Planeacion - Evaluacion">Planeación - Evaluación</option>
                {ESTATUS_OPCIONES.map(e => (
                  <option key={e} value={e} className="truncate">{e}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-3 py-2 focus-within:ring-2 focus-within:ring-guinda/40 focus-within:border-transparent">
              <Filter className="h-4 w-4 text-gray-institutional/40" />
              <select
                value={filtroPrioridad}
                onChange={e => handlePrioridadFilter(e.target.value)}
                className="bg-transparent text-sm text-gray-institutional [outline:0]"
              >
                <option value="">Todas las prioridades</option>
                <option value="alta">Prioridad alta</option>
                <option value="media-alta">Prioridad media-alta</option>
                <option value="media">Prioridad media</option>
                <option value="baja">Prioridad baja</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleSort}
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
      ) : solicitudes.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-institutional/50">
          Ninguna solicitud coincide con la búsqueda.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {solicitudes.map(s => {
            const esPrioridad = s.peso_ranking != null && s.peso_ranking >= 15
            const esConcentracion = s.peso_ranking === 12
            const esMaxRanking = s.peso_ranking === 10
            const estatusColor = ESTATUS_COLORS[s.estatus_fase || ''] ?? { bg: 'bg-gray-100', text: 'text-gray-700' }
            return (
              <button
                key={s.id_solicitud}
                type="button"
                onClick={() => setSelected(s)}
                className={`group cursor-pointer rounded-2xl p-5 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                  esPrioridad
                    ? 'border border-guinda/20 bg-guinda text-white'
                    : esConcentracion
                      ? 'border border-[#DBC6B3]/50 bg-[#DBC6B3] text-black'
                      : esMaxRanking
                        ? 'border border-[#41504D]/30 bg-[#41504D] text-[#DBC6B3]'
                        : 'border border-gray-100 bg-white'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className={`font-mono text-sm font-bold tracking-wider ${
                    esPrioridad ? 'text-white/90' : esConcentracion ? 'text-black/90' : esMaxRanking ? 'text-[#DBC6B3]' : 'text-guinda'
                  }`}>
                    {s.folio_unico}
                  </p>
                  <span className={`rounded-lg px-2 py-0.5 text-[10px] font-medium ${
                    esPrioridad
                      ? 'bg-white/20 text-white'
                      : esConcentracion
                        ? 'bg-black/10 text-black'
                        : esMaxRanking
                          ? 'bg-[#DBC6B3]/20 text-[#DBC6B3]'
                          : `${estatusColor.bg} ${estatusColor.text}`
                  }`}>
                    {s.estatus_fase}
                  </span>
                </div>

                <p className={`mb-3 text-sm font-medium ${
                  esPrioridad ? 'text-white' : esConcentracion ? 'text-black' : esMaxRanking ? 'text-[#DBC6B3]' : 'text-gray-institutional'
                }`}>
                  {s.nombre_solicitante}
                </p>

                <div className={`flex flex-col gap-1 text-xs ${
                  esPrioridad ? 'text-white/70' : esConcentracion ? 'text-black/70' : esMaxRanking ? 'text-[#DBC6B3]/70' : 'text-gray-institutional/60'
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
                    <span className={esPrioridad ? 'text-white/80' : esConcentracion ? 'text-black/80' : esMaxRanking ? 'text-[#DBC6B3]/80' : 'text-green-700'}>{s.junta_auxiliar}</span>
                  </div>
                </div>

                {(s.zona_zap != null || s.cobertura_agua != null || s.distancia_tramo_m != null || s.ancho_calle_m != null) && (
                  <div className={`mt-2 flex flex-wrap gap-2 text-[10px] ${
                    esPrioridad ? 'text-white/60' : esConcentracion ? 'text-black/60' : esMaxRanking ? 'text-[#DBC6B3]/60' : 'text-gray-institutional/50'
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
                    esPrioridad ? 'text-white/80' : esConcentracion ? 'text-black/80' : esMaxRanking ? 'text-[#DBC6B3]/80' : 'text-guinda'
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-institutional/50 transition-colors hover:bg-gray-100 hover:text-guinda disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-gray-institutional/60">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-institutional/50 transition-colors hover:bg-gray-100 hover:text-guinda disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
