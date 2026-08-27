/**
 * @file curp.ts
 * @description
 * Utilidades de validación y generación de CURP (Clave Única de Registro de Población)
 * conforme al algoritmo oficial mexicano (SEGOB/RENAPO).
 * Permite validar formato, dígito verificador y coherencia con nombre completo,
 * además de calcular las 4 iniciales que derivan de apellidos y nombres.
 *
 * Dependencias: ninguna externa (solo APIs nativas de String/RegExp/Set).
 *
 * Flujo / Algoritmo CURP (18 posiciones):
 * - Pos 1-4: iniciales (paterno[0] + vocal interna paterno + materno[0]/X + nombre[0]).
 *   Si forman palabra soez de la lista `PALABRAS_MALAS`, la 2ª letra se reemplaza por `X`.
 * - Pos 5-10: fecha nacimiento YYMMDD.
 * - Pos 11: sexo H/M.
 * - Pos 12-16: consonantes internas + Placeholders.
 * - Pos 17: homoclave alfanumérica.
 * - Pos 18: dígito verificador = (10 - (suma ponderada % 10)) % 10, con alfabeto `0-9A-ZÑ`.
 *
 * Decisiones de diseño:
 * - `REGEX_CURP` incluye vocales acentuadas y Ñ para tolerar captura sin normalizar; luego se quitan acentos.
 * - `PARTICULAS` (DE, DEL, LA, ...) se ignoran al extraer iniciales y al elegir letra de nombre.
 * - `NOMBRES_EXCLUIDOS` (MARIA, JOSE, MA., J.) se saltan para tomar el nombre significativo (2º nombre).
 * - `quitarAcentos` usa `NFD` + rango `\u0300-\u036f` para de-accentuar de forma robusta.
 * - Dígito verificador itera 17 chars con peso decreciente `18 - i` (18..2) sobre `ALFABETO_DIGITO`.
 */

// ---------------------------------------------------------------------------
// Constantes del algoritmo CURP
// ---------------------------------------------------------------------------

/**
 * Expresión regular del formato CURP (18 chars):
 * - 4 letras (incluye acentuadas/Ñ por tolerancia),
 * - 6 dígitos (fecha YYMMDD),
 * - H/M,
 * - 5 letras,
 * - alfanumérico,
 * - dígito.
 * No valida dígito verificador ni palabra soez; solo estructura.
 */
const REGEX_CURP = /^[A-ZÁÉÍÓÚÜ]{4}\d{6}[HM][A-ZÁÉÍÓÚÜ]{5}[0-9A-ZÁÉÍÓÚÜ]\d$/

/** Partículas que se ignoran al partir nombres/apellidos (no aportan a iniciales). Ej. "DE LA CRUZ" → "CRUZ". */
const PARTICULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'MC', 'MAC', 'VAN', 'VON'])

/** Nombres de pila que se saltan si hay un segundo nombre más significativo (María/José y abreviaturas). */
const NOMBRES_EXCLUIDOS = new Set(['MA', 'MA.', 'MARIA', 'MARÍA', 'M.', 'M', 'J', 'J.', 'JOSE', 'JOSÉ'])

/**
 * Lista de combinaciones de 4 letras consideradas palabras soeces.
 * Si las iniciales forman una de éstas, la 2ª letra se cambia a `X` (regla oficial).
 */
const PALABRAS_MALAS = new Set([
  'BUEI', 'BUEY', 'CACA', 'CACO', 'CAGA', 'CAGO', 'CAKA', 'CAKO',
  'COGE', 'COJA', 'COJE', 'COJI', 'COJO', 'CULO', 'FETO',
  'GUEI', 'GUEY', 'JOTO', 'KACA', 'KACO', 'KAGA', 'KAGO', 'KAKE', 'KAKO',
  'KOGE', 'KOJO', 'KULO', 'MAME', 'MAMO', 'MEAR', 'MEAS', 'MEON', 'MION',
  'MOCA', 'MOCO', 'MULA', 'PEDA', 'PEDO', 'PENE', 'PUTA', 'PUTO', 'QULO',
  'RATA', 'RUIN', 'SENO', 'TETA', 'TETO', 'TULA', 'VAGO', 'VETE', 'WEBA', 'WEBO',
])

