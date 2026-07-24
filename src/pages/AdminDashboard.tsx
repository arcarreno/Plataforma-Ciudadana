import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Solicitud } from '../types/solicitud'
import { FileText, ArrowUpDown, Search } from 'lucide-react'
import Button from '../shared/Button'
import SolicitudDetail from '../solicitud/SolicitudDetail'

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Solicitud | null>(null)
  const [search, setSearch] = useState('')
  const [sortAsc, setSortAsc] = useState(false)

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
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      s.folio_unico?.toLowerCase().includes(q) ||
      s.nombre_solicitante.toLowerCase().includes(q) ||
      s.curp.toLowerCase().includes(q) ||
      s.tipo_solicitud.toLowerCase().includes(q) ||
      s.colonia.toLowerCase().includes(q) ||
      s.junta_auxiliar.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col gap-6">
      {selected && (
        <SolicitudDetail solicitud={selected} onClose={() => setSelected(null)} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-guinda">Panel de administración</h1>
          <p className="text-sm text-gray-institutional/60">
            {filtradas.length} de {solicitudes.length} solicitud(es)
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={() => setSortAsc(p => !p)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-institutional/50 transition-colors hover:bg-gray-100 hover:text-guinda"
            title={sortAsc ? 'Más recientes primero' : 'Más antiguas primero'}
          >
            <ArrowUpDown className={`h-4 w-4 transition-transform ${sortAsc ? 'rotate-180' : ''}`} />
          </button>
          {user?.rol === 'admin' && (
            <Button size="sm" onClick={() => navigate('/admin/usuarios')}>
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
          {filtradas.map(s => (
            <button
              key={s.id_solicitud}
              type="button"
              onClick={() => setSelected(s)}
              className="group cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-sm font-bold tracking-wider text-guinda">
                  {s.folio_unico}
                </p>
                <span className="rounded-lg bg-guinda/10 px-2 py-0.5 text-[10px] font-medium text-guinda">
                  {s.estatus_fase}
                </span>
              </div>

              <p className="mb-3 text-sm font-medium text-gray-institutional">
                {s.nombre_solicitante}
              </p>

              <div className="flex flex-col gap-1 text-xs text-gray-institutional/60">
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
                  <span className="text-green-700">{s.junta_auxiliar}</span>
                </div>
              </div>

              {s.rutas_evidencia && s.rutas_evidencia.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-guinda">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{s.rutas_evidencia.length} archivo(s)</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
