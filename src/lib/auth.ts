/**
 * @file auth.ts
 * @description
 * Capa de autenticación y gestión de usuarios/operadores para SEMOVINFRA.
 * Abstrae el login, logout, sesión y ABM de usuarios detrás de dos backends:
 * - **Primario**: servidor Express vía `./servidor` (`loginServidor`, `crearUsuarioServidor`, etc.)
 * - **Respaldo**: Supabase directo (RPC `login_operador` / `listar_operadores`) cuando el servidor no responde.
 *
 * Dependencias:
 * - `./servidor` → funciones HTTP contra el backend Express.
 * - `./api` → clase `ApiError` para distinguir errores de red / HTTP.
 * - `./supabase` → cliente para los fallbacks RPC.
 * - `./backend` → `detectarModo` para refrescar estado tras fallos.
 * - `../types/auth` → tipo `Usuario`.
 * - `localStorage` → persiste sesión (`semovinfra_auth`) y token (`semovinfra_token`).
 *
 * Flujo de `login`:
 * 1. Intenta `loginServidor(username, password)` → guarda `Usuario` + `token` en storage.
 * 2. Si falla por red o 5xx → delega a `loginFallbackSupabase` (RPC `login_operador`).
 * 3. Si 401 → mensaje "Usuario o contraseña incorrectos".
 * 4. Otros errores → mensaje genérico vía `errorMsg`.
 *
 * Decisiones de diseño:
 * - El token de respaldo es sintético `respaldo-${Date.now()}` porque Supabase anon no emite JWT de operador.
 * - `void adminId` en `crearUsuario`/`eliminarUsuario` indica que el param es requerido por firma pero no usado (el token ya autoriza).
 * - `errorMsg` limpia el prefijo `API error N:` para mostrar mensajes amigables.
 */
import {
  loginServidor,
  listarUsuariosServidor,
  crearUsuarioServidor,
  eliminarUsuarioServidor,
} from './servidor'
import { ApiError } from './api'
import { supabase } from './supabase'
import { detectarModo } from './backend'
import type { Usuario } from '../types/auth'

/** Clave de `localStorage` donde se guarda el objeto `Usuario` serializado como JSON. */
const STORAGE_KEY = 'semovinfra_auth'
/** Clave de `localStorage` donde se guarda el token (JWT del servidor o sintético de respaldo). */
const TOKEN_KEY = 'semovinfra_token'

// ---------------------------------------------------------------------------
// Helpers de persistencia en localStorage
// ---------------------------------------------------------------------------

/**
 * Persiste usuario y token en `localStorage`.
 * @param user - Objeto `Usuario` a guardar (id, username, rol, nombres, apellidos).
 * @param token - Token de sesión (JWT real o `respaldo-...`).
 */
function guardarStorage(user: Usuario, token: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  localStorage.setItem(TOKEN_KEY, token)
}

/**
 * Limpia toda la sesión de `localStorage` (usuario + token).
 * Usado por `logout` y cuando la sesión expira.
 */
function limpiarStorage() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * Lee y parsea el usuario desde `localStorage`.
 * @returns `Usuario` si existe y el JSON es válido, `null` en caso contrario.
 */
function leerStorage(): Usuario | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    // JSON corrupto o storage no disponible
    return null
  }
}

// ---------------------------------------------------------------------------
// Helpers públicos de token / mensaje de error
// ---------------------------------------------------------------------------

/**
 * Obtiene el token actual desde `localStorage`.
 * @returns Token string o `null` si no hay sesión.
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * Extrae un mensaje legible desde un error desconocido.
 * Si es `ApiError`, quita el prefijo `API error 400: `; si no, devuelve genérico.
 * @param err - Error capturado (`unknown`).
 * @returns Mensaje listo para mostrar en UI.
 */
function errorMsg(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message.replace(/^API error \d+: /, '')
  }
  return 'Ocurrió un error inesperado'
}

// ---------------------------------------------------------------------------
// Login principal y fallback
// ---------------------------------------------------------------------------

/**
 * Autentica contra el servidor Express; si éste no responde, hace fallback a Supabase.
 * @param username - Nombre de usuario / operador.
 * @param password - Contraseña en texto plano (el servidor la hashea/verifica).
 * @returns `{ data: Usuario }` si éxito, `{ error: string }` si falla.
 * @remarks
 * - Éxito servidor: mapea `res.data` (id, username, rol, nombres, apellidos, token) a `Usuario` y persiste.
 * - Error de red / 5xx → intenta `loginFallbackSupabase`.
 * - 401 → credenciales incorrectas (no hace fallback).
 */
export async function login(
  username: string,
  password: string
): Promise<{ data?: Usuario; error?: string }> {
  try {
    const res = await loginServidor(username, password)
    const row = res.data
    // Mapear respuesta del servidor al tipo interno Usuario
    const user: Usuario = {
      id: row.id,
      username: row.username,
      rol: row.rol,
      nombres: row.nombres ?? '',
      apellidos: row.apellidos ?? '',
    }
    guardarStorage(user, row.token)
    return { data: user }
  } catch (err) {
    // Detectar fallo de red o error de servidor (5xx) para activar respaldo
    const errorRed =
      err instanceof ApiError && (err.isNetwork || err.status >= 500)
    if (errorRed) return loginFallbackSupabase(username, password)
    if (err instanceof ApiError && err.status === 401) {
      return { error: 'Usuario o contraseña incorrectos' }
    }
    return { error: errorMsg(err) }
  }
}