/** Conjunto de vocales (con y sin acento) para buscar la primera vocal interna del paterno. */
const VOCALES = new Set(['A', 'E', 'I', 'O', 'U', 'Á', 'É', 'Í', 'Ó', 'Ú', 'Ü'])

/**
 * Alfabeto usado para el cálculo del dígito verificador.
 * Incluye `Ñ` en posición 24 (valor 24) según tabla oficial.
 */
const ALFABETO_DIGITO = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/**
 * Datos de nombre necesarios para calcular/validar las iniciales de la CURP.
 * @property paterno - Apellido paterno (requerido).
 * @property materno - Apellido materno (opcional; si falta se usa `X`).
 * @property nombres - Nombre(s) de pila completo(s) (ej. "JUAN CARLOS").
 */
export interface NombreCURP {
  paterno: string
  materno?: string
  nombres: string
}

// ---------------------------------------------------------------------------
// Helpers de normalización y validación básica
// ---------------------------------------------------------------------------

/**
 * Quita diacríticos (acentos, diéresis) de un texto vía normalización NFD.
 * @param texto - Cadena con posibles acentos.
 * @returns Cadena sin marcas combinantes (ej. "JOSÉ" → "JOSE").
 */
export function quitarAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Valida solo el formato estructural de la CURP (regex), sin dígito verificador.
 * @param curp - CURP cruda (se hace trim+upper internamente).
 * @returns `true` si cumple `REGEX_CURP`.
 */
export function validarFormatoCURP(curp: string): boolean {
  return REGEX_CURP.test(curp.trim().toUpperCase())
}

/**
 * Valida el dígito verificador (pos 18) de la CURP según algoritmo ponderado.
 * @param curp - CURP completa de 18 caracteres (se normaliza y de-accentúa).
 * @returns `true` si el dígito calculado coincide con el último carácter; `false` si longitud ≠18, char fuera de alfabeto o mismatch.
 * @remarks Fórmula: suma = Σ(valor(c[i]) * (18 - i)) para i=0..16; dígito = (10 - (suma %10)) %10
 */
export function validarDigitoVerificador(curp: string): boolean {
  const c = quitarAcentos(curp.trim().toUpperCase())
  if (c.length !== 18) return false
  let suma = 0
  for (let i = 0; i < 17; i++) {
    const valor = ALFABETO_DIGITO.indexOf(c[i])
    if (valor === -1) return false // carácter no está en el alfabeto (ej. símbolo)
    suma += valor * (18 - i) // peso decreciente 18,17,...,2
  }
  const digito = (10 - (suma % 10)) % 10
  return String(digito) === c[17]
}

// ---------------------------------------------------------------------------
// Helpers internos para cálculo de iniciales
// ---------------------------------------------------------------------------

/**
 * Normaliza un texto para partición: mayúsculas, colapso de espacios y trim.
 * @param texto - Texto crudo.
 * @returns Texto limpio en mayúsculas y con un solo espacio entre palabras.
 */
function limpiarTexto(texto: string): string {
  return texto.toUpperCase().replace(/\s+/g, ' ').trim()
}

/**
 * Divide un texto en palabras significativas, filtrando partículas (DE, LA, etc.).
 * @param texto - Apellido o nombres.
 * @returns Array de tokens significativos en mayúsculas.
 */
function palabrasSignificativas(texto: string): string[] {
  return limpiarTexto(texto)
    .split(' ')
    .filter(p => p && !PARTICULAS.has(p))
}

/**
 * Obtiene la primera vocal interna de una palabra (desde índice 1).
 * @param palabra - Palabra en mayúsculas (ej. "HERNANDEZ").
 * @returns Vocal encontrada o `'X'` si no hay vocal interna.
 */
