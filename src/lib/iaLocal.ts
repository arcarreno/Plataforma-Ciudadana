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

function extraerTelefono(texto: string): string {
  const dig = texto.replace(/\D/g, '')
  if (!dig) return ''
  let tel = dig
  if (tel.length === 12 && tel.startsWith('52')) tel = tel.slice(2)
  if (tel.length === 10) return tel
  const m = tel.length > 10 ? tel.slice(-10) : tel
  return m.length === 10 ? m : ''
}

function extraerCorreo(texto: string): string {
  const m = texto.match(/[\w.+-]+@[\w-]+\.[\w.]+/)
  return m ? m[0].toLowerCase() : ''
}

function extraerCurp(texto: string): string {
  const m = texto.toUpperCase().match(/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/)
  return m ? m[0] : ''
}

function limpiarValor(v: string): string {
  return v.trim().replace(/\s+/g, ' ')
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
  if (campo === 'telefono') return extraerTelefono(texto) || limpiarValor(quitarRelleno(texto, campo)).slice(0, MAX_K.telefono)
  if (campo === 'curp') return extraerCurp(texto) || limpiarValor(quitarRelleno(texto, campo)).toUpperCase().slice(0, MAX_K.curp)
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