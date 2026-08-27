/**
 * @file solicitud.ts
 * @description
 * Capa de dominio para crear, consultar y listar solicitudes de obra del sistema SEMOVINFRA.
 * Gestiona normalización, cache local, fallback offline y modo respaldo (Supabase).
 *
 * Dependencias:
 * - `./supabase` → cliente Supabase para fallbacks (`solicitudes` table) y cache.
 * - `./servidor` → funciones HTTP Express (`consultarFolio`, `crearSolicitud`, `listarSolicitudes`, `esErrorRed`).
 * - `./api` → `ApiError` para tipar errores HTTP/red.
 * - `./backend` → `invalidarModo()` para forzar re-evaluación tras fallo de red.
 * - `../types/solicitud` → tipos `Solicitud` y `SolicitudFormData`.
 * - `../core/constants` → `RANKING_PUNTOS_BASE` / `RANKING_PUNTOS_CON_EVIDENCIA` (peso de priorización).
 * - `./geolocalizarCalle` → reverse-geocoding para inferir `calle`/`entre_calles` si el usuario no las dio.
 * - `localStorage` → cache de folios (`semovinfra_folio_cache`).
 *
 * Flujos clave:
 * - `consultarSolicitud`: intenta servidor → si hay cache igual, lo retorna; si red falla → cache, luego Supabase.
 * - `crearSolicitud`: arma `FormData` multipart (incluye archivos) → POST al servidor → cachea;
 *   si red falla → `crearSupabase` (insert directo) + advertencia de respaldo.
 * - `buscarPorCurp` / `listarSolicitudesPorNombre`: listan vía servidor y filtran localmente con normalización.
 *
 * Decisiones de diseño:
 * - Toda CURP/nombre/folio se normaliza (trim+upper+colapso de espacios) antes de comparar para evitar falsos negativos.
 * - Cache en localStorage es "best-effort": fallos de parseo/storage se ignoran.
 * - `peso_ranking` se deriva de si hay evidencia (archivos) o del override pasado por caller (ej. IA).
 * - `tramoData` (distancia, ancho, escuelas/iglesias/transportes cercanos, puntos) se serializa como JSON en FormData.
 */
import { supabase } from './supabase'
import { consultarFolio, crearSolicitud as crearSolicitudServidor, listarSolicitudes, esErrorRed } from './servidor'
import { ApiError } from './api'
import { invalidarModo } from './backend'
import type { Solicitud, SolicitudFormData } from '../types/solicitud'
import {
  RANKING_PUNTOS_BASE,
  RANKING_PUNTOS_CON_EVIDENCIA,
} from '../core/constants'
import { geolocalizarCalle } from './geolocalizarCalle'

/** Clave de `localStorage` donde se guarda el diccionario `folio → Solicitud`. */
const CACHE_KEY = 'semovinfra_folio_cache'

// ---------------------------------------------------------------------------
// Normalizadores — garantizan comparaciones case-insensitive y sin ruido
// ---------------------------------------------------------------------------

/**
 * Normaliza un folio: trim + mayúsculas.
 * @param folio - Folio crudo ingresado por el usuario.
 * @returns Folio normalizado (ej. `  ab-123 ` → `AB-123`).
 */
export function normalizarFolio(folio: string): string {
  return folio.trim().toUpperCase()
}

/**
 * Normaliza una CURP: elimina todos los espacios y pasa a mayúsculas.
 * @param curp - CURP cruda (puede venir con espacios por dictado).
 * @returns CURP sin espacios y en mayúsculas.
 */
export function normalizarCurp(curp: string): string {
  return curp.replace(/\s+/g, '').toUpperCase()
}

/**
 * Normaliza un nombre: colapsa espacios múltiples, trim y mayúsculas.
 * @param nombre - Nombre crudo.
 * @returns Nombre normalizado para comparación exacta.
 */
export function normalizarNombre(nombre: string): string {
  return nombre.replace(/\s+/g, ' ').trim().toUpperCase()
}

// ---------------------------------------------------------------------------
// Cache local (localStorage) para consulta offline/instantánea
// ---------------------------------------------------------------------------

/**
 * Compara dos solicitudes por igualdad profunda vía `JSON.stringify`.
 * Best-effort: si el stringify falla, retorna `false`.
 * @param a - Solicitud A.
 * @param b - Solicitud B.
 * @returns `true` si son idénticas serializadas.
 */
