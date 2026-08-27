/**
 * @file solicitud.ts
 * @description
 * Tipos e interfaces para el dominio de "Solicitud" (obra/servicio).
 * Define la forma de los datos que se envían/reciben del backend (Supabase/servidor),
 * la forma del formulario controlado en React y el mapa de errores de validación.
 * Es el contrato central entre UI, validaciones y capa de API.
 *
 * Dependencias:
 * - `EstatusFase` de `../core/constants` para tipar la fase actual.
 *
 * Uso:
 * ```ts
 * import type { Solicitud, SolicitudFormData, SolicitudErrors } from '@/types/solicitud'
 * ```
 */

import type { EstatusFase } from '../core/constants'

/**
 * Entidad principal: solicitud ciudadana registrada en el sistema.
 * Corresponde a la fila en base de datos ( Supabase / servidor ) y se usa
 * en listados, detalle, mapas y exportación.
 */
export interface Solicitud {
  /** PK autoincremental en BD, opcional al crear (lo asigna el backend). */
  id_solicitud?: number
  /** Folio único con prefijo ST (ej. ST-2024-000123), generado por el backend. */
  folio_unico?: string

  // --- Datos del solicitante ---
  /** Nombre completo del solicitante (validado como "nombres + apellidos"). */
  nombre_solicitante: string
  /** CURP a 18 caracteres, validada con regex oficial. */
  curp: string
  /** Teléfono a 10 dígitos. */
  telefono: string
  /** Correo electrónico del solicitante. */
  correo: string
  /** Confirmación de aceptación del aviso de privacidad (obligatorio). */
  aviso_privacidad_aceptado: boolean

  // --- Ubicación y tipo ---
  /** Tipo de obra seleccionado del `CATALOGO_TIPOS_OBRA` (ej. "Pavimentación"). */
  tipo_solicitud: string
  /** Nombre de colonia normalizado/limpio. */
  colonia: string
  /** Junta auxiliar oficial (una de `JUNTAS_AUXILIARES`). */
  junta_auxiliar: string
  /** Latitud del punto o centroide del tramo (WGS84). */
  latitud: number
  /** Longitud del punto o centroide del tramo (WGS84). */
  longitud: number

  /** Calle principal de referencia (opcional, mejora geolocalización). */
  calle?: string
  /** Entre calles de referencia (opcional). */
  entre_calles?: string

  // --- Tramo (para obras lineales como pavimentación) ---
  /** Latitud del inicio del tramo (si aplica). */
  tramo_lat_ini?: number
  /** Longitud del inicio del tramo. */
  tramo_lng_ini?: number
  /** Latitud del fin del tramo. */
  tramo_lat_fin?: number
  /** Longitud del fin del tramo. */
  tramo_lng_fin?: number
  /** Polilínea completa del tramo como array de puntos {lat,lng} (Leaflet). */
  tramo_puntos?: { lat: number; lng: number }[]

  /** Descripción libre del problema/solicitud hecha por el ciudadano. */
  descripcion: string
  /** Rutas/URLs de archivos de evidencia subidos (fotos, PDFs). */
  rutas_evidencia: string[]

  // --- Enriquecimiento geoespacial (calculado en backend o import) ---
  /** Indica si la colonia está en Zona de Atención Prioritaria (ZAP). */
  zona_zap?: boolean
  /** Indica cobertura de agua potable en la zona. */
  cobertura_agua?: boolean
  /** Lista de escuelas cercanas detectadas por proximidad. */
  escuelas_cercanas?: string[]
  /** Lista de iglesias cercanas detectadas por proximidad. */
  iglesias_cercanas?: string[]
  /** Lista de transportes cercanos detectados. */
  transportes_cercanos?: string[]
  /** Longitud del tramo en metros (calculada con turf/distance). */
  distancia_tramo_m?: number
  /** Ancho estimado de calle en metros (si se captura). */
  ancho_calle_m?: number

  // --- Ranking y flujo ---
  /** Peso/puntaje calculado para priorización (base + bonificaciones). */
  peso_ranking?: number
  /** Fase actual del flujo de atención (ver `ESTATUS_OPCIONES`). */
  estatus_fase?: EstatusFase
  /** ISO string de creación (generado por BD). */
  fecha_creacion?: string

  // --- Visita de validación (si existe) ---
  /** ID de la visita de campo asociada. */
  visita_id?: number
  /** Estado de la visita (ej. pendiente, realizada, cancelada). */
  visita_estado?: string
  /** Fotos tomadas durante la visita. */
  visita_fotos?: string[]
  /** Comentarios del verificador en campo (nullable). */
  visita_comentarios?: string | null
  /** Nombres del usuario que realizó la visita. */
  visita_usuario_nombres?: string
  /** Apellidos del usuario que realizó la visita. */
  visita_usuario_apellidos?: string
}

/**
 * Datos controlados del formulario "Nueva Solicitud".
 * A diferencia de `Solicitud`, aquí coordenadas y tramos son `string`
 * porque vienen de `<input>` y se parsean/validan antes de enviar.
 * `archivos` son `File` nativos pendientes de subir.
 */
export interface SolicitudFormData {
  /** Nombre completo capturado en el form (se valida y separa si es necesario). */
  nombre_solicitante: string
  /** CURP capturada (18 chars, mayúsculas). */
  curp: string
  /** Teléfono capturado (10 dígitos). */
  telefono: string
  /** Correo capturado. */
  correo: string
  /** Checkbox de aviso de privacidad. */
  aviso_privacidad_aceptado: boolean

  /** Tipo de obra seleccionado. */
  tipo_solicitud: string
  /** Colonia capturada (con autocompletado). */
  colonia: string
  /** Junta auxiliar seleccionada. */
  junta_auxiliar: string
  /** Calle de referencia. */
  calle: string
  /** Entre calles de referencia. */
  entre_calles: string
  /** ¿Zona ZAP? (switch en el form). */
  zona_zap: boolean
  /** ¿Cobertura de agua? (switch). */
  cobertura_agua: boolean
  /** Latitud como string del input (se convierte a number al validar). */
  latitud: string
  /** Longitud como string del input. */
  longitud: string

  /** Latitud inicio de tramo (string). */
  tramo_lat_ini: string
  /** Longitud inicio de tramo (string). */
  tramo_lng_ini: string
  /** Latitud fin de tramo (string). */
  tramo_lat_fin: string
  /** Longitud fin de tramo (string). */
  tramo_lng_fin: string

  /** Descripción libre. */
  descripcion: string
  /** Archivos seleccionados por el usuario (aún no subidos). */
  archivos: File[]
}

/**
 * Mapa de errores de validación para `SolicitudFormData`.
 * Cada clave corresponde a un campo del form; el valor es el mensaje a mostrar.
 * Incluye tres campos adicionales (`apellido_paterno`, `apellido_materno`, `nombres`)
 * porque el form puede pedir el nombre desglosado y mapearlo a `nombre_solicitante`.
 */
export type SolicitudErrors = Partial<Record<keyof SolicitudFormData, string>> & {
  /** Error específico para apellido paterno (cuando se valida nombre desglosado). */
  apellido_paterno?: string
  /** Error específico para apellido materno. */
  apellido_materno?: string
  /** Error específico para nombres (sin apellidos). */
  nombres?: string
}
