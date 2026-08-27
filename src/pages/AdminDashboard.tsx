/**
 * @file AdminDashboard.tsx
 * @description Panel de administración para revisar, filtrar, paginar y gestionar solicitudes.
 *              Incluye búsqueda debounced, filtros por estatus/prioridad, orden, cards con
 *              prioridad visual, detalle modal, eliminación y exportación.
 *
 * Estado & flujo:
 *  - Paginación: PAGE_SIZE=50, page/totalCount/totalPages, cargarSolicitudes con params
 *    {q, estatus, prioridad, page, pageSize, asc} -> setSolicitudes + total. useCallback
 *    depende de searchQuery/filtros/page/sort. Effect carga si user existe sino navigate('/').
 *  - Búsqueda: searchInput + searchQuery debounce 300ms (debounceRef timeout), resetea page 1.
 *  - Filtros: filtroEstatus (select ESTATUS_ACTIVOS), filtroPrioridad (alta/media-alta/media/baja
 *    mapeado a peso_ranking). Ambos resetean page.
 *  - Orden: sortAsc bool toggle con ArrowUpDown, titulo dinámico.
 *  - Cards grid sm:2 xl:3: cada solicitud calcula esPrioridad (>=15 guinda), esConcentracion (12 beige),
 *    esMaxRanking (10 verde oscuro) vs default blanco. ESTATUS_COLORS mapea bg/text por estatus.
 *    Muestra folio, estatus badge, solicitante, CURP/tipo/colonia/junta, ZAP/Agua/distancia/ancho,
 *    y evidencias count. Click abre SolicitudDetail (selected state).
 *  - Detail: onEstatusChange -> actualizarEstatus + optimista en solicitudes y selected;
 *    onNavigate -> setSelected.
 *  - Eliminación: deleteTarget state + DeleteConfirmModal, handleEliminar -> eliminarSolicitud,
 *    filtra lista y decrementa total. Solo visible si user.rol==='admin' (Trash2).
 *  - Opciones dropdown (motion AnimatePresence): Ver base de datos en tablas (VistaBtTablasModal
 *    con obtenerTodasParaTablas que pagina 200 para cargar todas), Descargar Excel
 *    (cargarTodasSolicitudes paginando 200 + exportarExcel), y Usuarios (navigate /admin/usuarios
 *    solo admin).
 *
 * Endpoints: lib/servidor - listarSolicitudes, actualizarEstatus, eliminarSolicitud.
 * Libs: framer-motion, react-router, lucide-react.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { listarSolicitudes, actualizarEstatus, eliminarSolicitud } from '../lib/servidor'
import type { Solicitud } from '../types/solicitud'
import { ESTATUS_ACTIVOS } from '../core/constants'
import type { EstatusFase } from '../core/constants'
import { FileText, ArrowUpDown, Search, Ruler, Filter, ChevronLeft, ChevronRight, Trash2, ChevronDown, Table2, FileSpreadsheet, Users } from 'lucide-react'
import SolicitudDetail from '../solicitud/SolicitudDetail'
import DeleteConfirmModal from '../shared/DeleteConfirmModal'
import VistaBtTablasModal from '../shared/VistaBtTablas'
import { exportarExcel } from '../lib/exportarExcel'

// Mapa de colores de badge por estatus
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

// Tamaño de página fijo 50
const PAGE_SIZE = 50

// --- AdminDashboard: gestión paginada con búsqueda debounce, filtros, cards priorizadas y modales ---
export default function AdminDashboard() {
  // user para guardia y permisos admin (delete + usuarios)
  const { user } = useAuth()
  const navigate = useNavigate()
  // solicitudes página actual; loading/selected/search/sort/filtros/page/total/debounce/delete/modals
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
  const [deleteTarget, setDeleteTarget] = useState<Solicitud | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [opcionesAbierto, setOpcionesAbierto] = useState(false)
  const [verTablasAbierto, setVerTablasAbierto] = useState(false)
  const [exportando, setExportando] = useState(false)

  // totalPages derivado de totalCount/PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

    /** Carga página actual con params q/estatus/prioridad/page/asc; actualiza total. */
