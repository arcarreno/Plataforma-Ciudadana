/**
 * @file theme.ts
 * @description
 * Definiciones de tema y accesibilidad para la aplicación.
 * Centraliza paleta institucional (colores), opciones de tamaño de fuente,
 * contraste y tipos de voz para TalkBack / Web Speech API.
 * No tiene dependencias externas; es importado por componentes de UI,
 * `Layout`, `useTalkBack` y el sistema de preferencias.
 *
 * Uso:
 * ```ts
 * import { colors, fontSizeValues, type FontSize } from '@/core/theme'
 * document.documentElement.style.fontSize = fontSizeValues[fontSize]
 * ```
 */

/**
 * Paleta de colores institucionales (SEMOVINFRA / Gobierno de Puebla).
 * `as const` congela valores y permite tipado literal.
 * - alabaster: fondo claro principal
 * - guinda: color primario institucional
 * - guindaLight / guindaDark: variantes para hover/active
 * - grayInstitutional: texto secundario
 * - alabasterDark: fondo alternativo / bordes suaves
 */
export const colors = {
  alabaster: '#EDEAE0',
  guinda: '#7d2447',
  guindaLight: '#a3325f',
  guindaDark: '#5c1a34',
  grayInstitutional: '#636569',
  alabasterDark: '#d5d2c8',
} as const

/**
 * Opciones válidas de tamaño de fuente para accesibilidad.
 * Se persiste en localStorage y afecta `document.documentElement.style.fontSize`.
 */
export const fontSizeOptions = ['normal', 'large', 'xlarge'] as const

/**
 * Tipo unión derivado de `fontSizeOptions`.
 * Garantiza que solo se usen tamaños válidos en props y estado.
 */
export type FontSize = (typeof fontSizeOptions)[number]

/**
 * Mapeo de cada `FontSize` a su valor CSS aplicado al root.
 * `100%` = base del navegador, `150%`/`200%` para usuarios con baja visión.
 */
export const fontSizeValues: Record<FontSize, string> = {
  normal: '100%',
  large: '150%',
  xlarge: '200%',
}

/**
 * Etiquetas cortas para mostrar en el selector de tamaño de fuente en la UI.
 * `A`, `A+`, `A++` es convención común de accesibilidad.
 */
export const fontLabels: Record<FontSize, string> = {
  normal: 'A',
  large: 'A+',
  xlarge: 'A++',
}

/**
 * Modos de contraste disponibles (claro/oscuro).
 * `light` = tema institucional claro, `dark` = alto contraste oscuro.
 */
export const contrastOptions = ['light', 'dark'] as const

/**
 * Tipo unión para el modo de contraste.
 */
export type Contrast = (typeof contrastOptions)[number]

/**
 * Tipos de voz disponibles para síntesis de voz (TalkBack).
 * Se usa en `useTalkBack` y `lib/speech` para seleccionar voz femenina/masculina en español.
 */
export const voiceOptions = ['female', 'male'] as const

/**
 * Tipo unión para el tipo de voz seleccionada por el usuario.
 */
export type VoiceType = (typeof voiceOptions)[number]  // 'female' | 'male'
