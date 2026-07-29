export const APP_NAME = 'Atención Ciudadana'
export const MAX_SOLICITUDES_PER_MONTH = 3
export const RANKING_PUNTOS_BASE = 5
export const RANKING_PUNTOS_CON_EVIDENCIA = 10
export const RANKING_PUNTOS_CONCENTRACION = 12
export const RANKING_PUNTOS_CARGO_PUBLICO = 15
export const FOLIO_PREFIX = 'ST'

export const ESTATUS_OPCIONES = [
  'Concluido favorable',
  'Concluido no favorable',
] as const

export type EstatusFase = typeof ESTATUS_OPCIONES[number]

export interface TipoObra {
  nombre: string
  precio: number
}

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
  { nombre: 'Obras en Centro Histórico', precio: 0 },
  { nombre: 'Obras en edificios públicos', precio: 0 },
  { nombre: 'Mantenimiento y construcción de parques', precio: 0 },
  { nombre: 'Ampliación de Red eléctrica y/o electrificación', precio: 0 },
  { nombre: 'Drenaje (Pluvial o sanitario)', precio: 0 },
  { nombre: 'Alcantarillado', precio: 0 },
]

export const TIPOS_OBRA_NOMBRES: string[] = CATALOGO_TIPOS_OBRA.map(t => t.nombre)

export function getPrecioObra(nombre: string): number {
  return CATALOGO_TIPOS_OBRA.find(t => t.nombre === nombre)?.precio ?? 0
}

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
