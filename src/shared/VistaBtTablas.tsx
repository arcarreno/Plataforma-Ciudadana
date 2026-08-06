import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Table2, X } from 'lucide-react'

interface VistaBtTablasModalProps {
  isOpen: boolean
  onClose: () => void
  obtenerDatos: () => Promise<Record<string, unknown>[]>
}

const IGNORAR = new Set(['id_solicitud', 'rutas_evidencia', 'tramo_puntos'])

export default function VistaBtTablasModal({
  isOpen,
  onClose,
  obtenerDatos,
}: VistaBtTablasModalProps) {
  const [filas, setFilas] = useState<Record<string, unknown>[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    obtenerDatos()
      .then(d => setFilas(d))
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar los datos'))
      .finally(() => setCargando(false))
  }, [isOpen, obtenerDatos])

  const columnas = filas.length > 0 ? Object.keys(filas[0]).filter(k => !IGNORAR.has(k)) : []

  const celda = (valor: unknown, idx: number): ReactNode => {
    if (valor === undefined) return <td key={idx} className="px-3 py-2 text-gray-400 italic">NULL</td>
    if (valor === null) return <td key={idx} className="px-3 py-2 text-gray-400 italic">NULL</td>
    if (typeof valor === 'object') {
      const texto = JSON.stringify(valor)
      return (
        <td key={idx} className="max-w-[240px] truncate px-3 py-2 text-xs text-gray-700" title={texto}>
          {texto}
        </td>
      )
    }
    return <td key={idx} className="px-3 py-2 text-sm text-gray-800">{String(valor)}</td>
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="flex h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: 'fadeInUp 0.3s ease-out' }}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-guinda" />
            <h3 className="text-lg font-bold text-gray-900">Base de datos</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {cargando ? (
            <div className="flex h-full items-center justify-center gap-3 text-gray-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-guinda/30 border-t-guinda" />
              Cargando base de datos…
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm font-medium text-red-600">
              {error}
            </div>
          ) : filas.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              No hay registros en la base de datos.
            </div>
          ) : (
            <div className="min-w-max">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0">
                  <tr className="bg-guinda text-white">
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide">#</th>
                    {columnas.map(col => (
                      <th
                        key={col}
                        className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filas.map((fila, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                      {columnas.map((col, j) => celda(fila[col], j))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 text-xs text-gray-500">
          <span>{cargando ? '…' : `${filas.length} registro${filas.length === 1 ? '' : 's'}`}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-1.5 font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body
  )
}