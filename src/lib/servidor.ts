/**
 * src/lib/servidor.ts — Fachada dual (FastAPI ↔ Supabase) de la Plataforma Ciudadana
 *
 * Este archivo es el "router" de datos: decide si cada operación va al
 * backend FastAPI (modo normal) o directo a Supabase (modo respaldo cuando
 * el servidor está caído). Implementa el patrón fallback transparente.
 *
 * Dependencias:
 *  - api / postForm / ApiError  -> src/lib/api.ts (cliente HTTP con manejo de red)
 *  - supabase                   -> src/lib/supabase.ts (cliente Supabase)
 *  - detectarModo/invalidarModo -> src/lib/backend.ts (heartbeat 5min + cache 60s)
 *
 * Flujo general de cada función con fallback:
 *  1) if (await modoEsSupabase()) -> va directo a Supabase
 *  2) try { api.get/post... } -> intenta FastAPI
 *  3) catch (esErrorRed) -> invalidarModo() + re-checa modo -> si ahora es supabase, reintenta en Supabase
 *  4) si no es error de red, lo propaga (ej: 400 validación, 404 no encontrado)
 */

import { api, postForm, ApiError } from './api'
import { supabase } from './supabase'
import { detectarModo, invalidarModo } from './backend'
import type { Solicitud } from '../types/solicitud'
import type { EstatusFase } from '../core/constants'
import type { Usuario } from '../types/auth'

// ---------------------------------------------------------------------------
// Tipos de respuesta (lo que devuelve FastAPI y también Supabase normalizado)
// ----------------------------------------------------------------------------

/** Respuesta paginada de listado: array + total para paginación */
export interface ListadoSolicitudes {
  data: Solicitud[] // Página actual de solicitudes
  total: number // Total en BD (para calcular páginas)
}

/** Vecino cercano para solicitudes con peso_ranking=12 (concentración) */
export interface SolicitudVecino {
  id_solicitud: number
  folio_unico: string
  distancia_m: number // Distancia haversine en metros
}

// ---------------------------------------------------------------------------
// Helper interno: ¿estamos en modo respaldo?
// ----------------------------------------------------------------------------

/**
 * Pregunta a backend.ts si el heartbeat del servidor está fresco (<5min).
 * Si no, estamos en modo 'supabase' y todas las lecturas van directo a la BD.
 * Es async porque puede hacer fetch a heartbeat_servidor si el cache expiró (60s).
 */
async function modoEsSupabase(): Promise<boolean> {
  return (await detectarModo()) === 'supabase'
}

// ---------------------------------------------------------------------------
// 1) Listar solicitudes con filtros + paginación + fallback
// ----------------------------------------------------------------------------

/**
 * Lista solicitudes con búsqueda, filtros y paginación.
 * Es la función más usada: AdminDashboard (50 por página), ConsultarFolio (200), exportar Excel (200 en loop).
 *
 * @param params.q         - Texto libre (folio, curp, nombre) -> ilike en Supabase o ?q= en FastAPI
 * @param params.estatus   - Filtro exacto estatus_fase (ej: "En revisión")
 * @param params.prioridad - Filtro por peso_ranking (numérico, ej: "15" para alta)
 * @param params.page      - Página 1-based
 * @param params.pageSize  - Tamaño de página (50 admin, 200 para export)
 * @param params.asc       - Orden ascendente por fecha_creacion (default desc)
 */
export async function listarSolicitudes(params: {
  q?: string
  estatus?: string
  prioridad?: string
  page?: number
  pageSize?: number
  asc?: boolean
}): Promise<ListadoSolicitudes> {
  // Si ya sabemos que el servidor está caído, ni lo intentamos -> directo a Supabase
  if (await modoEsSupabase()) {
    return listarSolicitudesSupabase(params)
  }

  // Construimos query string para FastAPI: ?q=...&estatus=...&page=...&page_size=...&asc=true
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.estatus) query.set('estatus', params.estatus)
  if (params.prioridad) query.set('prioridad', params.prioridad)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('page_size', String(params.pageSize))
  if (params.asc) query.set('asc', 'true')
  const qs = query.toString()

  try {
    // Intento principal: FastAPI
    return await api.get<ListadoSolicitudes>(`/api/solicitudes${qs ? `?${qs}` : ''}`)
  } catch (err) {
    // Solo hacemos fallback si fue caída de red (isNetwork=true), no si fue 400/404/422
    if (!esErrorRed(err)) throw err
    // Marcamos el modo como inválido para que el próximo detectarModo() re-consulte heartbeat
    invalidarModo()
    // Re-checamos: si ahora es supabase, reintentamos ahí; si no, propagamos el error de red
    if (await modoEsSupabase()) return listarSolicitudesSupabase(params)
    throw err
  }
}

