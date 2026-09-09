/**
 * @file consultarSIGED.ts
 * @description
 * Cliente frontend para consultar información de escuelas por CCT (Clave de Centro de Trabajo)
 * contra `GET /api/siged/consultar` del backend FastAPI (caché + reintentos con backoff),
 * que a su vez consulta el SIGED (Sistema de Información y Gestión Educativa de la SEP).
 * Se usa para autocompletar/validar datos de planteles en solicitudes relacionadas con infraestructura educativa.
 *
 * Dependencias: `./api` (cliente HTTP + ApiError) para la llamada al backend.
 *
 * Flujo:
 * 1. Normaliza el CCT (upper, sin espacios/guiones/puntos) y valida 10 alfanuméricos.
 * 2. Revisa caché local (localStorage, 7 días) — si hay hit, retorna sin red.
 * 3. Si no, pide al backend (con Bearer si hay sesión) y guarda en caché.
 * 4. Mapea errores por status: 404 = no existe en SEP, 502 = SEP no responde,
 *    red = sin conexión. Nunca lanza excepción al caller.
 */

import { api, ApiError } from './api'

/** Clave y vigencia de la caché local de escuelas (7 días). */
const SIGED_CACHE_KEY = 'semovinfra_siged_cache'
const SIGED_CACHE_TTL = 7 * 24 * 3600 * 1000

/**
 * Lee una escuela resuelta de la caché local (best-effort, nunca revienta).
 * @returns La escuela si existe y está vigente, null si no.
 */
function leerCacheSIGED(cct: string, turno?: string): SigedEscuela | null {
  try {
    const raw = localStorage.getItem(SIGED_CACHE_KEY)
    if (!raw) return null
    const all = JSON.parse(raw) as Record<string, { ts: number; data: SigedEscuela }>
    const e = all[`${cct}|${turno ?? ''}`]
    if (!e || Date.now() - e.ts > SIGED_CACHE_TTL) return null
    return e.data
  } catch {
    return null
  }
}

/**
 * Guarda una escuela resuelta en la caché local (best-effort).
 */
function guardarCacheSIGED(cct: string, turno: string | undefined, data: SigedEscuela): void {
  try {
    const raw = localStorage.getItem(SIGED_CACHE_KEY)
    const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    all[`${cct}|${turno ?? ''}`] = { ts: Date.now(), data }
    localStorage.setItem(SIGED_CACHE_KEY, JSON.stringify(all))
  } catch {
    /* storage lleno o bloqueado: se sigue sin caché */
  }
}
export interface SigedEscuela {
  /** Clave de Centro de Trabajo (10 caracteres, ej. "21PPR0001A"). */
  cct: string
  /** Nombre oficial del plantel. */
  nombre: string
  /** Nivel educativo (ej. "Primaria", "Secundaria", "Preescolar"). */
  nivel: string
  /** Subnivel / modalidad (ej. "General", "Técnica", "Indígena"). */
  subnivel: string
  /** Turno (ej. "Matutino", "Vespertino", "Continuo"). */
  turno: string
  /** Sostenimiento (ej. "Público", "Privado"). */
  sostenimiento: string
  /** Control administrativo (ej. "Federal", "Estatal", "Autónomo"). */
  control: string
  /** Sub-control (detalle del control). */
  subControl: string
  /** Domicilio / calle y número. */
  domicilio: string
  /** Colonia del plantel. */
  colonia: string
  /** Municipio. */
  municipio: string
  /** Estado (entidad federativa). */
  estado: string
  /** Código postal. */
  codigoPostal: string
  /** Latitud como string (puede venir vacía si SIGED no la tiene). */
  latitud: string
  /** Longitud como string. */
  longitud: string
  /** Alumnos hombres inscritos. */
  alumnosHombres: number
  /** Alumnas mujeres inscritas. */
  alumnosMujeres: number
  /** Total de alumnos (hombres + mujeres). */
  totalAlumnos: number
  /** Número de docentes. */
  docentes: number
  /** Número de grupos. */
  grupos: number
  /** Fuente/origen del dato (ej. "SIGED"). */
  fuente: string
}

/**
 * Consulta una escuela por CCT (y turno opcional) con caché local de 7 días.
 * @param cct - Clave de Centro de Trabajo (se normaliza: upper, sin espacios/guiones/puntos).
 * @param turno - Turno opcional para desambiguar; si se omite, el backend decide.
 * @param token - Bearer opcional (el endpoint requiere sesión).
 * @returns Promesa con `{ data: SigedEscuela }` si éxito, `{ error: string }` si validación/network/404.
 * @example
 * const { data, error } = await consultarSIGED('21PPR0001A', undefined, token)
 * if (error) mostrarError(error)
 * else console.log(data.nombre, data.totalAlumnos)
 */
export async function consultarSIGED(
  cct: string,
  turno?: string,
  token?: string
): Promise<{ data?: SigedEscuela; error?: string }> {
  // Normalizar CCT: mayúsculas, sin espacios/guiones/puntos intermedios
  const cctClean = cct.toUpperCase().replace(/[\s.\-]/g, '')
  // Validación de formato oficial (10 alfanuméricos)
  if (!/^[A-Z0-9]{10}$/.test(cctClean)) {
    return { error: 'El CCT debe tener 10 caracteres alfanuméricos (sin guiones ni espacios)' }
  }

  // Caché local primero: si ya se resolvió esta semana, no se toca la red
  const hit = leerCacheSIGED(cctClean, turno)
  if (hit) return { data: hit }

  const headers = token ? { Authorization: `Bearer ${token}` } : undefined
  try {
    // Construir query string de forma segura (encode automático)
    const params = new URLSearchParams({ cct: cctClean })
    if (turno) params.set('turno', turno)

    // Backend FastAPI: validación + caché 24h + reintentos ante la SEP
    const data = await api.get<SigedEscuela>(
      `/api/siged/consultar?${params.toString()}`,
      headers ? { headers } : undefined
    )
    guardarCacheSIGED(cctClean, turno, data)
    return { data }
  } catch (err) {
    // Mensajes que distinguen "no existe" de "SEP caída" y de "sin conexión"
    if (err instanceof ApiError) {
      if (err.status === 404) return { error: `CCT ${cctClean} no existe en SEP` }
      if (err.status === 502) return { error: 'SEP no responde, reintente en un momento' }
      if (err.status === 400) return { error: err.message.replace(/^API error \d+: /, '') }
      if (err.isNetwork) return { error: 'Sin conexión al servidor' }
      return { error: err.message.replace(/^API error \d+: /, '') }
    }
    return { error: 'No se pudo conectar con SIGED' }
  }
}
