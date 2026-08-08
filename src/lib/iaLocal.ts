import type { IaLlenarResultado } from './servidor'
import { TIPOS_OBRA_NOMBRES } from '../core/constants'

const MAX_K = {
  nombre: 80,
  apellido: 40,
  curp: 18,
  telefono: 10,
  correo: 60,
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ---------------------------------------------------------------------------
// Decodificación de dictado hablado: palabras → dígitos / letras
// El reconocimiento de voz es-MX transcribe letra-leída y números sueltos
// como palabras ("cero", "tres", "equis", "ge"), lo que rompe CURP y teléfono.
// ---------------------------------------------------------------------------

const PALABRA_DIGITO: Record<string, string> = {
  'cero': '0',
  'uno': '1',
  'dos': '2',
  'tres': '3',
  'cuatro': '4',
  'cinco': '5',
  'seis': '6',
  'siete': '7',
  'ocho': '8',
  'nueve': '9',
  'diez': '10',
  'once': '11',
  'doce': '12',
  'trece': '13',
  'catorce': '14',
  'quince': '15',
  'dieciseis': '16',
  'diecisiete': '17',
  'dieciocho': '18',
  'diecinueve': '19',
  'veinte': '20',
  'veintiuno': '21',
  'veintidos': '22',
  'veintitres': '23',
  'veinticuatro': '24',
  'veinticinco': '25',
  'veintiseis': '26',
  'veintisiete': '27',
  'veintiocho': '28',
  'veintinueve': '29',
  'treinta': '30',
  'cuarenta': '40',
  'cincuenta': '50',
  'sesenta': '60',
  'setenta': '70',
  'ochenta': '80',
  'noventa': '90',
  'cien': '100',
}

const PALABRA_LETRA: Record<string, string> = {
  'a': 'A',
  'be': 'B',
  'b': 'B',
  'ce': 'C',
  'c': 'C',
  'de': 'D',
  'd': 'D',
  'e': 'E',
  'efe': 'F',
  'ef': 'F',
  'f': 'F',
  'ge': 'G',
  'g': 'G',
  'hache': 'H',
  'h': 'H',
  'i': 'I',
  'jota': 'J',
  'j': 'J',
  'ka': 'K',
  'k': 'K',
  'ele': 'L',
  'el': 'L',
  'l': 'L',
  'eme': 'M',
  'em': 'M',
  'm': 'M',
  'ene': 'N',
  'ne': 'N',
  'n': 'N',
  'eñe': 'Ñ',
  'o': 'O',
  'pe': 'P',
  'p': 'P',
  'cu': 'Q',
  'q': 'Q',
  'erre': 'R',
  'ere': 'R',
  'r': 'R',
  'ese': 'S',
  'se': 'S',
  's': 'S',
  'te': 'T',
  't': 'T',
  'u': 'U',
  'uve': 'V',
  've': 'V',
  'v': 'V',
  'uve doble': 'W',
  'doble ve': 'W',
  'doble u': 'W',
  'equis': 'X',
  'ex': 'X',
  'x': 'X',
  'ye': 'Y',
  'igriega': 'Y',
  'zeta': 'Z',
  'z': 'Z',
}

const TOKENS_IRRELEVANTES = new Set(['y', 'o', 'e', 'a', 'el', 'la', 'mi', 'es', 'con', 'de', 'del', 'al', 'pero', 'por', 'que'])

function coincidirTipo(texto: string): string {
  const t = normalizar(texto.toLowerCase())
  const match = TIPOS_OBRA_NOMBRES.find((nombre) => {
    const n = normalizar(nombre.toLowerCase())
    return t.includes(n)
  })
  if (match) return match
  const sinonimos: [RegExp, string][] = [
    [/paviment/, 'Pavimentación'],
    [/guarnicion/, 'Guarniciones'],
    [/banqueta/, 'Banquetas'],
    [/acera/, 'Banquetas'],
    [/domo/, 'Domos en parques públicos (no escuelas)'],
    [/parque/, 'Mantenimiento y construcción de parques'],
    [/espacios? públicos?/, 'Rehabilitación de espacios públicos'],
    [/alumbrado|electrica|electrif/, 'Ampliación de Red eléctrica y/o electrificación'],
    [/drenaje|sanitario|pluvial/, 'Drenaje (Pluvial o sanitario)'],
    [/alcantarillado|coladera/, 'Alcantarillado'],
    [/demolicio/, 'Maquinaria - Demoliciones'],
    [/rastreo/, 'Maquinaria - Rastreo'],
    [/fresado/, 'Maquinaria - Fresado o Balastro'],
    [/reductor/, 'Maquinaria - Reparación de reductores de velocidad'],
    [/aula|escuel/, 'Mantenimiento y construcción de aulas en espacios educativos'],
    [/edificio/, 'Obras en edificios públicos'],
  ]
  for (const [re, nombre] of sinonimos) {
    if (re.test(t)) return nombre
  }
  return ''
}

// Errores típicos del reconocimiento de voz es-MX al leer dígitos.
const MISHEARD_DIGITO: Record<string, string> = {
  'pero': '0',
  'perro': '0',
  'cerro': '0',
  'sero': '0',
  'sere': '0',
  'sitio': '7',
  'ocho': '8',
  'nueve': '9',
}

function decodificarTelefono(texto: string): string {
  const limpio = normalizar(texto.toLocaleLowerCase('es')).replace(/[^\w\s]/g, ' ')
  let out = ''
  for (const tok of limpio.split(/\s+/)) {
    if (!tok) continue
    if (tok in PALABRA_DIGITO) { out += PALABRA_DIGITO[tok]; continue }
    if (tok in MISHEARD_DIGITO) { out += MISHEARD_DIGITO[tok]; continue }
    const solo = tok.replace(/[^0-9]/g, '')
    if (solo) out += solo
  }
  return out
}

function extraerTelefono(texto: string): string {
  let tel = decodificarTelefono(texto)
  if (!tel) return ''
  // Quitar prefijo internacional mexicano si el reconocimiento lo capturó
  if (tel.startsWith('521') && tel.length >= 13) tel = tel.slice(2)
  else if (tel.startsWith('52') && tel.length >= 12 && tel[2] !== '51') tel = tel.slice(2)

  if (!tel) return ''
  // Ventanas de 10 dígitos válidas (móvil MX no empieza con 0 ni 1)
  let mejor = ''
  for (let i = 0; i <= tel.length - 10; i++) {
    const win = tel.slice(i, i + 10)
    const c0 = win[0]
    if (c0 === '0' || c0 === '1') continue
    if (win === '0000000000' || win === '1000000000') continue
    mejor = win // quedarse con la última ventana válida (la más reciente del dictado)
  }
  if (mejor) return mejor
  // Fallback: la última corrida larga
  const corridas = tel.match(/\d{6,}/g) ?? []
  const ult = corridas[corridas.length - 1] ?? tel
  return (ult.length === 10 ? ult : ult.length > 10 ? ult.slice(-10) : tel.length === 10 ? tel : '')
}

function extraerCorreo(texto: string): string {
  const m = texto.match(/[\w.+-]+@[\w-]+\.[\w.]+/)
  return m ? m[0].toLowerCase() : ''
}

/**
 * Convierte texto hablado o mezclado en una secuencia plana de caracteres
 * útiles para una CURP (letras + dígitos), limpiando ruido del STT.
 */
function textoSoloCurp(texto: string): string {
  const limpio = normalizar(texto.toLocaleLowerCase('es')).replace(/[^\w\s]/g, ' ')
  let out = ''
  for (const tok of limpio.split(/\s+/)) {
    if (!tok) continue
    if (tok in PALABRA_DIGITO) { out += PALABRA_DIGITO[tok]; continue }
    if (tok in PALABRA_LETRA) { out += PALABRA_LETRA[tok]; continue }
    if (tok in MISHEARD_DIGITO) { out += MISHEARD_DIGITO[tok]; continue }
    if (TOKENS_IRRELEVANTES.has(tok)) continue
    const solo = tok.replace(/[^0-9a-z]/gi, '')
    if (solo) out += solo.toUpperCase()
  }
  return out
}

function extraerCurp(texto: string): string {
  // 1) Intento directo sobre el texto crudo (si el usuario escribió la CURP)
  const crudo = texto.toUpperCase()
  const m = crudo.match(/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/)
  if (m) return m[0]

  // 2) Dictado hablado: decodificar palabras a letras/dígitos y buscar patrón
  const e = textoSoloCurp(texto).toUpperCase()
  const m2 = e.match(/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/)
  if (m2) return m2[0]

  // 3) Prefijo progresivo (dictado a media lectura): aceptar solo si ya hay
  //    al menos 6 dígitos claros, para no inventar una CURP de cualquier texto.
  if (!/\d{6}/.test(e)) return ''
  const pref = e.match(/^[A-Z]{4}(?=\d)/)
  if (pref) {
    const cabeza = pref[0]
    const digitos = e.slice(cabeza.length).match(/^\d{1,6}/)?.[0] ?? ''
    if (digitos) return (cabeza + digitos).slice(0, 18)
  }
  return ''
}

function limpiarValor(v: string): string {
  return v
    .trim()
    .replace(/[.,;:!?¿¡\s]+$/g, '')
    .replace(/\s+/g, ' ')
}

function quitarRelleno(texto: string, campo: string): string {
  let t = texto.trim()
  if (campo === 'nombre' || campo === 'nombres') {
    t = t.replace(/^(me llamo|mi nombre es|mi nombre es|soy|el nombre es|me llamo es)\s+/i, '')
  }
  if (campo === 'apellido_paterno' || campo === 'apellido_materno') {
    t = t.replace(/^(mi apellido|el apellido|apellido)\s+(paterno|materno)?\s*(es|de)?\s+/i, '')
  }
  if (campo === 'curp') t = t.replace(/^(mi curp|la curp|curp)\s*(es)?\s+/i, '')
  if (campo === 'telefono') t = t.replace(/^(mi telefono|el telefono|telefono)\s*(es)?\s+/i, '')
  if (campo === 'colonia') t = t.replace(/^(en la colonia|en colonia|la colonia|mi colonia|en)\s+/i, '')
  const idx = t.indexOf('mi telefono es')
  if (idx === -1 && campo === 'telefono') {
    const m = t.match(/\d[\d\s()-]*$/) ?? t.match(/\d/)
    if (m) return m[0]
  }
  return t
}

export function extraerCampo(campo: string, texto: string): string {
  if (campo === 'telefono') return extraerTelefono(texto) || ''
  if (campo === 'curp') return extraerCurp(texto) || textoSoloCurp(texto).slice(0, MAX_K.curp)
  if (campo === 'correo') return extraerCorreo(texto) || limpiarValor(quitarRelleno(texto, campo)).slice(0, MAX_K.correo)
  if (campo === 'tipo') return coincidirTipo(texto)
  return limpiarValor(quitarRelleno(texto, campo)).slice(0, MAX_K.nombre)
}

export function extraerTodo(texto: string): Partial<IaLlenarResultado> {
  const out: Partial<IaLlenarResultado> = {}
  const tel = extraerTelefono(texto)
  const curp = extraerCurp(texto)
  const correo = extraerCorreo(texto)
  const tipo = coincidirTipo(texto)
  if (tel) out.telefono = tel
  if (curp) out.curp = curp
  if (correo) out.correo = correo
  if (tipo) out.tipo_solicitud = tipo

  const mNombre = texto.match(/(?:mi nombre es|me llamo|soy|nombre)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ\s]+?)(?:[,;.]|\s+(?:en|de|que|para|y mi|mi tel|mi correo|mi numero|mi colonia|la colonia|mi curp))/i)
  if (mNombre) {
    const nombreCompleto = limpiarValor(mNombre[1])
    if (nombreCompleto) out.nombre_solicitante = nombreCompleto
  }
  return out
}