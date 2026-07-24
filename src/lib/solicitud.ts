import { supabase } from './supabase'
import type { Solicitud, SolicitudFormData } from '../types/solicitud'
import {
  RANKING_PUNTOS_BASE,
  RANKING_PUNTOS_CON_EVIDENCIA,
} from '../core/constants'

async function uploadArchivos(
  archivos: File[],
  folio: string
): Promise<string[]> {
  const rutas: string[] = []

  for (const file of archivos) {
    const ext = file.name.split('.').pop()
    const path = `evidencias/${folio}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage
      .from('evidencias')
      .upload(path, file)

    if (error) {
      console.error('Error subiendo archivo:', error.message)
      continue
    }
    rutas.push(path)
  }

  return rutas
}

export async function crearSolicitud(
  data: SolicitudFormData
): Promise<{ data?: Solicitud; error?: string }> {
  const { archivos, latitud, longitud, ...rest } = data

  const { data: solicitud, error: insertError } = await supabase
    .from('solicitudes')
    .insert({
      ...rest,
      latitud: parseFloat(latitud),
      longitud: parseFloat(longitud),
      peso_ranking:
        archivos.length > 0 ? RANKING_PUNTOS_CON_EVIDENCIA : RANKING_PUNTOS_BASE,
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.message.includes('Limite de 3 solicitudes')) {
      return {
        error:
          'Has alcanzado el límite de 3 solicitudes mensuales para este CURP.',
      }
    }
    return { error: insertError.message }
  }

  let rutas: string[] = []
  if (archivos.length > 0 && solicitud?.folio_unico) {
    rutas = await uploadArchivos(archivos, solicitud.folio_unico)

    if (rutas.length > 0) {
      await supabase
        .from('solicitudes')
        .update({ rutas_evidencia: rutas })
        .eq('id_solicitud', solicitud.id_solicitud)
    }
  }

  return { data: { ...solicitud, rutas_evidencia: rutas } }
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
