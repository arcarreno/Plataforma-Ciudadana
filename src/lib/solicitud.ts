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

const CACHE_KEY = 'semovinfra_folio_cache'

export function normalizarFolio(folio: string): string {
  return folio.trim().toUpperCase()
}

export function normalizarCurp(curp: string): string {
  return curp.replace(/\s+/g, '').toUpperCase()
}

export function normalizarNombre(nombre: string): string {
  return nombre.replace(/\s+/g, ' ').trim().toUpperCase()
}

function cacheIgual(a: Solicitud, b: Solicitud): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export function leerCache(folio: string): Solicitud | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as Record<string, Solicitud>
    const entry = cache[normalizarFolio(folio)]
    return entry ?? null
  } catch {
    return null
  }
}

export function escribirCache(folio: string, data: Solicitud) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const cache = raw ? (JSON.parse(raw) as Record<string, Solicitud>) : {}
    cache[normalizarFolio(folio)] = data
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // cache es best-effort
  }
}

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

export async function consultarSolicitud(
  folioRaw: string
): Promise<{ data?: Solicitud; error?: string; offline?: boolean }> {
  const folio = normalizarFolio(folioRaw)
  const cacheActual = leerCache(folio)

  try {
    const { data } = await consultarFolio(folio)

    if (cacheActual && cacheIgual(cacheActual, data)) {
      // La BD del servidor confirma que el cache está al día
      return { data: cacheActual }
    }
    if (!cacheActual || !cacheIgual(cacheActual, data)) {
      escribirCache(folio, data)
    }
    return { data }
  } catch (err) {
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

export async function listarSolicitudesPorNombre(
  nombreRaw: string
): Promise<{ data: Solicitud[] }> {
  const nombre = normalizarNombre(nombreRaw)
  const { data } = await listarSolicitudes({ q: nombre, pageSize: 200 })
  const matches = (data ?? []).filter(
    s =>
      normalizarNombre(s.nombre_solicitante ?? '') === nombre &&
      normalizarCurp(s.curp ?? '') === 'SIN CURP'
  )
  matches.sort((a, b) =>
    String(b.fecha_creacion ?? '').localeCompare(String(a.fecha_creacion ?? ''))
  )
  return { data: matches }
}

// ---------------------------------------------------------------------------
// Crear solicitud (multipart -> servidor, luego escribirCache)
// ---------------------------------------------------------------------------
async function crearSupabase(
  data: SolicitudFormData,
  pesoRankingOverride?: number,
  tramoData?: {
    distancia_m: number; ancho_calle_m: number
    escuelas_cercanas: string[]; iglesias_cercanas: string[]; transportes_cercanos: string[]
    puntos: { lat: number; lng: number }[]
  }
): Promise<{ data?: Solicitud; error?: string; advertencia?: string; respaldo?: boolean }> {
  const { archivos, latitud, longitud, tramo_lat_ini, tramo_lng_ini, tramo_lat_fin, tramo_lng_fin, calle, entre_calles, zona_zap, cobertura_agua, ...rest } = data

  const lat = parseFloat(latitud)
  const lng = parseFloat(longitud)

  const calleFinal = calle || ''
  const entreCallesFinal = entre_calles || ''
  let calleToSave = calleFinal
  let entreCallesToSave = entreCallesFinal
  if (!calleFinal && !entreCallesFinal) {
    const calleInfo = await geolocalizarCalle(lat, lng).catch(() => ({ calle: '', entreCalles: '' }))
    calleToSave = calleInfo.calle
    entreCallesToSave = calleInfo.entreCalles
  }

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

export async function crearSolicitud(
  data: SolicitudFormData,
  pesoRankingOverride?: number,
  tramoData?: {
    distancia_m: number; ancho_calle_m: number
    escuelas_cercanas: string[]; iglesias_cercanas: string[]; transportes_cercanos: string[]
    puntos: { lat: number; lng: number }[]
  }
): Promise<{ data?: Solicitud; error?: string; advertencia?: string; respaldo?: boolean }> {
  const { archivos, latitud, longitud, tramo_lat_ini, tramo_lng_ini, tramo_lat_fin, tramo_lng_fin, calle, entre_calles, zona_zap, cobertura_agua, ...rest } = data

  const lat = parseFloat(latitud)
  const lng = parseFloat(longitud)

  const calleFinal = calle || ''
  const entreCallesFinal = entre_calles || ''
  let calleToSave = calleFinal
  let entreCallesToSave = entreCallesFinal
  if (!calleFinal && !entreCallesFinal) {
    const calleInfo = await geolocalizarCalle(lat, lng).catch(() => ({ calle: '', entreCalles: '' }))
    calleToSave = calleInfo.calle
    entreCallesToSave = calleInfo.entreCalles
  }

  const peso =
    pesoRankingOverride ??
    (archivos.length > 0 ? RANKING_PUNTOS_CON_EVIDENCIA : RANKING_PUNTOS_BASE)

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
      if (err.status === 400 && /l[íi]mite de 3 solicitudes/i.test(err.message)) {
        return {
          error: 'Has alcanzado el límite de 3 solicitudes mensuales para este CURP.',
        }
      }
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
      return { error: err.message.replace(/^API error \d+: /, '') }
    }
    return { error: 'Error inesperado al crear la solicitud' }
  }
}