function cacheIgual(a: Solicitud, b: Solicitud): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * Lee una solicitud del cache de `localStorage` por folio.
 * @param folio - Folio a buscar (se normaliza internamente).
 * @returns `Solicitud` cacheada o `null` si no existe / error de parseo.
 */
export function leerCache(folio: string): Solicitud | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as Record<string, Solicitud>
    const entry = cache[normalizarFolio(folio)]
    return entry ?? null
  } catch {
    // JSON corrupto o storage inaccesible
    return null
  }
}

/**
 * Escribe/actualiza una entrada en el cache de `localStorage`.
 * Hace merge con el diccionario existente; best-effort (ignora errores de quota).
 * @param folio - Folio clave (se normaliza).
 * @param data - Solicitud a cachear.
 */
export function escribirCache(folio: string, data: Solicitud) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const cache = raw ? (JSON.parse(raw) as Record<string, Solicitud>) : {}
    cache[normalizarFolio(folio)] = data
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // cache es best-effort — no propagar error
  }
}

// ---------------------------------------------------------------------------
// Fallback directo a Supabase (cuando el servidor no responde)
// ---------------------------------------------------------------------------

/**
 * Consulta una solicitud directamente en Supabase por `folio_unico`.
 * @param folio - Folio normalizado.
 * @returns `Solicitud` si existe, `null` si no existe o hubo error.
 * @remarks Loguea el error en consola para diagnóstico pero no lo propaga.
 */
async function consultarSupabase(folio: string): Promise<Solicitud | null> {
  const { data, error } = await supabase
    .from('solicitudes')
    .select()
    .eq('folio_unico', folio)
    .maybeSingle()

  if (error) {
    console.error('Supabase fallback:', error)
    return null
  }
  return (data as unknown as Solicitud) ?? null
}

// ---------------------------------------------------------------------------
// Consulta principal (servidor primero, luego cache/Supabase)
// ---------------------------------------------------------------------------

/**
 * Consulta una solicitud por folio con estrategia: servidor → cache → Supabase.
 * @param folioRaw - Folio ingresado por el usuario (se normaliza).
 * @returns
 * - `{ data: Solicitud }` si se encontró (puede venir del servidor o fallback).
 * - `{ data, offline: true }` si vino de cache/Supabase por fallo de red (indica modo degradado).
 * - `{ error: string }` si no existe (404) o fallo total.
 * @example
 * const { data, error, offline } = await consultarSolicitud('ABC-123')
 * if (offline) mostrarAviso('Mostrando datos en caché')
 */
export async function consultarSolicitud(
  folioRaw: string
): Promise<{ data?: Solicitud; error?: string; offline?: boolean }> {
  const folio = normalizarFolio(folioRaw)
  const cacheActual = leerCache(folio)

  try {
    // Intento principal: servidor Express
    const { data } = await consultarFolio(folio)

    // Si el cache ya tiene exactamente lo mismo, devolverlo sin re-escribir (evita churn de storage)
    if (cacheActual && cacheIgual(cacheActual, data)) {
      // La BD del servidor confirma que el cache está al día
      return { data: cacheActual }
    }
    if (!cacheActual || !cacheIgual(cacheActual, data)) {
      escribirCache(folio, data)
    }
    return { data }
  } catch (err) {
    // 404 real del servidor: el folio no existe, no intentar fallbacks
    if (err instanceof ApiError && err.status === 404) {
      return { error: 'Folio no encontrado. Verifica el número e intenta de nuevo.' }
    }

    // Error de red (servidor inalcanzable) o error 5xx: usar cache, luego Supabase
    if (cacheActual) {
      return { data: cacheActual, offline: true }
    }

    const supa = await consultarSupabase(folio)
    if (supa) {
      escribirCache(folio, supa)
      return { data: supa, offline: true }
    }

    return {
      error: esErrorRed(err)
        ? 'Servidor no disponible. Verifica tu conexión o intenta más tarde.'
        : 'Ocurrió un error al consultar el folio. Intenta de nuevo.',
    }
  }
}

// ---------------------------------------------------------------------------
// Búsquedas por CURP / Nombre (listar + filtrar local)
// ---------------------------------------------------------------------------

