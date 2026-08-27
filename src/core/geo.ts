/**
 * @file geo.ts
 * @description
 * Utilidades geográficas y de normalización de texto para colonias y juntas auxiliares.
 * Se encarga de limpiar y comparar nombres con tolerancia a acentos, mayúsculas,
 * espacios extra y prefijos numéricos (ej. "12 San Baltazar ...").
 * Centraliza la lógica de matching difuso contra el catálogo oficial `JUNTAS_AUXILIARES`.
 *
 * Dependencias:
 * - `JUNTAS_AUXILIARES` de `./constants` (catálogo oficial).
 *
 * Uso:
 * ```ts
 * import { matchJunta, cleanColoniaName, normalizeColoniaForMatch } from '@/core/geo'
 * matchJunta("12  San Baltazar  Campeche") // → "San Baltazar Campeche"
 * ```
 */

import { JUNTAS_AUXILIARES } from './constants'

/**
 * Mapa de caracteres acentuados/especiales a su equivalente ASCII sin acento.
 * Cubre vocales acentuadas, diéresis y ñ/Ñ. Se usa para comparación insensible a acentos.
 */
const ACCENT_MAP: Record<string, string> = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u',
  Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U',
  ü: 'u', Ü: 'U', ñ: 'n', Ñ: 'N',
}

/**
 * Elimina acentos y diéresis de una cadena usando `ACCENT_MAP`.
 * @param s - Cadena de entrada con posibles acentos.
 * @returns Cadena sin acentos (ej. "San Andrés" → "San Andres").
 */
function removeAccents(s: string) {
  // Reemplaza cada carácter acentuado por su equivalente sin acento.
  return s.replace(/[áéíóúÁÉÍÓÚüÜñÑ]/g, c => ACCENT_MAP[c] || c)
}

/**
 * Normaliza una cadena para comparación: sin acentos, minúsculas, espacios colapsados y trim.
 * @param s - Cadena a normalizar.
 * @returns Versión canónica lista para comparar con `===` o `includes`.
 */
function normalize(s: string) {
  // Orden: quitar acentos → minúsculas → colapsar espacios múltiples → trim.
  return removeAccents(s).toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Elimina prefijo numérico inicial (1-2 dígitos) si existe.
 * Ej. "12 San Baltazar Campeche" → "San Baltazar Campeche".
 * @param s - Cadena que puede venir con numeración de catálogo.
 * @returns Cadena sin prefijo numérico.
 */
function stripPrefix(s: string) {
  // Detecta 1-2 dígitos al inicio seguidos de espacios y captura el resto.
  const m = s.trim().match(/^\d{1,2}\s+(.*)/)
  return m ? m[1].trim() : s.trim()
}

/**
 * Intenta mapear un nombre crudo a una junta auxiliar oficial.
 * Estrategia tolerante: normaliza, prueba igualdad exacta y luego contención
 * en ambas direcciones (para nombres abreviados o con texto extra).
 *
 * @param rawName - Nombre tal cual viene de archivo/usuario (puede tener número, acentos, mayúsculas).
 * @returns Nombre oficial de `JUNTAS_AUXILIARES` si hay match, o el nombre limpio sin prefijo si no.
 */
export function matchJunta(rawName: string): string {
  // Normaliza el nombre de entrada sin prefijo para comparar de forma robusta.
  const cleaned = normalize(stripPrefix(rawName))
  for (const junta of JUNTAS_AUXILIARES) {
    // 1) Igualdad exacta normalizada (ideal).
    if (normalize(junta) === cleaned) return junta
    // 2) Contención difusa: permite abreviar o incluir texto adicional.
    if (normalize(junta).includes(cleaned) || cleaned.includes(normalize(junta))) return junta
  }
  // Sin coincidencia: devuelve el nombre original limpio (espacios colapsados, sin prefijo).
  return stripPrefix(rawName).replace(/\s+/g, ' ').trim()
}

/**
 * Limpia el nombre de una colonia para presentación: trim, colapsa espacios,
 * pasa a minúsculas y capitaliza cada palabra (Title Case).
 * @param rawName - Nombre crudo de colonia.
 * @returns Nombre formateado para mostrar en UI (ej. "  lomas  de  chapultepec " → "Lomas De Chapultepec").
 */
export function cleanColoniaName(rawName: string): string {
  return rawName
    .trim() // quita espacios al inicio/fin
    .replace(/\s+/g, ' ') // colapsa espacios múltiples
    .toLowerCase() // base en minúsculas
    .replace(/(^|\s)\w/g, c => c.toUpperCase()) // capitaliza inicial de cada palabra
}

/**
 * Normaliza nombre de colonia para comparación/matching (no para display).
 * Quita acentos, pasa a minúsculas, colapsa espacios y hace trim.
 * @param name - Nombre de colonia a normalizar.
 * @returns Cadena canónica para usar como clave de búsqueda/deduplicación.
 */
export function normalizeColoniaForMatch(name: string): string {
  return removeAccents(name).toLowerCase().replace(/\s+/g, ' ').trim()
}
