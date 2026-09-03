/**
 * @file registro.ts
 * @description
 *   Cliente del flujo de auto-registro institucional por correo verificado.
 *   Habla directo con FastAPI (`/api/auth/registro*`, `/api/auth/directorio/*`).
 *   Sin fallback a Supabase: el registro vive solo en el servidor (decisión
 *   de arquitectura previa a la migración a Azure).
 *
 * Dominios permitidos y rol derivado (espejo de `DOMINIO_ROL` en main.py):
 * - `@ayuntamientopuebla.gob.mx` -> `revisor` (pide nombre manual)
 * - `@congresodepuebla.mx`       -> `legislador` (nombre del directorio o manual)
 * - `@diputados.gob.mx`          -> `diputado`   (nombre del directorio o manual)
 * - `@senado.gob.mx`             -> `senador`    (nombre del directorio o manual)
 *
 * Flujo asíncrono entre dispositivos:
 * 1. `iniciarRegistro` (computadora) -> backend crea pendiente y envía correo.
 * 2. Usuario abre el enlace en el teléfono -> ruta `/verificar?token=` ->
 *    `verificarRegistro` + `PasswordSetupModal`.
 * 3. La computadora pollea `estadoRegistro(token)` cada 3s; al ver
 *    `verificado=true` abre el mismo `PasswordSetupModal` sin recargar.
 * 4. Quien completa primero gana (`completarRegistro` es single-use, 410 si
 *    el token ya se usó); el otro lado ve `usado=true` y muestra login.
 */

import { api, ApiError } from './api'

/** Dominios institucionales permitidos. */
export const DOMINIOS_PERMITIDOS = [
  'diputados.gob.mx',
  'congresodepuebla.mx',
  'ayuntamientopuebla.gob.mx',
  'senado.gob.mx',
] as const

/** Rol derivado por dominio (espejo del backend). */
export const DOMINIO_ROL: Record<string, string> = {
  'ayuntamientopuebla.gob.mx': 'revisor',
  'congresodepuebla.mx': 'legislador',
  'diputados.gob.mx': 'diputado',
  'senado.gob.mx': 'senador',
}

/**
 * Excepción TEMPORAL de pruebas (espejo de `EXCEPCIONES_EMAIL` en main.py).
 * Correos fuera de dominios institucionales aceptados solo para validar el
 * flujo. QUITAR cuando lleguen los correos reales.
 */
export const EXCEPCIONES_EMAIL: Record<string, string> = {
  'arancago24@gmail.com': 'revisor',
}

/** Tipo de directorio por dominio (para autocompletar nombre). */
export const DOMINIO_DIRECTORIO: Record<string, 'legisladores' | 'diputados' | 'senadores'> = {
  'congresodepuebla.mx': 'legisladores',
  'diputados.gob.mx': 'diputados',
  'senado.gob.mx': 'senadores',
}

/** Extrae el dominio en minúsculas de un correo, o '' si no hay @. */
export function dominioDe(email: string): string {
  const at = email.lastIndexOf('@')
  return at === -1 ? '' : email.slice(at + 1).trim().toLowerCase()
}

/** Normaliza un correo para comparar (trim + minúsculas). */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** ¿El correo pertenece a un dominio institucional permitido o es excepción temporal? */
export function esDominioPermitido(email: string): boolean {
  const correo = normalizarEmail(email)
  if (correo in EXCEPCIONES_EMAIL) return true
  return (DOMINIOS_PERMITIDOS as readonly string[]).includes(dominioDe(correo))
}

/** Rol que obtendrá el correo (excepción o dominio). */
export function rolParaEmail(email: string): string {
  const correo = normalizarEmail(email)
  if (correo in EXCEPCIONES_EMAIL) return EXCEPCIONES_EMAIL[correo]
  return DOMINIO_ROL[dominioDe(correo)] ?? ''
}

/** ¿Este correo pide nombre manual (sin directorio)? Ayuntamiento + excepciones. */
export function pideNombreManual(email: string): boolean {
  const correo = normalizarEmail(email)
  if (correo in EXCEPCIONES_EMAIL) return true
  return dominioDe(correo) === 'ayuntamientopuebla.gob.mx'
}

// ---------------------------------------------------------------------------
// Reglas de contraseña (espejo de `errores_password` en main.py)
// ---------------------------------------------------------------------------

/** Claves de regla: minimo_6, minuscula, numero, especial. */
export type ReglaPassword = 'minimo_6' | 'minuscula' | 'numero' | 'especial'

export const REGLAS_PASSWORD: { clave: ReglaPassword; etiqueta: string }[] = [
  { clave: 'minimo_6', etiqueta: 'Al menos 6 caracteres' },
  { clave: 'minuscula', etiqueta: 'Al menos 1 minúscula' },
  { clave: 'numero', etiqueta: 'Al menos 1 número' },
  { clave: 'especial', etiqueta: 'Al menos 1 carácter especial' },
]

