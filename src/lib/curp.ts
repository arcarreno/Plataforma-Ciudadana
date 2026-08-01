const REGEX_CURP = /^[A-ZÁÉÍÓÚÜ]{4}\d{6}[HM][A-ZÁÉÍÓÚÜ]{5}[0-9A-ZÁÉÍÓÚÜ]\d$/

const PARTICULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'MC', 'MAC', 'VAN', 'VON'])

const NOMBRES_EXCLUIDOS = new Set(['MA', 'MA.', 'MARIA', 'MARÍA', 'M.', 'M', 'J', 'J.', 'JOSE', 'JOSÉ'])

const PALABRAS_MALAS = new Set([
  'BUEI', 'BUEY', 'CACA', 'CACO', 'CAGA', 'CAGO', 'CAKA', 'CAKO',
  'COGE', 'COJA', 'COJE', 'COJI', 'COJO', 'CULO', 'FETO',
  'GUEI', 'GUEY', 'JOTO', 'KACA', 'KACO', 'KAGA', 'KAGO', 'KAKE', 'KAKO',
  'KOGE', 'KOJO', 'KULO', 'MAME', 'MAMO', 'MEAR', 'MEAS', 'MEON', 'MION',
  'MOCA', 'MOCO', 'MULA', 'PEDA', 'PEDO', 'PENE', 'PUTA', 'PUTO', 'QULO',
  'RATA', 'RUIN', 'SENO', 'TETA', 'TETO', 'TULA', 'VAGO', 'VETE', 'WEBA', 'WEBO',
])

const VOCALES = new Set(['A', 'E', 'I', 'O', 'U', 'Á', 'É', 'Í', 'Ó', 'Ú', 'Ü'])

const ALFABETO_DIGITO = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'

export interface NombreCURP {
  paterno: string
  materno?: string
  nombres: string
}

export function quitarAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function validarFormatoCURP(curp: string): boolean {
  return REGEX_CURP.test(curp.trim().toUpperCase())
}

export function validarDigitoVerificador(curp: string): boolean {
  const c = quitarAcentos(curp.trim().toUpperCase())
  if (c.length !== 18) return false
  let suma = 0
  for (let i = 0; i < 17; i++) {
    const valor = ALFABETO_DIGITO.indexOf(c[i])
    if (valor === -1) return false
    suma += valor * (18 - i)
  }
  const digito = (10 - (suma % 10)) % 10
  return String(digito) === c[17]
}

function limpiarTexto(texto: string): string {
  return texto.toUpperCase().replace(/\s+/g, ' ').trim()
}

function palabrasSignificativas(texto: string): string[] {
  return limpiarTexto(texto)
    .split(' ')
    .filter(p => p && !PARTICULAS.has(p))
}

function vocalInterna(palabra: string): string {
  for (let i = 1; i < palabra.length; i++) {
    if (VOCALES.has(palabra[i])) return palabra[i]
  }
  return 'X'
}

function letraInicial(palabra: string): string {
  const l = palabra[0] ?? ''
  return l === 'Ñ' ? 'X' : l
}

function letraNombre(nombres: string): string {
  const tokens = palabrasSignificativas(nombres)
  if (tokens.length === 0) return 'X'
  const restantes = tokens.filter(t => !NOMBRES_EXCLUIDOS.has(t))
  return letraInicial(restantes.length > 0 ? restantes[0] : tokens[0])
}

export function calcularInicialesCURP(datos: NombreCURP): string {
  const paterno = palabrasSignificativas(datos.paterno).join(' ')
  const materno = datos.materno ? palabrasSignificativas(datos.materno).join(' ') : ''

  const l1 = letraInicial(paterno)
  const l2 = vocalInterna(paterno)
  const l3 = materno ? letraInicial(materno) : 'X'
  const l4 = letraNombre(datos.nombres)

  let iniciales = l1 + l2 + l3 + l4
  if (PALABRAS_MALAS.has(quitarAcentos(iniciales))) {
    iniciales = l1 + 'X' + l3 + l4
  }
  return iniciales
}

export function inicialesCoinciden(curp: string, datos: NombreCURP): boolean {
  const esperadas = quitarAcentos(calcularInicialesCURP(datos))
  const curpIniciales = quitarAcentos(curp.trim().toUpperCase().slice(0, 4))
  return esperadas === curpIniciales
}

export function validarCURPConNombre(curp: string, datos: NombreCURP): boolean {
  return (
    validarFormatoCURP(curp) &&
    validarDigitoVerificador(curp) &&
    inicialesCoinciden(curp, datos)
  )
}