const cargarSolicitudes = useCallback(async () => {
    setLoading(true)
    const res = await listarSolicitudes({
      q: searchQuery,
      estatus: filtroEstatus,
      prioridad: filtroPrioridad,
      page,
      pageSize: PAGE_SIZE,
      asc: sortAsc,
    })
    setSolicitudes(res.data)
    setTotalCount(res.total)
    setLoading(false)
  }, [searchQuery, filtroEstatus, filtroPrioridad, page, sortAsc])

  // Carga inicial y cada que cambian params de cargarSolicitudes
  useEffect(() => {
    if (!user) { navigate('/'); return }
    cargarSolicitudes()
  }, [user, cargarSolicitudes])

    // Debounce 300ms para searchQuery + reset page 1
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

    // Actualiza estatus vía API y optimista en lista/selected
const handleEstatusChange = async (solicitud: Solicitud, nuevoEstatus: EstatusFase) => {
    await actualizarEstatus(solicitud.id_solicitud!, nuevoEstatus)
    setSolicitudes(prev => prev.map(s =>
      s.id_solicitud === solicitud.id_solicitud ? { ...s, estatus_fase: nuevoEstatus } : s
    ))
    setSelected(prev => prev && prev.id_solicitud === solicitud.id_solicitud
      ? { ...prev, estatus_fase: nuevoEstatus }
      : prev
    )
  }

  // Elimina solicitud y actualiza lista/total optimista
  const handleEliminar = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    await eliminarSolicitud(deleteTarget.id_solicitud!)
    setDeleteLoading(false)
    setDeleteTarget(null)
    setSolicitudes(prev => prev.filter(s => s.id_solicitud !== deleteTarget.id_solicitud))
    setTotalCount(prev => prev - 1)
  }

    // Pagina en lotes 200 hasta total para exportación completa
const cargarTodasSolicitudes = useCallback(async (): Promise<Solicitud[]> => {
    const todas: Solicitud[] = []
    const res = await listarSolicitudes({ page: 1, pageSize: 200 })
    todas.push(...res.data)
    for (let p = 2; todas.length < res.total; p++) {
      const siguiente = await listarSolicitudes({ page: p, pageSize: 200 })
      todas.push(...siguiente.data)
      if (siguiente.data.length === 0) break
    }
    return todas
  }, [])

    // Exporta todas a Excel con confirmación de vacío
