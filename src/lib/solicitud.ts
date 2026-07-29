import { supabase } from './supabase'
import type { Solicitud, SolicitudFormData } from '../types/solicitud'
import {
  RANKING_PUNTOS_BASE,
  RANKING_PUNTOS_CON_EVIDENCIA,
  TIPO_A_DEPARTAMENTO,
} from '../core/constants'
import { geolocalizarCalle } from './geolocalizarCalle'

function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const MAX_EVIDENCIA_BYTES = 500 * 1024

async function uploadArchivos(
  archivos: File[],
  folio: string
): Promise<{ rutas: string[]; errores: string[] }> {
  const rutas: string[] = []
  const errores: string[] = []

  for (const file of archivos) {
    if (file.size > MAX_EVIDENCIA_BYTES) {
      errores.push(`"${file.name}" excede el límite de 500 KB`)
      continue
    }
    const ext = file.name.split('.').pop()
    const path = `evidencias/${folio}/${uuidV4()}.${ext}`
    const { error } = await supabase.storage
      .from('evidencias')
      .upload(path, file)

    if (error) {
      errores.push(`${file.name}: ${error.message}`)
      continue
    }
    rutas.push(path)
  }

  return { rutas, errores }
}

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

  // Use calle from form if available, otherwise geocode as fallback
  const calleFinal = calle || ''
  const entreCallesFinal = entre_calles || ''
  let calleToSave = calleFinal
  let entreCallesToSave = entreCallesFinal
  if (!calleFinal && !entreCallesFinal) {
    const calleInfo = await geolocalizarCalle(lat, lng).catch(() => ({ calle: '', entreCalles: '' }))
    calleToSave = calleInfo.calle
    entreCallesToSave = calleInfo.entreCalles
  }

  const { data: solicitud, error: insertError } = await supabase
    .from('solicitudes')
    .insert({
      ...rest,
      estatus_fase: TIPO_A_DEPARTAMENTO[rest.tipo_solicitud] ?? 'Revision',
      latitud: lat,
      longitud: lng,
      tramo_lat_ini: tramo_lat_ini ? parseFloat(tramo_lat_ini) : null,
      tramo_lng_ini: tramo_lng_ini ? parseFloat(tramo_lng_ini) : null,
      tramo_lat_fin: tramo_lat_fin ? parseFloat(tramo_lat_fin) : null,
      tramo_lng_fin: tramo_lng_fin ? parseFloat(tramo_lng_fin) : null,
      tramo_puntos: tramoData?.puntos ?? [],
      calle: calleToSave,
      entre_calles: entreCallesToSave,
      peso_ranking:
        pesoRankingOverride ??
        (archivos.length > 0 ? RANKING_PUNTOS_CON_EVIDENCIA : RANKING_PUNTOS_BASE),
      zona_zap: zona_zap ?? false,
      cobertura_agua: cobertura_agua ?? false,
      escuelas_cercanas: tramoData?.escuelas_cercanas ?? [],
      iglesias_cercanas: tramoData?.iglesias_cercanas ?? [],
      transportes_cercanos: tramoData?.transportes_cercanos ?? [],
      distancia_tramo_m: tramoData?.distancia_m ?? null,
      ancho_calle_m: tramoData?.ancho_calle_m ?? null,
    })
    .select()
    .single()

  if (insertError) {
    console.error('Error al insertar solicitud:', insertError)
    if (insertError.message.includes('Limite de 3 solicitudes')) {
      return {
        error:
          'Has alcanzado el límite de 3 solicitudes mensuales para este CURP.',
      }
    }
    return { error: insertError.message }
  }

  let rutas: string[] = []
  let erroresSubida: string[] = []
  if (archivos.length > 0 && solicitud?.folio_unico) {
    const result = await uploadArchivos(archivos, solicitud.folio_unico)
    rutas = result.rutas
    erroresSubida = result.errores

    if (rutas.length > 0) {
      const { error: updateError } = await supabase
        .from('solicitudes')
        .update({ rutas_evidencia: rutas })
        .eq('id_solicitud', solicitud.id_solicitud)

      if (updateError) {
        erroresSubida.push(`Error al guardar rutas: ${updateError.message}`)
      }
    }
  }

  if (erroresSubida.length > 0) {
    console.warn('Errores al subir evidencia:', erroresSubida)
  }

  return { data: { ...solicitud, rutas_evidencia: rutas }, advertencia: erroresSubida.length > 0 ? erroresSubida.join('; ') : undefined }
}

export async function consultarSolicitud(
  folio: string
): Promise<{ data?: Solicitud; error?: string }> {
  const { data, error } = await supabase
    .from('solicitudes')
    .select('*')
    .eq('folio_unico', folio)
    .single()

  if (error) {
    return { error: 'Folio no encontrado. Verifica el número e intenta de nuevo.' }
  }

  return { data }
}