function vocalInterna(palabra: string): string {
  for (let i = 1; i < palabra.length; i++) {
    if (VOCALES.has(palabra[i])) return palabra[i]
  }
  return 'X'
}

/**
 * Obtiene la letra inicial de una palabra, mapeando `Ñ` → `X` (regla CURP).
 * @param palabra - Palabra en mayúsculas.
 * @returns Primera letra o `''` si está vacía; `X` si es `Ñ`.
 */
function letraInicial(palabra: string): string {
  const l = palabra[0] ?? ''
  return l === 'Ñ' ? 'X' : l
}

/**
 * Obtiene la inicial del nombre de pila según reglas:
 * - Si hay varios tokens, ignora `NOMBRES_EXCLUIDOS` (MARIA/JOSE) y toma el siguiente.
 * - Si todos son excluidos o solo hay uno excluido, usa ese.
 * @param nombres - Cadena de nombres completa.
 * @returns Letra inicial (con `Ñ`→`X`), o `X` si no hay tokens.
 */
function letraNombre(nombres: string): string {
  const tokens = palabrasSignificativas(nombres)
  if (tokens.length === 0) return 'X'
  const restantes = tokens.filter(t => !NOMBRES_EXCLUIDOS.has(t))
  return letraInicial(restantes.length > 0 ? restantes[0] : tokens[0])
}

// ---------------------------------------------------------------------------
// API pública de iniciales / validación compuesta
// ---------------------------------------------------------------------------

/**
 * Calcula las 4 iniciales de la CURP a partir de apellidos y nombres.
 * @param datos - Objeto `NombreCURP` con paterno, materno y nombres.
 * @returns String de 4 letras (ej. "HEGM") ya con corrección de palabra soez (`X` en pos 2 si aplica).
 * @example
 * calcularInicialesCURP({ paterno: 'Hernández', materno: 'García', nombres: 'María Luisa' }) // → "HEGL" (usa "Luisa")
 */
export function calcularInicialesCURP(datos: NombreCURP): string {
  // Normalizar apellidos a tokens significativos
  const paterno = palabrasSignificativas(datos.paterno).join(' ')
  const materno = datos.materno ? palabrasSignificativas(datos.materno).join(' ') : ''

  const l1 = letraInicial(paterno)      // 1ª letra paterno
  const l2 = vocalInterna(paterno)      // 1ª vocal interna paterno
  const l3 = materno ? letraInicial(materno) : 'X' // inicial materno o X
  const l4 = letraNombre(datos.nombres) // inicial nombre significativo

  let iniciales = l1 + l2 + l3 + l4
  // Corrección de palabra soez: si las 4 letras forman una mala palabra, cambiar 2ª por X
  if (PALABRAS_MALAS.has(quitarAcentos(iniciales))) {
    iniciales = l1 + 'X' + l3 + l4
  }
  return iniciales
}

/**
 * Verifica que las primeras 4 letras de la CURP coincidan con las iniciales calculadas del nombre.
 * De-accentúa ambos lados antes de comparar para tolerancia.
 * @param curp - CURP completa.
 * @param datos - Datos de nombre para calcular iniciales esperadas.
 * @returns `true` si coinciden exactamente.
 */
export function inicialesCoinciden(curp: string, datos: NombreCURP): boolean {
  const esperadas = quitarAcentos(calcularInicialesCURP(datos))
  const curpIniciales = quitarAcentos(curp.trim().toUpperCase().slice(0, 4))
  return esperadas === curpIniciales
}

/**
 * Validación compuesta de CURP contra nombre: formato + dígito verificador + iniciales.
 * @param curp - CURP a validar.
 * @param datos - Datos de nombre para validar coherencia de iniciales.
 * @returns `true` solo si las tres validaciones pasan.
 */
export function validarCURPConNombre(curp: string, datos: NombreCURP): boolean {
  return (
    validarFormatoCURP(curp) &&
    validarDigitoVerificador(curp) &&
    inicialesCoinciden(curp, datos)
  )
}