/**
 * Fallback directo a Supabase (sin pasar por FastAPI).
 * Replica la lógica de filtrado/búsqueda/paginación usando el query builder de Supabase.
 * Usado cuando FastAPI está caído o desde el inicio si el heartbeat está viejo.
 */
async function listarSolicitudesSupabase(params: {
  q?: string
  estatus?: string
  prioridad?: string
  page?: number
  pageSize?: number
  asc?: boolean
}): Promise<ListadoSolicitudes> {
  // Paginación: Supabase usa range(from, to) inclusivo, no page/pageSize
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Base query: select * + count exacto + orden por fecha_creacion
  let query = supabase
    .from('solicitudes')
    .select('*', { count: 'exact' })
    .order('fecha_creacion', { ascending: params.asc ?? false })

  // Búsqueda texto: OR ilike en folio, curp y nombre (case-insensitive, %q%)
  if (params.q) {
    query = query.or(`folio_unico.ilike.%${params.q}%,curp.ilike.%${params.q}%,nombre_solicitante.ilike.%${params.q}%`)
  }
  // Filtro exacto por estatus_fase
  if (params.estatus) {
    query = query.eq('estatus_fase', params.estatus)
  }
  // Filtro por prioridad (peso_ranking es integer en BD)
  if (params.prioridad) {
    query = query.eq('peso_ranking', Number(params.prioridad))
  }
  // Aplicamos rango de paginación
  query = query.range(from, to)

  const { data, error, count } = await query
  // Error de Supabase (ej: tabla no existe, RLS) -> lo convertimos a ApiError 502 para que el caller lo maneje igual
  if (error) throw new ApiError(`Supabase fallback: ${error.message}`, 502)
  return { data: (data as unknown as Solicitud[]) ?? [], total: count ?? 0 }
}

// ---------------------------------------------------------------------------
// 2) Consultar por folio (único, ej: ST0001)
// ----------------------------------------------------------------------------

/**
 * Obtiene una solicitud por su folio único (case-insensitive, trim + upper).
 * Usada en ConsultarFolio.tsx y en lib/solicitud.ts -> consultarSolicitud() con cache localStorage.
 * Tiene el mismo patrón dual: intenta FastAPI, si cae a red reintenta Supabase.
 */
