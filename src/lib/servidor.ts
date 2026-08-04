import { api } from './api'
import type { Solicitud } from '../types/solicitud'
import type { EstatusFase } from '../core/constants'

export interface ListadoSolicitudes {
  data: Solicitud[]
  total: number
}

export interface SolicitudVecino {
  id_solicitud: number
  folio_unico: string
  distancia_m: number
}

export function listarSolicitudes(params: {
  q?: string
  estatus?: string
  prioridad?: string
  page?: number
  pageSize?: number
  asc?: boolean
}): Promise<ListadoSolicitudes> {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.estatus) query.set('estatus', params.estatus)
  if (params.prioridad) query.set('prioridad', params.prioridad)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('page_size', String(params.pageSize))
  if (params.asc) query.set('asc', 'true')
  const qs = query.toString()
  return api.get<ListadoSolicitudes>(`/api/solicitudes${qs ? `?${qs}` : ''}`)
}

export function consultarFolio(folio: string): Promise<{ data: Solicitud }> {
  return api.get<{ data: Solicitud }>(`/api/solicitudes/folio/${encodeURIComponent(folio)}`)
}

export function solicitudesMapa(limit?: number): Promise<{ data: Solicitud[] }> {
  return api.get<{ data: Solicitud[] }>(
    `/api/solicitudes/mapa${limit ? `?limit=${limit}` : ''}`
  )
}

export function obtenerSolicitud(id: number): Promise<{ data: Solicitud }> {
  return api.get<{ data: Solicitud }>(`/api/solicitudes/${id}`)
}

export function concentracionVecinos(id: number): Promise<{ data: SolicitudVecino[] }> {
  return api.get<{ data: SolicitudVecino[] }>(`/api/solicitudes/${id}/vecinos`)
}

export function actualizarGeo(
  id: number,
  data: { calle: string; entre_calles: string }
): Promise<{ ok: boolean }> {
  return api.patch<{ ok: boolean }>(`/api/solicitudes/${id}/geo`, data)
}

export function actualizarObra(
  id: number,
  data: { tipo_solicitud: string; colonia: string; junta_auxiliar: string }
): Promise<{ ok: boolean }> {
  return api.patch<{ ok: boolean }>(`/api/solicitudes/${id}/obra`, data)
}

export function actualizarTramo(
  id: number,
  data: {
    distancia_tramo_m: number | null
    ancho_calle_m: number | null
    zona_zap: boolean
    cobertura_agua: boolean
    escuelas_cercanas: string[]
    iglesias_cercanas: string[]
    transportes_cercanos: string[]
  }
): Promise<{ ok: boolean }> {
  return api.patch<{ ok: boolean }>(`/api/solicitudes/${id}/tramo`, data)
}

export function actualizarEstatus(
  id: number,
  estatus: EstatusFase
): Promise<{ ok: boolean }> {
  return api.patch<{ ok: boolean }>(`/api/solicitudes/${id}/estatus`, {
    estatus_fase: estatus,
  })
}

export function eliminarSolicitud(id: number): Promise<{ ok: boolean }> {
  return api.delete<{ ok: boolean }>(`/api/solicitudes/${id}`)
}