/**
 * Busca solicitudes asociadas a una CURP.
 * Lista vía servidor con query `q = curp` (pageSize 200) y filtra localmente por igualdad exacta normalizada.
 * Ordena descendente por `fecha_creacion` (más recientes primero).
 * @param curpRaw - CURP a buscar.
 * @returns `{ data: Solicitud[] }` (vacío si no hay coincidencias).
 */
export async function buscarPorCurp(
  curpRaw: string
): Promise<{ data: Solicitud[] }> {
  const curp = normalizarCurp(curpRaw)
  const { data } = await listarSolicitudes({ q: curp, pageSize: 200 })
  const matches = (data ?? []).filter(
    s => normalizarCurp(s.curp ?? '') === curp
  )
  matches.sort((a, b) =>
    String(b.fecha_creacion ?? '').localeCompare(String(a.fecha_creacion ?? ''))
  )
  return { data: matches }
}

/**
 * Lista solicitudes por nombre exacto cuando la CURP es `SINCURP`.
 * Útil para solicitantes sin CURP (extranjeros / casos especiales).
 * @param nombreRaw - Nombre completo a buscar.
 * @returns `{ data: Solicitud[] }` filtradas por nombre exacto + `curp === 'SINCURP'`, ordenadas por fecha desc.
 */
export async function listarSolicitudesPorNombre(
  nombreRaw: string
): Promise<{ data: Solicitud[] }> {
  const nombre = normalizarNombre(nombreRaw)
  const { data } = await listarSolicitudes({ q: nombre, pageSize: 200 })
  const matches = (data ?? []).filter(
    s =>
      normalizarNombre(s.nombre_solicitante ?? '') === nombre &&
      normalizarCurp(s.curp ?? '') === 'SINCURP'
  )
  matches.sort((a, b) =>
    String(b.fecha_creacion ?? '').localeCompare(String(a.fecha_creacion ?? ''))
  )
  return { data: matches }
}

// ---------------------------------------------------------------------------
// Crear solicitud (multipart -> servidor, luego escribirCache)
// ---------------------------------------------------------------------------

/**
 * Crea una solicitud directamente en Supabase (modo respaldo).
 * Se usa cuando el servidor Express no está disponible (`isNetwork`).
 * Replica los campos de `crearSolicitud` pero vía `supabase.from('solicitudes').insert()`.
 * @param data - Datos del formulario (incluye archivos, coords, etc.).
 * @param pesoRankingOverride - Peso de ranking forzado (si se pasa, ignora el cálculo por evidencia).
 * @param tramoData - Info geoespacial del tramo (distancia, ancho, escuelas/iglesias/transportes cercanos, puntos).
 * @returns `{ data: Solicitud, respaldo: true }` si éxito, `{ error: string }` si falla (incluye caso límite de 3/mes).
 * @remarks
 * - Si `calle` y `entre_calles` están vacíos, intenta `geolocalizarCalle(lat, lng)` (best-effort).
 * - Archivos no se suben a Storage en modo respaldo (solo se guarda la solicitud sin evidencias binarias).
 */
