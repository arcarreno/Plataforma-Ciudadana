/**
 * @file constants.ts
 * @description
 * Constantes centrales de la aplicación "Atención Ciudadana" (SEMOVINFRA).
 * Centraliza valores de negocio reutilizables en toda la app para evitar
 * magic strings/numbers: nombre de la app, límites de solicitudes por mes,
 * puntajes de ranking, prefijo de folio, catálogo de tipos de obra,
 * mapeo tipo→departamento responsable y listado oficial de juntas auxiliares.
 *
 * Dependencias: ninguna (módulo puro). Es importado por tipos (`solicitud.ts`),
 * lógica de negocio, formularios y utilidades geográficas.
 *
 * Uso:
 * ```ts
 * import { CATALOGO_TIPOS_OBRA, getPrecioObra, JUNTAS_AUXILIARES } from '@/core/constants'
 * ```
 */

// ---------------------------------------------------------------------------
// Identidad y reglas de negocio
// ---------------------------------------------------------------------------

/**
 * Nombre visible de la aplicación. Se usa en títulos, headers y branding.
 */
export const APP_NAME = 'Atención Ciudadana'

/**
 * Número máximo de solicitudes que un ciudadano puede registrar por mes.
 * Regla de negocio para evitar spam y distribuir carga operativa.
 */
export const MAX_SOLICITUDES_PER_MONTH = 3

/**
 * Puntaje base otorgado a toda solicitud en el ranking de priorización.
 * A partir de aquí se suman bonificaciones por evidencia, concentración, etc.
 */
export const RANKING_PUNTOS_BASE = 5

/**
 * Bonificación adicional cuando la solicitud incluye evidencia fotográfica.
 * Incentiva reportes con sustento visual para validar más rápido.
 */
export const RANKING_PUNTOS_CON_EVIDENCIA = 10

/**
 * Bonificación cuando hay concentración de solicitudes en la misma zona/colonia.
 * Refleja necesidad colectiva y prioriza intervenciones con mayor impacto.
 */
export const RANKING_PUNTOS_CONCENTRACION = 12

/**
 * Bonificación cuando el solicitante tiene cargo público (admin/revisor/diputado/senador).
 * Se usa en el cálculo de peso de ranking; ver `esCargoPublico()`.
 */
export const RANKING_PUNTOS_CARGO_PUBLICO = 15

/**
 * Prefijo usado para generar folios únicos de solicitud (ej. ST-2024-0001).
 * Convención institucional para trazabilidad.
 */
export const FOLIO_PREFIX = 'ST'

// ---------------------------------------------------------------------------
// Estatus / fases del flujo de una solicitud
// ---------------------------------------------------------------------------

/**
 * Lista exhaustiva de fases/estatus por las que puede transitar una solicitud.
 * `as const` preserva literales para tipado estricto y autocompletado.
 * Incluye etapas de revisión, asignación a departamentos y cierres.
 */
export const ESTATUS_OPCIONES = [
  'Revision',
  'Dirección General de Planeación y Proyectos',
  'Departamento de Pavimentos, Mantenimiento y Conservación',
  'Departamento de Espacios Educativos',
  'Departamento de Espacios Públicos',
  'Departamento de Infraestructura Urbana',
  'Concluido favorable',
  'Concluido no favorable',
] as const

/**
 * Subconjunto de estatus considerados "activos" (aún en trámite).
 * Útil para filtros, dashboards y conteos de pendientes.
 */
export const ESTATUS_ACTIVOS = [
  'Revision',
  'Dirección General de Planeación y Proyectos',
] as const

/**
 * Tipo unión derivado de `ESTATUS_OPCIONES`.
 * Garantiza que solo valores válidos sean asignados a `Solicitud.estatus_fase`.
 */
export type EstatusFase = typeof ESTATUS_OPCIONES[number]

// ---------------------------------------------------------------------------
// Catálogo de tipos de obra
// ---------------------------------------------------------------------------

/**
 * Representa un tipo de obra del catálogo oficial.
 * @property nombre - Nombre descriptivo mostrado al usuario.
 * @property precio - Costo referencial (actualmente 0 para todos, reservado para futuro).
 */
export interface TipoObra {
  nombre: string
  precio: number
}

/**
 * Catálogo maestro de tipos de obra disponibles para seleccionar en el formulario.
 * Es la fuente de verdad para selects y validaciones.
 * Mantener sincronizado con `TIPO_A_DEPARTAMENTO` para el enrutamiento automático.
 */