/**
 * Login de respaldo contra Supabase cuando el servidor Express no está disponible.
 * Usa la función RPC `login_operador` (SECURITY DEFINER) que valida contra la tabla `usuarios`.
 * @param username - Usuario a autenticar.
 * @param password - Contraseña.
 * @returns `{ data: Usuario }` si la RPC responde `ok: true`, `{ error: string }` en caso contrario.
 * @remarks
 * - Si la RPC falla por red, intenta forzar `detectarModo(true)` para actualizar el indicador de modo.
 * - El token guardado es sintético `respaldo-${Date.now()}` porque Supabase no emite JWT de sesión de operador.
 */
async function loginFallbackSupabase(
  username: string,
  password: string
): Promise<{ data?: Usuario; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('login_operador', {
      p_username: username,
      p_password: password,
    })
    if (error) {
      // Si ni siquiera el modo esta definido, forzar deteccion (best-effort para UI)
      try { await detectarModo(true) } catch { /* best effort */ }
      return { error: 'Error de conexión. Intenta de nuevo.' }
    }
    // Tipar la respuesta de la RPC de forma defensiva
    const r = data as { ok: boolean; id?: number; username?: string; rol?: Usuario['rol']; nombres?: string; apellidos?: string }
    if (!r?.ok) {
      return { error: 'Usuario o contraseña incorrectos' }
    }
    const user: Usuario = {
      id: Number(r.id),
      username: r.username ?? username,
      rol: r.rol ?? 'revisor',
      nombres: r.nombres ?? '',
      apellidos: r.apellidos ?? '',
    }
    // Token sintético de respaldo — no es JWT real, solo evita que la UI crea que no hay sesión
    guardarStorage(user, `respaldo-${Date.now()}`)
    return { data: user }
  } catch {
    return { error: 'Ocurrió un error inesperado' }
  }
}

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------

/**
 * Cierra la sesión actual borrando usuario y token de `localStorage`.
 * No hace llamada de red (logout local).
 */
export function logout() {
  limpiarStorage()
}

/**
 * Obtiene la sesión actual desde `localStorage`.
 * @returns `Usuario` si hay sesión persistida, `null` si no.
 */
export function getSession(): Usuario | null {
  return leerStorage()
}

// ---------------------------------------------------------------------------
// ABM de usuarios (solo admin / operadores con permiso)
// ---------------------------------------------------------------------------

/**
 * Crea un nuevo usuario/operador vía el servidor Express.
 * @param adminId - ID del admin que crea (requerido por firma, no usado — `void adminId` — el token autoriza).
 * @param username - Nombre de usuario nuevo (único).
 * @param password - Contraseña inicial.
 * @param rol - Rol del usuario (ej. `admin`, `revisor`, `operador`).
 * @param nombres - Nombres del operador (opcional, default `''`).
 * @param apellidos - Apellidos del operador (opcional, default `''`).
 * @returns `{}` si éxito, `{ error: string }` si falla (409 = ya existe, 401/403 = sin permiso).
 */
export async function crearUsuario(
  adminId: number,
  username: string,
  password: string,
  rol: string,
  nombres: string = '',
  apellidos: string = '',
): Promise<{ error?: string }> {
  void adminId // param exigido por la interfaz pero la autorización va en `token`
  const token = getToken()
  if (!token) return { error: 'Sesión expirada. Inicia sesión de nuevo.' }
  try {
    await crearUsuarioServidor(token, {
      username,
      password,
      rol,
      nombres,
      apellidos,
    })
    return {}
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return { error: 'El usuario ya existe' }
    }
    return { error: errorMsg(err) }
  }
}

/**
 * Lista todos los usuarios/operadores.
 * Intenta primero contra el servidor; si hay error de red/5xx, hace fallback a `supabase.rpc('listar_operadores')`.
 * @returns `{ data: Usuario[] }` si éxito, `{ error: string }` si falla o no hay token.
 */
export async function listarUsuarios(): Promise<{ data?: Usuario[]; error?: string }> {
  const token = getToken()
  if (!token) return { error: 'Sesión expirada. Inicia sesión de nuevo.' }
  try {
    const res = await listarUsuariosServidor(token)
    return { data: res.data }
  } catch (err) {
    // Fallback a Supabase solo en errores de red / servidor caído
    const errorRed = err instanceof ApiError && (err.isNetwork || err.status >= 500)
    if (errorRed) {
      try {
        const { data, error } = await supabase.rpc('listar_operadores')
        if (error) return { error: errorMsg(err) } // reusar error original para mensaje consistente
        const usuarios = (data as unknown as Usuario[] | null) ?? []
        return { data: usuarios }
      } catch {
        return { error: errorMsg(err) }
      }
    }
    return { error: errorMsg(err) }
  }
}

/**
 * Elimina un usuario/operador por ID (solo vía servidor, sin fallback).
 * @param adminId - ID del admin que elimina (no usado, autorización por token).
 * @param userId - ID del usuario a eliminar.
 * @returns `{}` si éxito, `{ error: string }` si falla (404 = no existe, 401 = sin token, auto-eliminación bloqueada).
 * @remarks Bloquea que un usuario se elimine a sí mismo comparando `getSession().id`.
 */
export async function eliminarUsuario(
  adminId: number,
  userId: number,
): Promise<{ error?: string }> {
  void adminId
  const token = getToken()
  if (!token) return { error: 'Sesión expirada. Inicia sesión de nuevo.' }
  const session = getSession()
  if (session?.id === userId) {
    return { error: 'No puedes eliminar tu propia cuenta' }
  }
  try {
    await eliminarUsuarioServidor(token, userId)
    return {}
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { error: 'Usuario no encontrado' }
    }
    return { error: errorMsg(err) }
  }
}
