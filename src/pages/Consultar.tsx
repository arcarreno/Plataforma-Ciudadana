import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import Button from '../shared/Button'
import Card from '../shared/Card'
import { useAuth } from '../contexts/AuthContext'
import TarjetaSolicitud from '../solicitud/TarjetaSolicitud'
import { consultarSolicitud, listarSolicitudesPorNombre } from '../lib/solicitud'
import { nombreCompleto } from '../types/auth'
import type { Solicitud } from '../types/solicitud'

export default function Consultar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const folioParam = searchParams.get('folio')

  const [loading, setLoading] = useState(true)
  const [resultados, setResultados] = useState<Solicitud[]>([])
  const [resultadoFolio, setResultadoFolio] = useState<Solicitud | undefined>(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/consultar-curp', { replace: true })
      return
    }
    let activo = true
    if (folioParam) {
      consultarSolicitud(folioParam).then((res) => {
        if (!activo) return
        if (res.data) {
          setResultadoFolio(res.data)
        } else {
          setError(res.error ?? 'No se encontró la solicitud.')
        }
        setLoading(false)
      })
    } else {
      listarSolicitudesPorNombre(nombreCompleto(user)).then((res) => {
        if (!activo) return
        setResultados(res.data)
        setLoading(false)
      }).catch(() => {
        if (!activo) return
        setError('Ocurrió un error al consultar tus peticiones. Intenta de nuevo.')
        setLoading(false)
      })
    }
    return () => { activo = false }
  }, [user, folioParam, navigate])

  if (!user) return null

  return (
    <div className="mx-auto max-w-lg py-4">
      <Card title="Consultar">
        {loading && (
          <p className="text-sm text-gray-institutional/70">Cargando tus peticiones...</p>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && resultadoFolio && (
          <div className="flex flex-col gap-3">
            <TarjetaSolicitud solicitud={resultadoFolio} />
          </div>
        )}

        {!loading && !error && !resultadoFolio && resultados.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-alabaster/50 px-4 py-8 text-center text-sm text-gray-institutional">
            <FileText className="h-8 w-8 text-gray-institutional/40" />
            <p>No tienes peticiones registradas.</p>
            <Button variant="secondary" onClick={() => navigate('/nueva-solicitud')}>
              Crear una nueva solicitud
            </Button>
          </div>
        )}

        {!loading && !error && !resultadoFolio && resultados.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-gray-institutional">
              Se encontraron {resultados.length}{' '}
              {resultados.length === 1 ? 'petición' : 'peticiones'}
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