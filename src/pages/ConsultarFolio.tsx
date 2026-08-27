/**
 * @file ConsultarFolio.tsx (export default ConsultarCurp)
 * @description Página pública para consultar por CURP o por folio (?folio=) sin necesidad de login.
 *              Dos modos de búsqueda con estado separado: por CURP (lista) y por folio (single).
 *
 * Flujo CURP:
 *  - Input CURP uppercase, max 18, botón Buscar disabled si vacío/loading.
 *  - consultarCurp(curpRaw): normalizarCurp -> valida 18, loading true, buscarPorCurp(curpNorm)
 *    -> setResultados (Solicitud[]). Maneja error catch genérico.
 * Flujo Folio:
 *  - Effect si folioParam en URL -> consultarFolio(folioRaw): consultarSolicitud -> setResultadoFolio
 *    o error "No se encontró...".
 *  - handleSubmit: preventDefault, limpia resultadoFolio, llama consultarCurp.
 * Render:
 *  - Form con Input label CURP + Button Search.
 *  - Mensajes: error rojo, resultadoFolio Tarjeta, resultados vacío "No encontramos...", o listado
 *    con conteo y TarjetaSolicitud por id.
 *
 * Endpoints: lib/solicitud - consultarSolicitud, buscarPorCurp, normalizarCurp.
 * Const: CURP_LEN=18.
 * Nota: nombre de archivo ConsultarFolio.tsx pero componente se llama ConsultarCurp (legacy).
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import Button from '../shared/Button'
import Card from '../shared/Card'
import { Input } from '../shared/Input'
import TarjetaSolicitud from '../solicitud/TarjetaSolicitud'
import { consultarSolicitud, buscarPorCurp, normalizarCurp } from '../lib/solicitud'
import type { Solicitud } from '../types/solicitud'

// Longitud CURP 18 caracteres
const CURP_LEN = 18

/** ConsultarFolio (ConsultarCurp): búsqueda pública por CURP (lista) o folio (?folio=) con estados separados. */
export default function ConsultarCurp() {
  // curp input uppercase; loading/resultados/resultadoFolio/error + folioParam
  const [curp, setCurp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultados, setResultados] = useState<Solicitud[] | undefined>(undefined)
  const [resultadoFolio, setResultadoFolio] = useState<Solicitud | undefined>(undefined)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const folioParam = searchParams.get('folio')

    // Valida 18 chars, normaliza y llama buscarPorCurp
const consultarCurp = async (curpRaw: string) => {
    const curpNorm = normalizarCurp(curpRaw)
    if (curpNorm.length !== CURP_LEN) {
      setError('La CURP debe tener 18 caracteres.')
      setResultados(undefined)
      return
    }
    setLoading(true)
    setError('')
    setResultados(undefined)
    try {
      const res = await buscarPorCurp(curpNorm)
      setResultados(res.data)
    } catch {
      setError('Ocurrió un error al consultar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

    // Consulta puntual por folio para deep-link
const consultarFolio = async (folioRaw: string) => {
    setLoading(true)
    setError('')
    setResultadoFolio(undefined)
    const res = await consultarSolicitud(folioRaw)
    if (res.data) {
      setResultadoFolio(res.data)
    } else {
      setError(res.error ?? 'No se encontró la solicitud.')
    }
    setLoading(false)
  }

  // Si ?folio= en URL, auto-consulta detalle al montar
  useEffect(() => {
    if (!folioParam) return
    consultarFolio(folioParam)
  }, [folioParam])

  // Previene default, limpia folio y busca por CURP
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!curp.trim()) return
    setResultadoFolio(undefined)
    await consultarCurp(curp.trim())
  }

  // --- JSX: form CURP + botón Search + estados de resultado ---
  return (
    <div className="mx-auto max-w-lg py-4">
      <Card title="Consultar por CURP">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="CURP"
            value={curp}
            onChange={(e) => setCurp(e.target.value.toUpperCase())}
            placeholder="18 caracteres en mayúsculas"
            maxLength={CURP_LEN}
          />
          <Button type="submit" disabled={loading || !curp.trim()}>
            <Search className="mr-2 h-4 w-4" />
            {loading ? 'Buscando...' : 'Buscar'}
          </Button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {resultadoFolio && (
          <div className="mt-4 flex flex-col gap-3">
            <TarjetaSolicitud solicitud={resultadoFolio} />
          </div>
        )}

        {resultados && resultados.length === 0 && !error && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-alabaster/50 px-4 py-3 text-sm text-gray-institutional">
            No encontramos solicitudes con esa CURP.
          </div>
        )}

        {resultados && resultados.length > 0 && !error && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm font-medium text-gray-institutional">
              Se encontraron {resultados.length}{' '}
              {resultados.length === 1 ? 'solicitud' : 'solicitudes'}
            </p>
            {resultados.map((s) => (
              <TarjetaSolicitud key={s.id_solicitud} solicitud={s} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}