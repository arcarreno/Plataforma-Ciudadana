/**
 * @file VistaBtTablas.tsx
 * @description Modal de inspección de base de datos (vista de tabla genérica).
 * Renderizado con `createPortal` en `document.body`, muestra en una tabla HTML
 * los registros obtenidos vía `obtenerDatos()` (función async provista por el padre).
 * Características:
 *  - Carga datos al abrirse (`isOpen` true) con `useEffect`; maneja estados
 *    `cargando` / `error` / vacío / con datos.
 *  - Filtra columnas ignoradas (`IGNORAR`: id_solicitud, rutas_evidencia, tramo_puntos)
 *    por ser campos técnicos o muy largos.
 *  - Renderiza celdas con lógica tipada: `null`/`undefined` → "NULL" itálico,
 *    objetos → `JSON.stringify` truncado, resto → `String(valor)`.
 *  - Tabla con header sticky guinda, numeración de filas y scroll horizontal.
 *  - Animación `fadeInUp` definida inline con `<style>`.
 *
 * @props VistaBtTablasModalProps
 * @prop {boolean} isOpen - Si el modal está visible; si false retorna null.
 * @prop {() => void} onClose - Callback para cerrar (botón X o "Cerrar").
 * @prop {() => Promise<Record<string, unknown>[]>} obtenerDatos - Función que resuelve
 *       con un array de objetos (filas); se llama cada vez que isOpen pasa a true.
 *
 * @uso Herramienta de debug/admin para visualizar el contenido crudo de la BD.
 *
 * @portal Usa `createPortal(..., document.body)` para overlay full-screen.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Table2, X } from 'lucide-react'

/** Props del modal de vista de tablas. */
interface VistaBtTablasModalProps {
  /** Controla visibilidad del modal. */
  isOpen: boolean
  /** Callback para cerrar el modal. */
  onClose: () => void
  /** Función async que retorna los registros a mostrar; se invoca al abrir. */
  obtenerDatos: () => Promise<Record<string, unknown>[]>
}

/** Set de nombres de columna a ocultar en la tabla (campos internos/binarios). */
const IGNORAR = new Set(['id_solicitud', 'rutas_evidencia', 'tramo_puntos'])

/**
 * Modal que muestra una tabla con los datos crudos de la base de datos.
 */
export default function VistaBtTablasModal({
  isOpen,
  onClose,
  obtenerDatos,
}: VistaBtTablasModalProps) {
  /** Filas obtenidas de la BD. */
  const [filas, setFilas] = useState<Record<string, unknown>[]>([])
  /** Si la carga está en curso. */
  const [cargando, setCargando] = useState(true)
  /** Mensaje de error si la carga falló. */
  const [error, setError] = useState<string | null>(null)

  /**
   * Efecto que carga datos cada vez que el modal se abre.
   * Llama a `obtenerDatos()`, actualiza `filas` o `error` y desactiva `cargando`.
   * Nota: no resetea `cargando`/`error` al cerrar; se asume que el padre
   * desmonta o el efecto se re-ejecutará al reabrir.
   */
  useEffect(() => {
    if (!isOpen) return
    obtenerDatos()
      .then(d => setFilas(d))
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar los datos'))
      .finally(() => setCargando(false))
  }, [isOpen, obtenerDatos])

  /** Columnas a mostrar: keys del primer registro filtrando las ignoradas. */
  const columnas = filas.length > 0 ? Object.keys(filas[0]).filter(k => !IGNORAR.has(k)) : []

  /**
   * Renderiza una celda `<td>` según el tipo de valor.
   * - undefined/null → "NULL" gris itálico
   * - object → JSON string truncado con title para tooltip
   * - resto → String(valor)
   */
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

  // Si no está abierto, no renderiza nada
  if (!isOpen) return null

  // Portal a body — overlay oscuro con blur y tarjeta centrada
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      {/* Contenedor principal — altura 82vh, ancho máximo 5xl, con animación fadeInUp */}
      <div
        className="flex h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: 'fadeInUp 0.3s ease-out' }}
      >
        {/* Cabecera: icono + título + botón X */}
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

        {/* Área de contenido scrolleable — 4 estados: cargando / error / vacío / tabla */}
        <div className="flex-1 overflow-auto">
          {cargando ? (
            // Estado de carga: spinner + texto
            <div className="flex h-full items-center justify-center gap-3 text-gray-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-guinda/30 border-t-guinda" />
              Cargando base de datos…
            </div>
          ) : error ? (
            // Estado de error: mensaje centrado en rojo
            <div className="flex h-full items-center justify-center p-6 text-center text-sm font-medium text-red-600">
              {error}
            </div>
          ) : filas.length === 0 ? (
            // Sin registros
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              No hay registros en la base de datos.
            </div>
          ) : (
            // Tabla de datos con header sticky guinda
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
                      {/* Número de fila */}
                      <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                      {/* Celdas de datos según columnas filtradas */}
                      {columnas.map((col, j) => celda(fila[col], j))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pie: conteo de registros + botón Cerrar */}
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

      {/* Keyframes de animación de entrada */}
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