export const CATALOGO_TIPOS_OBRA: TipoObra[] = [
  { nombre: 'Pavimentación', precio: 0 },
  { nombre: 'Guarniciones', precio: 0 },
  { nombre: 'Banquetas', precio: 0 },
  { nombre: 'Domos en parques públicos (no escuelas)', precio: 0 },
  { nombre: 'Rehabilitación de espacios públicos', precio: 0 },
  { nombre: 'Bacheo', precio: 0 },
  { nombre: 'Maquinaria - Rastreo', precio: 0 },
  { nombre: 'Maquinaria - Demoliciones', precio: 0 },
  { nombre: 'Maquinaria - Fresado o Balastro', precio: 0 },
  { nombre: 'Maquinaria - Reparación de reductores de velocidad', precio: 0 },
  { nombre: 'Mantenimiento y construcción de aulas en espacios educativos', precio: 0 },
  { nombre: 'Obras en edificios públicos', precio: 0 },
  { nombre: 'Mantenimiento y construcción de parques', precio: 0 },
  { nombre: 'Ampliación de Red eléctrica y/o electrificación', precio: 0 },
  { nombre: 'Drenaje (Pluvial o sanitario)', precio: 0 },
  { nombre: 'Alcantarillado', precio: 0 },
]

/**
 * Lista plana de nombres de tipos de obra derivada del catálogo.
 * Útil para validaciones rápidas (`includes`) y para poblar opciones de UI sin precio.
 */
export const TIPOS_OBRA_NOMBRES: string[] = CATALOGO_TIPOS_OBRA.map(t => t.nombre)

/**
 * Mapeo de tipo de obra → departamento responsable que debe atenderla.
 * Define el enrutamiento automático tras la creación de la solicitud.
 * Las claves deben coincidir exactamente con `CATALOGO_TIPOS_OBRA[].nombre`.
 */
export const TIPO_A_DEPARTAMENTO: Record<string, string> = {
  Pavimentación: 'Dirección General de Planeación y Proyectos',
  Guarniciones: 'Dirección General de Planeación y Proyectos',
  Banquetas: 'Dirección General de Planeación y Proyectos',
  'Domos en parques públicos (no escuelas)': 'Dirección General de Planeación y Proyectos',
  'Rehabilitación de espacios públicos': 'Dirección General de Planeación y Proyectos',
  Bacheo: 'Departamento de Pavimentos, Mantenimiento y Conservación',
  'Maquinaria - Rastreo': 'Departamento de Pavimentos, Mantenimiento y Conservación',
  'Maquinaria - Demoliciones': 'Departamento de Pavimentos, Mantenimiento y Conservación',
  'Maquinaria - Fresado o Balastro': 'Departamento de Pavimentos, Mantenimiento y Conservación',
  'Maquinaria - Reparación de reductores de velocidad': 'Departamento de Pavimentos, Mantenimiento y Conservación',
  'Mantenimiento y construcción de aulas en espacios educativos': 'Departamento de Espacios Educativos',
  'Obras en edificios públicos': 'Departamento de Espacios Públicos',
  'Mantenimiento y construcción de parques': 'Departamento de Espacios Públicos',
  'Ampliación de Red eléctrica y/o electrificación': 'Departamento de Infraestructura Urbana',
  'Drenaje (Pluvial o sanitario)': 'Departamento de Infraestructura Urbana',
  Alcantarillado: 'Departamento de Infraestructura Urbana',
}

/**
 * Obtiene el precio referencial de un tipo de obra por su nombre.
 * @param nombre - Nombre exacto del tipo de obra (debe coincidir con el catálogo).
 * @returns Precio asociado o 0 si no existe (fallback seguro).
 */
export function getPrecioObra(nombre: string): number {
  // Búsqueda lineal en el catálogo; si no se encuentra, retorna 0 para no romper cálculos.
  return CATALOGO_TIPOS_OBRA.find(t => t.nombre === nombre)?.precio ?? 0
}

// ---------------------------------------------------------------------------
// Juntas auxiliares oficiales del municipio de Puebla
// ---------------------------------------------------------------------------

/**
 * Listado oficial de las 17 juntas auxiliares del municipio de Puebla.
 * Fuente de verdad para selects, validación y normalización geográfica (`geo.ts`).
 * `as const` permite tipado literal y evita mutaciones accidentales.
 */
export const JUNTAS_AUXILIARES = [
  'Ignacio Romero Vargas',
  'Ignacio Zaragoza',
  'La Libertad',
  'La Resurrección',
  'San Andrés Azumiatla',
  'San Baltazar Campeche',
  'San Baltazar Tetela',
  'San Felipe Hueyotlipan',
  'San Francisco Totimehuacan',
  'San Jerónimo Caleras',
  'San Miguel Canoa',
  'San Pablo Xochimehuacan',
  'San Pedro Zacachimalpa',
  'San Sebastián de Aparicio (San Sebastián Aparicio)',
  'Santa María Guadalupe Tecola',
  'Santa María Xonacatepec',
  'Santo Tomás Chautla',
] as const
