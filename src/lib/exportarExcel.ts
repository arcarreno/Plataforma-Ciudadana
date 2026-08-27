/**
 * @file exportarExcel.ts
 * @description
 * Exportación de solicitudes a Excel (.xlsx) usando SheetJS (`xlsx`).
 * Define el esquema de columnas (`COLUMNAS_EXPORT`) y la función `exportarExcel`
 * que materializa un libro con una hoja "Solicitudes".
 *
 * Columnas:
 * - Cada entrada `ColExport` tiene `label` (encabezado en español) y `render`
 *   (extrae/formatea el valor desde `Solicitud`). Incluye folio, datos personales,
 *   ubicación (colonia/junta/calle/entre), coordenadas, métricas de tramo,
 *   flags ZAP/agua, listas de entorno (escuelas/iglesias/transportes), peso y estatus.
 * - Los booleanos se mapean a "Sí"/"No" y los arrays a `join(', ')`.
 *
 * Flujo `exportarExcel`:
 * 1. Mapea cada `Solicitud` a un objeto `Record<label, value>` aplicando `render`.
 * 2. Crea la hoja con `XLSX.utils.json_to_sheet` (orden de columnas según `COLUMNAS_EXPORT`).
 * 3. Ajusta anchos con `!cols` (`wch` = min(50, max(label.length,14))) para legibilidad.
 * 4. Crea libro, añade hoja "Solicitudes" y dispara descarga con `XLSX.writeFile`.
 */

import * as XLSX from 'xlsx'
import type { Solicitud } from '../types/solicitud'

/** Definición de una columna exportable: etiqueta y función de extracción desde Solicitud. */
interface ColExport {
  label: string
  render: (s: Solicitud) => string | number
}

/**
 * Esquema de columnas del Excel de solicitudes.
 * El orden aquí determina el orden de columnas en la hoja.
 */
export const COLUMNAS_EXPORT: ColExport[] = [
  { label: 'Folio', render: s => s.folio_unico ?? '' },
  { label: 'Nombre del solicitante', render: s => s.nombre_solicitante ?? '' },
  { label: 'CURP', render: s => s.curp ?? '' },
  { label: 'Teléfono', render: s => s.telefono ?? '' },
  { label: 'Correo electrónico', render: s => s.correo ?? '' },
  { label: 'Tipo de solicitud', render: s => s.tipo_solicitud ?? '' },
  { label: 'Colonia', render: s => s.colonia ?? '' },
  { label: 'Junta auxiliar', render: s => s.junta_auxiliar ?? '' },
  { label: 'Calle', render: s => s.calle ?? '' },
  { label: 'Entre calles', render: s => s.entre_calles ?? '' },
  { label: 'Descripción', render: s => s.descripcion ?? '' },
  { label: 'Latitud', render: s => s.latitud },
  { label: 'Longitud', render: s => s.longitud },
  { label: 'Distancia tramo (m)', render: s => s.distancia_tramo_m ?? '' },
  { label: 'Ancho de calle (m)', render: s => s.ancho_calle_m ?? '' },
  { label: 'Zona ZAP', render: s => (s.zona_zap != null ? (s.zona_zap ? 'Sí' : 'No') : '') },
  { label: 'Cobertura de agua', render: s => (s.cobertura_agua != null ? (s.cobertura_agua ? 'Sí' : 'No') : '') },
  { label: 'Escuelas cercanas', render: s => (s.escuelas_cercanas ?? []).join(', ') },
  { label: 'Iglesias cercanas', render: s => (s.iglesias_cercanas ?? []).join(', ') },
  { label: 'Transportes cercanos', render: s => (s.transportes_cercanos ?? []).join(', ') },
  { label: 'Peso (ranking)', render: s => s.peso_ranking ?? '' },
  { label: 'Estatus', render: s => s.estatus_fase ?? '' },
  { label: 'Fecha de creación', render: s => s.fecha_creacion ?? '' },
]

/**
 * Genera y descarga un archivo Excel con las solicitudes dadas.
 * @param solicitudes - Array de solicitudes a exportar (cada una será una fila).
 * @param nombreArchivo - Nombre del archivo .xlsx (default "solicitudes_semovinfra.xlsx").
 */
export function exportarExcel(solicitudes: Solicitud[], nombreArchivo = 'solicitudes_semovinfra.xlsx') {
  // Construye filas como objetos {label: valor} aplicando cada render de columna.
  const filas = solicitudes.map(s => {
    const fila: Record<string, string | number> = {}
    for (const col of COLUMNAS_EXPORT) {
      fila[col.label] = col.render(s)
    }
    return fila
  })

  const ws = XLSX.utils.json_to_sheet(filas)
  // Anchos de columna: al menos 14 caracteres, como máximo 50, según largo del label.
  ws['!cols'] = COLUMNAS_EXPORT.map(c => ({ wch: Math.min(50, Math.max(c.label.length, 14)) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes')
  XLSX.writeFile(wb, nombreArchivo)
}
