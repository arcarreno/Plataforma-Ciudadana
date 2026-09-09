/**
 * @file PaqueteDetalle.tsx
 * @description Pestaña limpia de un paquete: sidebar + 1 columna con ÚNICAMENTE
 * las fichas enviadas (reutiliza PanelVistaFichas sin botón de detalle).
 * Solo remitente o destinatario (el backend lo verifica). Marca leído al abrir
 * si soy el destinatario. Requiere sesión.
 */
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Package } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getToken } from '../lib/auth'
import { api } from '../lib/api'
import { gruposConcentracion, type GrupoCluster } from '../lib/servidor'
import type { Solicitud } from '../types/solicitud'
import PanelVistaFichas from '../solicitud/PanelVistaFichas'

/** Encabezado del paquete con remitente y fecha. */
interface InfoPaquete {
  id: number
  remitente: string
  destinatario: string
  fecha: string
  leido: boolean
}

export default function PaqueteDetalle() {
  const { user } = useAuth()
  const { id } = useParams()
  const [info, setInfo] = useState<InfoPaquete | null>(null)
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [grupos, setGrupos] = useState<GrupoCluster[]>([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!user) return
    const token = getToken() ?? undefined
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    setCargando(true)
    setError('')
    api.get<{
      data: { paquete: InfoPaquete; total: number; solicitudes: Solicitud[] }
    }>(`/api/paquetes/${id}`, headers ? { headers } : undefined).then(
      (r) => {
        setInfo(r.data.paquete)
        setSolicitudes(r.data.solicitudes ?? [])
        setCargando(false)
        // Marca leído (best-effort, no bloquea la vista).
        api.patch(`/api/paquetes/${id}/leido`, {}, headers ? { headers } : undefined).catch(() => {})
        // Racimos globales para colapsar igual que en el panel.
        gruposConcentracion(token).then(
          (g) => setGrupos(g.data ?? []),
          () => setGrupos([]),
        )
      },
      (err) => {
        setError(err instanceof Error ? err.message.replace(/^API error \d+: /, '') : 'No se pudo abrir')
        setCargando(false)
      },
    )
  }, [user, id])

  if (!user) return <Navigate to="/iniciar-sesion" replace />

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      {cargando ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-guinda border-t-transparent" />
        </div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : (
        <PanelVistaFichas
          solicitudes={solicitudes}
          grupos={grupos}
          ocultarDetalle
          titulo={
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <Link
                to="/paquetes"
                className="flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-medium text-gray-institutional transition-colors hover:bg-guinda/5 hover:text-guinda"
              >
                <ArrowLeft className="h-4 w-4" />
                Paquetes
              </Link>
              {info && (
                <span className="flex items-center gap-2 text-sm text-gray-institutional/60">
                  <Package className="h-4 w-4 text-guinda" />
                  Paquete #{info.id} · de {info.remitente} · {solicitudes.length} ficha(s)
                </span>
              )}
            </span>
          }
        />
      )}
    </div>
  )
}
