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
  { nombre: 'Drenajes', precio: 5000 },
  { nombre: 'Pavimentación', precio: 2300 },
  { nombre: 'Adoquinamiento', precio: 2000 },
  { nombre: 'Rehabilitación', precio: 1900 },
  { nombre: 'Relaminación', precio: 1900 },
  { nombre: 'Guarniciones', precio: 850 },
  { nombre: 'Domo', precio: 4200 },
  { nombre: 'Banqueta y Guarniciones', precio: 450 },
  { nombre: 'Cancha de Futbol', precio: 1750 },
  { nombre: 'Puente Vehicular', precio: 0 },
  { nombre: 'Ampliación de Red de Agua Potable', precio: 3000 },
  { nombre: 'Puente Peatonal', precio: 27384 },
  { nombre: 'Construcción de Barda', precio: 800 },
  { nombre: 'Ampliación de Red de Agua Pluvial', precio: 3000 },
  { nombre: 'Introducción de Drenaje y Agua Potable', precio: 8000 },
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