export async function consultarFolio(folio: string): Promise<{ data: Solicitud }> {
  // Modo respaldo -> directo a Supabase
  if (await modoEsSupabase()) {
    const { data, error } = await supabase
      .from('solicitudes')
      .select()
      .eq('folio_unico', folio.trim().toUpperCase()) // Normalizamos: trim + upper
      .maybeSingle() // null si no existe, no lanza error
    if (error) throw new ApiError(`Supabase fallback: ${error.message}`, 502)
    if (!data) throw new ApiError('No encontrada', 404) // Mapeamos a 404 como FastAPI
    return { data: data as unknown as Solicitud }
  }
  try {
    // FastAPI: GET /api/solicitudes/folio/{folio} con encode por si tiene caracteres raros
    return await api.get<{ data: Solicitud }>(`/api/solicitudes/folio/${encodeURIComponent(folio)}`)
  } catch (err) {
    if (!esErrorRed(err)) throw err // 404/400 no son red -> se propagan
    invalidarModo()
    // Reintento Supabase idéntico al de arriba si ahora estamos en modo respaldo
    if (await modoEsSupabase()) {
      const { data, error } = await supabase
        .from('solicitudes')
        .select()
        .eq('folio_unico', folio.trim().toUpperCase())
        .maybeSingle()
      if (error) throw new ApiError(`Supabase fallback: ${error.message}`, 502)
      if (!data) throw new ApiError('No encontrada', 404)
      return { data: data as unknown as Solicitud }
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// 3) Solicitudes para el mapa (sin filtros, solo límite)
// ----------------------------------------------------------------------------

/**
 * Trae N solicitudes para pintar pines en MapasEstadisticas.
 * Por defecto sin límite (todas), pero normalmente se llama con 500.
 * No pagina ni filtra, solo limit.
 */
export async function solicitudesMapa(limit?: number): Promise<{ data: Solicitud[] }> {
  if (await modoEsSupabase()) {
    let query = supabase.from('solicitudes').select()
    if (limit) query = query.limit(limit)
    const { data, error } = await query
    if (error) throw new ApiError(`Supabase fallback: ${error.message}`, 502)
    return { data: (data as unknown as Solicitud[]) ?? [] }
  }
  try {
    return await api.get<{ data: Solicitud[] }>(
      `/api/solicitudes/mapa${limit ? `?limit=${limit}` : ''}`
    )
  } catch (err) {
    if (!esErrorRed(err)) throw err
    invalidarModo()
    if (await modoEsSupabase()) {
      let query = supabase.from('solicitudes').select()
      if (limit) query = query.limit(limit)
      const { data, error } = await query
      if (error) throw new ApiError(`Supabase fallback: ${error.message}`, 502)
      return { data: (data as unknown as Solicitud[]) ?? [] }
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// 4) Obtener una solicitud por ID numérico (PK)
// ----------------------------------------------------------------------------

/**
 * Obtiene solicitud por id_solicitud (PK integer).
 * Usada en SolicitudDetail para “ver vecino” (concentración) y en obtenerSolicitud.
 * Mismo patrón dual que consultarFolio.
 */
export async function obtenerSolicitud(id: number): Promise<{ data: Solicitud }> {
  if (await modoEsSupabase()) {
    const { data, error } = await supabase
      .from('solicitudes')
      .select()
      .eq('id_solicitud', id)
      .maybeSingle()
    if (error) throw new ApiError(`Supabase fallback: ${error.message}`, 502)
    if (!data) throw new ApiError('No encontrada', 404)
    return { data: data as unknown as Solicitud }
  }
  try {
    return await api.get<{ data: Solicitud }>(`/api/solicitudes/${id}`)
  } catch (err) {
    if (!esErrorRed(err)) throw err
    invalidarModo()
    if (await modoEsSupabase()) {
      const { data, error } = await supabase
        .from('solicitudes')
        .select()
        .eq('id_solicitud', id)
        .maybeSingle()
      if (error) throw new ApiError(`Supabase fallback: ${error.message}`, 502)
      if (!data) throw new ApiError('No encontrada', 404)
      return { data: data as unknown as Solicitud }
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// 5) Vecinos para concentración (peso_ranking=12) — solo FastAPI, sin fallback
// ----------------------------------------------------------------------------

/**
 * Para solicitudes con peso 12 (concentración), trae vecinos en radio cercano.
 * NO tiene fallback a Supabase: es cálculo geoespacial en backend (PostGIS).
 * Si el servidor está caído, esta función fallará (se muestra “sin vecinos”).
 */
export function concentracionVecinos(id: number): Promise<{ data: SolicitudVecino[] }> {
  return api.get<{ data: SolicitudVecino[] }>(`/api/solicitudes/${id}/vecinos`)
}

// ---------------------------------------------------------------------------
// 6) Patches de edición (solo FastAPI, sin fallback)
// ----------------------------------------------------------------------------
// Estas operaciones son de escritura y requieren validación de backend,
// por eso no tienen fallback a Supabase. Si el servidor está caído, fallan.

/** Actualiza calle y entre_calles de una solicitud (ej: corrección tras visita) */
export function actualizarGeo(
  id: number,
  data: { calle: string; entre_calles: string }
): Promise<{ ok: boolean }> {
  return api.patch<{ ok: boolean }>(`/api/solicitudes/${id}/geo`, data)
}

/** Actualiza tipo de obra, colonia y junta auxiliar */
export function actualizarObra(
  id: number,
  data: { tipo_solicitud: string; colonia: string; junta_auxiliar: string }
): Promise<{ ok: boolean }> {
  return api.patch<{ ok: boolean }>(`/api/solicitudes/${id}/obra`, data)
}

/** Actualiza datos del tramo: distancia, ancho, ZAP, agua, escuelas/iglesias/rutas cercanas */
export function actualizarTramo(
  id: number,
  data: {
    distancia_tramo_m: number | null
    ancho_calle_m: number | null
    zona_zap: boolean
    cobertura_agua: boolean
    escuelas_cercanas: string[]
    iglesias_cercanas: string[]
    transportes_cercanos: string[]
  }
): Promise<{ ok: boolean }> {
  return api.patch<{ ok: boolean }>(`/api/solicitudes/${id}/tramo`, data)
}

/** Cambia el estatus_fase (ej: "En revisión" -> "En DGPP") — usado en AdminDashboard */
export function actualizarEstatus(
  id: number,
  estatus: EstatusFase
): Promise<{ ok: boolean }> {
  // FastAPI espera {estatus_fase: "..."} no {estatus: "..."}
  return api.patch<{ ok: boolean }>(`/api/solicitudes/${id}/estatus`, {
    estatus_fase: estatus,
  })
}

/** Borra una solicitud (solo admin) */
export function eliminarSolicitud(id: number): Promise<{ ok: boolean }> {
  return api.delete<{ ok: boolean }>(`/api/solicitudes/${id}`)
}

// ---------------------------------------------------------------------------
// 7) Crear solicitud (multipart con archivos) — solo FastAPI
// ---------------------------------------------------------------------------

/** Respuesta al crear: la solicitud creada + posible advertencia (ej: “guardado en respaldo”) */
export interface CrearSolicitudResult {
  data: Solicitud
  advertencia?: string | null
}

/**
 * Crea una solicitud con FormData (multipart).
 * El FormData ya viene armado en lib/solicitud.ts con 20 campos + archivos.
 * Usa postForm() (sin Content-Type JSON) para que el navegador ponga el boundary.
 * No tiene fallback aquí: el fallback Supabase lo hace lib/solicitud.ts si esto falla por red.
 */
export function crearSolicitud(
  form: FormData
): Promise<CrearSolicitudResult> {
  return postForm<CrearSolicitudResult>('/api/solicitudes', form)
}

// ---------------------------------------------------------------------------
// 8) IA guiada (Ollama en el servidor) — solo FastAPI
// ----------------------------------------------------------------------------

/** Campos que la IA puede autollenar a partir de texto libre dictado por voz */
export interface IaLlenarResultado {
  nombre_solicitante: string
  apellido_paterno: string
  apellido_materno: string
  nombres: string
  curp: string
  telefono: string
  correo: string
  tipo_solicitud: string
  colonia: string
  calle: string
  entre_calles: string
  descripcion: string
}

/**
 * Envía texto dictado al endpoint de IA (Ollama) para extraer campos.
 * El backend hace parsing con LLM y devuelve IaLlenarResultado parcial.
 * Si falla o no hay servidor, el frontend usa iaLocal.ts como fallback local.
 */
export function iaLlenar(texto: string): Promise<{ data: IaLlenarResultado }> {
  return api.post<{ data: IaLlenarResultado }>('/api/ia/llenar', { texto })
}

// ---------------------------------------------------------------------------
// 9) Helpers de clasificación de errores
// ----------------------------------------------------------------------------

/**
 * ¿Fue caída de red? (fetch no llegó al servidor)
 * Usado para decidir si se hace fallback a Supabase.
 */
export function esErrorRed(err: unknown): boolean {
  return err instanceof ApiError && err.isNetwork
}

/**
 * ¿Fue error de validación 422? (ej: CURP mal formada, campo requerido)
 * Usado para mostrar errores de formato en el form sin fallback.
 */
export function esErrorFormato(err: unknown): boolean {
  return err instanceof ApiError && err.status === 422
}

// ---------------------------------------------------------------------------
// 10) Auth — login y gestión de usuarios (solo FastAPI, con Bearer)
// ----------------------------------------------------------------------------

/** Respuesta de login: token + datos del usuario autenticado */
export interface LoginResult {
  data: {
    token: string
    id: number
    username: string
    rol: Usuario['rol'] // 'admin' | 'revisor' | 'diputado' | 'senador'
    nombres: string
    apellidos: string
  }
}

/** Login contra FastAPI (POST /api/auth/login {username,password}) */
export function loginServidor(
  username: string,
  password: string
): Promise<LoginResult> {
  return api.post<LoginResult>('/api/auth/login', { username, password })
}

/** Lista usuarios (requiere Bearer token) — usado en GestionUsuarios.tsx */
export function listarUsuariosServidor(token: string): Promise<{ data: Usuario[] }> {
  return api.get<{ data: Usuario[] }>('/api/auth/usuarios', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** Crea usuario (requiere Bearer admin) — 409 si ya existe */
export function crearUsuarioServidor(
  token: string,
  body: { username: string; password: string; rol: string; nombres: string; apellidos: string }
): Promise<{ ok: boolean; id: number | null }> {
  return api.post('/api/auth/usuarios', body, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** Elimina usuario por ID (requiere Bearer admin) */
export function eliminarUsuarioServidor(
  token: string,
  usuarioId: number
): Promise<{ ok: boolean }> {
  return api.delete(`/api/auth/usuarios/${usuarioId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}
