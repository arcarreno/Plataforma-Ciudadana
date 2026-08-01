import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import Button from '../shared/Button'
import Card from '../shared/Card'
import { Input } from '../shared/Input'
import { consultarSolicitud } from '../lib/solicitud'
import type { Solicitud } from '../types/solicitud'

export default function ConsultarFolio() {
  const [folio, setFolio] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{
    data?: Solicitud
    error?: string
  } | null>(null)
  const [searchParams] = useSearchParams()
  const folioParam = searchParams.get('folio')

  const consultar = async (f: string) => {
    setLoading(true)
    setResultado(null)
    const res = await consultarSolicitud(f)
    setResultado(res)
    setLoading(false)
  }

  useEffect(() => {
    if (!folioParam) return
    setFolio(folioParam)
    consultar(folioParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folioParam])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!folio.trim()) return
    consultar(folio.trim())
  }

  return (
    <div className="mx-auto max-w-lg py-4">
      <Card title="Consultar Folio">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Número de folio"
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            placeholder="ST-000001"
          />
          <Button type="submit" disabled={loading || !folio.trim()}>
            <Search className="mr-2 h-4 w-4" />
            {loading ? 'Buscando...' : 'Buscar'}
          </Button>
        </form>

        {resultado?.error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {resultado.error}
          </div>
        )}

        {resultado?.data && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl bg-alabaster/50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-guinda">Folio</span>
              <span className="font-bold text-guinda">
                {resultado.data.folio_unico}
              </span>
            </div>
            <div className="h-px bg-alabaster-dark" />
            <div className="flex justify-between">
              <span className="text-gray-institutional/60">Solicitante</span>
              <span className="text-gray-institutional">
                {resultado.data.nombre_solicitante}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-institutional/60">Tipo de obra</span>
              <span className="text-gray-institutional">
                {resultado.data.tipo_solicitud}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-institutional/60">Colonia</span>
              <span className="text-gray-institutional">
                {resultado.data.colonia}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-institutional/60">Estatus</span>
              <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${
                resultado.data.estatus_fase === 'Concluido favorable'
                  ? 'bg-green-100 text-green-700'
                  : resultado.data.estatus_fase === 'Concluido no favorable'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-guinda/10 text-guinda'
              }`}>
                {resultado.data.estatus_fase}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-institutional/60">Fecha</span>
              <span className="text-gray-institutional">
                {new Date(resultado.data.fecha_creacion ?? '').toLocaleDateString(
                  'es-MX',
                  {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }
                )}
              </span>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