/**
 * Evalúa la contraseña localmente (mismas reglas que el servidor).
 * @returns Lista de claves cumplidas.
 */
export function reglasCumplidas(pw: string): ReglaPassword[] {
  const ok: ReglaPassword[] = []
  if ((pw || '').length >= 6) ok.push('minimo_6')
  if (/[a-zñáéíóúü]/.test(pw || '')) ok.push('minuscula')
  if (/[0-9]/.test(pw || '')) ok.push('numero')
  if (/[^A-Za-z0-9ñÑáéíóúüÁÉÍÓÚÜ]/.test(pw || '')) ok.push('especial')
  return ok
}

// ---------------------------------------------------------------------------
// Tipos de respuesta
// ---------------------------------------------------------------------------

export interface RegistroIniciado {
  email: string
  rol: string
  token: string
}

export interface RegistroVerificado {
  email: string
  rol: string
  nombre_sugerido: string
  en_directorio: boolean
}

export interface RegistroEstado {
  email: string
  verificado: boolean
  usado: boolean
  expira: string
}

export interface EntradaDirectorio {
  nombre: string
  email: string
  partido?: string
  [k: string]: unknown
}

/** Normaliza ApiError a mensaje legible (quita `API error N:`). */
function errorMsg(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message.replace(/^API error \d+: /, '')
  }
  return 'Ocurrió un error inesperado'
}

// ---------------------------------------------------------------------------
// Llamadas API
// ---------------------------------------------------------------------------

/** Paso 1: crea el pendiente y dispara el correo de verificación. */
export async function iniciarRegistro(
  email: string,
  nombre_completo = '',
): Promise<{ data?: RegistroIniciado; error?: string }> {
  try {
    const res = await api.post<{ data: RegistroIniciado }>('/api/auth/registro', {
      email: email.trim().toLowerCase(),
      nombre_completo: nombre_completo.trim(),
    })
    return { data: res.data }
  } catch (err) {
    return { error: errorMsg(err) }
  }
}

/** Marca el token como verificado (lo llama la ruta /verificar). Idempotente. */
export async function verificarRegistro(
  token: string,
): Promise<{ data?: RegistroVerificado; error?: string; status?: number }> {
  try {
    const res = await api.post<{ data: RegistroVerificado }>('/api/auth/registro/verificar', { token })
    return { data: res.data }
  } catch (err) {
    return { error: errorMsg(err), status: err instanceof ApiError ? err.status : undefined }
  }
}

/** Paso de polling: ¿ya se verificó / ya se usó el token? */
export async function estadoRegistro(
  token: string,
): Promise<{ data?: RegistroEstado; error?: string; status?: number }> {
  try {
    const res = await api.get<{ data: RegistroEstado }>(
      `/api/auth/registro/estado?token=${encodeURIComponent(token)}`,
    )
    return { data: res.data }
  } catch (err) {
    return { error: errorMsg(err), status: err instanceof ApiError ? err.status : undefined }
  }
}

/** Paso final: crea el usuario y devuelve sesión (auto-login). Single-use. */
export async function completarRegistro(
  token: string,
  password: string,
  nombre_completo = '',
): Promise<{
  data?: { token: string; id: number; username: string; email: string; rol: string; nombres: string; apellidos: string }
  error?: string
  status?: number
}> {
  try {
    const res = await api.post<{ data: { token: string; id: number; username: string; email: string; rol: string; nombres: string; apellidos: string } }>(
      '/api/auth/registro/completar',
      { token, password, nombre_completo: nombre_completo.trim() },
    )
    return { data: res.data }
  } catch (err) {
    return { error: errorMsg(err), status: err instanceof ApiError ? err.status : undefined }
  }
}

/** Directorio público para autocompletar nombre (legisladores|diputados|senadores). */
export async function obtenerDirectorio(
  tipo: 'legisladores' | 'diputados' | 'senadores',
): Promise<{ data?: EntradaDirectorio[]; error?: string }> {
  try {
    const res = await api.get<{ data: EntradaDirectorio[] }>(`/api/auth/directorio/${tipo}`)
    return { data: res.data }
  } catch (err) {
    return { error: errorMsg(err) }
  }
}

/** Busca un correo dentro de un directorio ya cargado (match exacto, case-insensitive). */
export function buscarEnDirectorio(
  directorio: EntradaDirectorio[],
  email: string,
): EntradaDirectorio | null {
  const normalizado = email.trim().toLowerCase()
  return directorio.find((e) => String(e.email || '').trim().toLowerCase() === normalizado) ?? null
}