async function crearSupabase(
  data: SolicitudFormData,
  pesoRankingOverride?: number,
  tramoData?: {
    distancia_m: number; ancho_calle_m: number
    escuelas_cercanas: string[]; iglesias_cercanas: string[]; transportes_cercanos: string[]
    puntos: { lat: number; lng: number }[]
  }
): Promise<{ data?: Solicitud; error?: string; advertencia?: string; respaldo?: boolean }> {
  // Separar campos que no van directo al insert o requieren transformación
  const { archivos, latitud, longitud, tramo_lat_ini, tramo_lng_ini, tramo_lat_fin, tramo_lng_fin, calle, entre_calles, zona_zap, cobertura_agua, ...rest } = data

  const lat = parseFloat(latitud)
  const lng = parseFloat(longitud)

  // Resolver calle/entre_calles: si el usuario no las dio, inferir por reverse-geocoding
  const calleFinal = calle || ''
  const entreCallesFinal = entre_calles || ''
  let calleToSave = calleFinal
  let entreCallesToSave = entreCallesFinal
  if (!calleFinal && !entreCallesFinal) {
    const calleInfo = await geolocalizarCalle(lat, lng).catch(() => ({ calle: '', entreCalles: '' }))
    calleToSave = calleInfo.calle
    entreCallesToSave = calleInfo.entreCalles
  }

  // Peso de ranking: override explícito o según si hay evidencia
  const peso =
    pesoRankingOverride ??
    (archivos.length > 0 ? RANKING_PUNTOS_CON_EVIDENCIA : RANKING_PUNTOS_BASE)

  const { data: insertado, error } = await supabase.from('solicitudes').insert({
    nombre_solicitante: rest.nombre_solicitante,
    curp: rest.curp,
    telefono: rest.telefono ?? null,
    correo: rest.correo ?? null,
    aviso_privacidad_aceptado: rest.aviso_privacidad_aceptado,
    tipo_solicitud: rest.tipo_solicitud,
    colonia: rest.colonia ?? '',
    junta_auxiliar: rest.junta_auxiliar ?? '',
    calle: calleToSave,
    entre_calles: entreCallesToSave,
    latitud: lat,
    longitud: lng,
    tramo_lat_ini: tramo_lat_ini ? parseFloat(tramo_lat_ini) : null,
    tramo_lng_ini: tramo_lng_ini ? parseFloat(tramo_lng_ini) : null,
    tramo_lat_fin: tramo_lat_fin ? parseFloat(tramo_lat_fin) : null,
    tramo_lng_fin: tramo_lng_fin ? parseFloat(tramo_lng_fin) : null,
    tramo_puntos: tramoData?.puntos ?? [],
    descripcion: rest.descripcion ?? '',
    zona_zap: zona_zap ?? false,
    cobertura_agua: cobertura_agua ?? false,
    escuelas_cercanas: tramoData?.escuelas_cercanas ?? [],
    iglesias_cercanas: tramoData?.iglesias_cercanas ?? [],
    transportes_cercanos: tramoData?.transportes_cercanos ?? [],
    distancia_tramo_m: tramoData?.distancia_m ?? null,
    ancho_calle_m: tramoData?.ancho_calle_m ?? null,
    peso_ranking: peso,
  }).select()

  if (error) {
    // El trigger/constr en BD limita a 3 solicitudes mensuales por CURP
    if (/l[ií]mite de 3 solicitudes/i.test(error.message ?? '')) {
      return { error: 'Has alcanzado el límite de 3 solicitudes mensuales para este CURP.' }
    }
    return { error: `No se pudo guardar en el respaldo: ${error.message}` }
  }
  const fila = (insertado as unknown as Solicitud[] | null)?.[0]
  if (fila?.folio_unico) {
    escribirCache(fila.folio_unico, fila)
  }
  return { data: fila, respaldo: true }
}

/**
 * Crea una solicitud nueva. Prioridad: servidor Express (multipart), fallback a Supabase si hay fallo de red.
 * @param data - Datos validados del formulario (`SolicitudFormData`).
 * @param pesoRankingOverride - Peso de ranking opcional que pisa el cálculo automático.
 * @param tramoData - Datos geoespaciales del tramo (opcional).
 * @returns
 * - `{ data: Solicitud, advertencia?: string }` si se guardó en servidor.
 * - `{ data, respaldo: true, advertencia }` si se guardó en respaldo por caída del servidor.
 * - `{ error: string }` si validación (400 límite 3/mes) u otro error.
 * @example
 * const res = await crearSolicitud(form, undefined, tramo)
 * if (res.error) mostrarError(res.error)
 * else if (res.respaldo) mostrarAviso(res.advertencia)
 */
