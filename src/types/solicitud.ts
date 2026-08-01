import type { EstatusFase } from '../core/constants'

export interface Solicitud {
  id_solicitud?: number
  folio_unico?: string

  nombre_solicitante: string
  curp: string
  telefono: string
  correo: string
  aviso_privacidad_aceptado: boolean

  tipo_solicitud: string
  colonia: string
  junta_auxiliar: string
  latitud: number
  longitud: number

  calle?: string
  entre_calles?: string

  tramo_lat_ini?: number
  tramo_lng_ini?: number
  tramo_lat_fin?: number
  tramo_lng_fin?: number
  tramo_puntos?: { lat: number; lng: number }[]

  descripcion: string
  rutas_evidencia: string[]

  zona_zap?: boolean
  cobertura_agua?: boolean
  escuelas_cercanas?: string[]
  iglesias_cercanas?: string[]
  transportes_cercanos?: string[]
  distancia_tramo_m?: number
  ancho_calle_m?: number

  peso_ranking?: number
  estatus_fase?: EstatusFase
  fecha_creacion?: string
}

export interface SolicitudFormData {
  nombre_solicitante: string
  curp: string
  telefono: string
  correo: string
  aviso_privacidad_aceptado: boolean

  tipo_solicitud: string
  colonia: string
  junta_auxiliar: string
  calle: string
  entre_calles: string
  zona_zap: boolean
  cobertura_agua: boolean
  latitud: string
  longitud: string

  tramo_lat_ini: string
  tramo_lng_ini: string
  tramo_lat_fin: string
  tramo_lng_fin: string

  descripcion: string
  archivos: File[]
}

export type SolicitudErrors = Partial<Record<keyof SolicitudFormData, string>> & {
  apellido_paterno?: string
  apellido_materno?: string
  nombres?: string
}