const handleExportarExcel = async () => {
    setExportando(true)
    try {
      const todas = await cargarTodasSolicitudes()
      if (todas.length === 0) {
        alert('No hay solicitudes para exportar.')
      } else {
        exportarExcel(todas)
      }
    } catch {
      alert('Ocurrió un error al exportar los datos.')
    } finally {
      setExportando(false)
      setOpcionesAbierto(false)
    }
  }

  // Wrapper para modal de tablas: carga todas y adapta tipo
  const obtenerTodasParaTablas = useCallback(async (): Promise<Record<string, unknown>[]> => {
    const todas = await cargarTodasSolicitudes()
    return todas as unknown as Record<string, unknown>[]
  }, [cargarTodasSolicitudes])

  // --- JSX: header con búsqueda/filtros/orden/opciones, grid de cards, paginación, modales ---
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

      <div className="flex flex-col sm:flex-row sm:flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-guinda">Panel de administración</h1>
          <p className="text-sm text-gray-institutional/60">
            Página {page} de {totalPages} ({totalCount} solicitudes)
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex flex-1 items-center gap-2 rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-3 py-2 focus-within:ring-2 focus-within:ring-guinda/40 focus-within:border-transparent sm:flex-none">
            <Search className="h-4 w-4 shrink-0 text-gray-institutional/40" />
            <input
              type="text"
              value={searchInput}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar..."
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-institutional [outline:0] placeholder:text-gray-institutional/30 sm:w-48"
            />
          </div>
          <div className="relative flex-1 sm:flex-none">
            <div className="flex items-center gap-2 rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-3 py-2 focus-within:ring-2 focus-within:ring-guinda/40 focus-within:border-transparent">
              <Filter className="h-4 w-4 shrink-0 text-gray-institutional/40" />
              <select
                value={filtroEstatus}
                onChange={e => handleEstatusFilter(e.target.value)}
                className="min-w-0 flex-1 truncate bg-transparent text-sm text-gray-institutional [outline:0] sm:max-w-[180px]"
              >
                <option value="">Todos los estatus</option>
                {ESTATUS_ACTIVOS.map(e => (
                  <option key={e} value={e} className="truncate">{e}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="relative flex-1 sm:flex-none">
            <div className="flex items-center gap-2 rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-3 py-2 focus-within:ring-2 focus-within:ring-guinda/40 focus-within:border-transparent">
              <Filter className="h-4 w-4 shrink-0 text-gray-institutional/40" />
              <select
                value={filtroPrioridad}
                onChange={e => handlePrioridadFilter(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-gray-institutional [outline:0]"
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpcionesAbierto(p => !p)}
              className="inline-flex items-center gap-2 rounded-xl bg-guinda px-4 py-2 text-sm font-medium text-white shadow-button transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
            >
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${opcionesAbierto ? 'rotate-180' : ''}`} />
              Opciones
            </button>

            <AnimatePresence>
              {opcionesAbierto && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -6 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="absolute right-0 top-full z-30 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl"
                >
                  <button
                    type="button"
                    onClick={() => { setVerTablasAbierto(true); setOpcionesAbierto(false) }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-guinda transition-colors hover:bg-guinda/5"
                  >
                    <Table2 className="h-4 w-4 shrink-0" />
                    Ver base de datos en tablas
                  </button>
                  <button
                    type="button"
                    onClick={handleExportarExcel}
                    disabled={exportando}
                    className="flex w-full items-center gap-2 bg-white px-4 py-3 text-left text-sm font-medium text-guinda transition-colors hover:bg-guinda/5 disabled:opacity-50"
                  >
                    {exportando ? (
                      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-guinda/40 border-t-guinda" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 shrink-0" />
                    )}
                    {exportando ? 'Exportando…' : 'Descargar en Excel'}
                  </button>
                  {user?.rol === 'admin' && (
                    <div className="border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => { setOpcionesAbierto(false); navigate('/admin/usuarios') }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-guinda transition-colors hover:bg-guinda/5"
                      >
                        <Users className="h-4 w-4 shrink-0" />
                        Usuarios
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
          {/* Grid responsive de cards con colores por prioridad y estatus */}
          {solicitudes.map(s => {
            const esPrioridad = s.peso_ranking != null && s.peso_ranking >= 15
            const esConcentracion = s.peso_ranking === 12
            const esMaxRanking = s.peso_ranking === 10
            const estatusColor = ESTATUS_COLORS[s.estatus_fase || ''] ?? { bg: 'bg-gray-100', text: 'text-gray-700' }
            return (
              <div
                key={s.id_solicitud}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(s)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected(s) }}
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

                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className={`min-w-0 truncate text-sm font-medium ${
                    esPrioridad ? 'text-white' : esConcentracion ? 'text-black' : esMaxRanking ? 'text-[#DBC6B3]' : 'text-gray-institutional'
                  }`}>
                    {s.nombre_solicitante}
                  </p>
                  {user?.rol === 'admin' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(s)
                      }}
                      className={`shrink-0 rounded-lg p-1 transition-colors ${
                        esPrioridad
                          ? 'text-white/50 hover:bg-white/20 hover:text-white'
                          : esConcentracion
                            ? 'text-black/30 hover:bg-black/10 hover:text-black'
                            : esMaxRanking
                              ? 'text-[#DBC6B3]/50 hover:bg-[#DBC6B3]/20 hover:text-[#DBC6B3]'
                              : 'text-gray-400 hover:bg-red-50 hover:text-red-500'
                      }`}
                      title="Eliminar solicitud"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

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
              </div>
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

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        itemName={deleteTarget ? `Solicitud ${deleteTarget.folio_unico}` : ''}
        itemSubtitle={deleteTarget ? `${deleteTarget.nombre_solicitante} · ${deleteTarget.colonia}` : ''}
        onConfirm={handleEliminar}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />

      <VistaBtTablasModal
        isOpen={verTablasAbierto}
        onClose={() => setVerTablasAbierto(false)}
        obtenerDatos={obtenerTodasParaTablas}
      />
    </div>
  )
}
