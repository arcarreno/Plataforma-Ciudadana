import { supabase } from './supabase'
import { consultarFolio, crearSolicitud as crearSolicitudServidor } from './servidor'
import { esErrorRed } from './servidor'
import { ApiError } from './api'
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

// ---------------------------------------------------------------------------
// Crear solicitud (multipart -> servidor, luego escribirCache)
// ---------------------------------------------------------------------------
export async function crearSolicitud(
  data: SolicitudFormData,
  pesoRankingOverride?: number,
  tramoData?: {
    distancia_m: number; ancho_calle_m: number
    escuelas_cercanas: string[]; iglesias_cercanas: string[]; transportes_cercanos: string[]
    puntos: { lat: number; lng: number }[]
  }
): Promise<{ data?: Solicitud; error?: string; advertencia?: string }> {
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
        return { error: 'Servidor no disponible. Verifica tu conexión e intenta de nuevo.' }
      }
      return { error: err.message.replace(/^API error \d+: /, '') }
    }
    return { error: 'Error inesperado al crear la solicitud' }
  }
}