export async function crearSolicitud(
  data: SolicitudFormData,
  pesoRankingOverride?: number,
  tramoData?: {
    distancia_m: number; ancho_calle_m: number
    escuelas_cercanas: string[]; iglesias_cercanas: string[]; transportes_cercanos: string[]
    puntos: { lat: number; lng: number }[]
  }
): Promise<{ data?: Solicitud; error?: string; advertencia?: string; respaldo?: boolean }> {
  // Extraer campos que requieren tratamiento especial antes de armar FormData
  const { archivos, latitud, longitud, tramo_lat_ini, tramo_lng_ini, tramo_lat_fin, tramo_lng_fin, calle, entre_calles, zona_zap, cobertura_agua, ...rest } = data

  const lat = parseFloat(latitud)
  const lng = parseFloat(longitud)

  // Calle/entre_calles: usar las del form o inferir por geocoding inverso
  const calleFinal = calle || ''
  const entreCallesFinal = entre_calles || ''
  let calleToSave = calleFinal
  let entreCallesToSave = entreCallesFinal
  if (!calleFinal && !entreCallesFinal) {
    const calleInfo = await geolocalizarCalle(lat, lng).catch(() => ({ calle: '', entreCalles: '' }))
    calleToSave = calleInfo.calle
    entreCallesToSave = calleInfo.entreCalles
  }

  // Peso: override o según presencia de archivos (evidencia fotográfica suma puntos)
  const peso =
    pesoRankingOverride ??
    (archivos.length > 0 ? RANKING_PUNTOS_CON_EVIDENCIA : RANKING_PUNTOS_BASE)

  // Armar payload multipart para el servidor Express (soporta archivos binarios)
  const form = new FormData()
  form.append('nombre_solicitante', rest.nombre_solicitante)
  form.append('curp', rest.curp)
  form.append('telefono', rest.telefono ?? '')
  form.append('correo', rest.correo ?? '')
  form.append('aviso_privacidad_aceptado', String(rest.aviso_privacidad_aceptado))
  form.append('tipo_solicitud', rest.tipo_solicitud)
  form.append('colonia', rest.colonia ?? '')
  form.append('junta_auxiliar', rest.junta_auxiliar ?? '')
  form.append('calle', calleToSave)
  form.append('entre_calles', entreCallesToSave)
  form.append('latitud', String(lat))
  form.append('longitud', String(lng))
  form.append('tramo_lat_ini', tramo_lat_ini ?? '')
  form.append('tramo_lng_ini', tramo_lng_ini ?? '')
  form.append('tramo_lat_fin', tramo_lat_fin ?? '')
  form.append('tramo_lng_fin', tramo_lng_fin ?? '')
  form.append('tramo_puntos', JSON.stringify(tramoData?.puntos ?? []))
  form.append('descripcion', rest.descripcion ?? '')
  form.append('zona_zap', String(zona_zap ?? false))
  form.append('cobertura_agua', String(cobertura_agua ?? false))
  form.append('escuelas_cercanas', JSON.stringify(tramoData?.escuelas_cercanas ?? []))
  form.append('iglesias_cercanas', JSON.stringify(tramoData?.iglesias_cercanas ?? []))
  form.append('transportes_cercanos', JSON.stringify(tramoData?.transportes_cercanos ?? []))
  form.append('distancia_tramo_m', tramoData?.distancia_m != null ? String(tramoData.distancia_m) : '')
  form.append('ancho_calle_m', tramoData?.ancho_calle_m != null ? String(tramoData.ancho_calle_m) : '')
  form.append('peso_ranking', String(peso))
  archivos.forEach(f => form.append('archivos', f))

  try {
    const res = await crearSolicitudServidor(form)
    const solicitud = res.data
    if (solicitud?.folio_unico) {
      escribirCache(solicitud.folio_unico, solicitud)
    }
    return { data: solicitud, advertencia: res.advertencia ?? undefined }
  } catch (err) {
    if (err instanceof ApiError) {
      // Límite de negocio: 3 solicitudes por CURP por mes (validado en servidor)
      if (err.status === 400 && /l[íi]mite de 3 solicitudes/i.test(err.message)) {
        return {
          error: 'Has alcanzado el límite de 3 solicitudes mensuales para este CURP.',
        }
      }
      // Fallo de red: invalidar modo y reintentar vía Supabase (respaldo)
      if (err.isNetwork) {
        invalidarModo()
        const supa = await crearSupabase(data, pesoRankingOverride, tramoData)
        if (supa.error) {
          return {
            error:
              'No pudimos guardar tu solicitud ni en el respaldo. Revisa tu conexión a internet y vuelve a intentarlo en 5 minutos.',
          }
        }
        return {
          data: supa.data,
          respaldo: true,
          advertencia: 'El servidor principal no responde; tu solicitud se guardó en el respaldo y se sincronizará sola.',
        }
      }
      // Otros errores HTTP: limpiar prefijo `API error N:`
      return { error: err.message.replace(/^API error \d+: /, '') }
    }
    return { error: 'Error inesperado al crear la solicitud' }
  }
}
