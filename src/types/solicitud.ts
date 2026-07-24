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

  descripcion: string
  rutas_evidencia: string[]

  peso_ranking?: number
  estatus_fase?: string
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
  latitud: string
  longitud: string

  descripcion: string
  archivos: File[]
}

export type SolicitudErrors = Partial<Record<keyof SolicitudFormData, string>>
