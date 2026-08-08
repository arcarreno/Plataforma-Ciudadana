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

const STORAGE_KEY = 'semovinfra_auth'
const TOKEN_KEY = 'semovinfra_token'

function guardarStorage(user: Usuario, token: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  localStorage.setItem(TOKEN_KEY, token)
}

function limpiarStorage() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

function leerStorage(): Usuario | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function errorMsg(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message.replace(/^API error \d+: /, '')
  }
  return 'Ocurrió un error inesperado'
}

export async function login(
  username: string,
  password: string
): Promise<{ data?: Usuario; error?: string }> {
  try {
    const res = await loginServidor(username, password)
    const row = res.data
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
    const errorRed =
      err instanceof ApiError && (err.isNetwork || err.status >= 500)
    if (errorRed) return loginFallbackSupabase(username, password)
    if (err instanceof ApiError && err.status === 401) {
      return { error: 'Usuario o contraseña incorrectos' }
    }
    return { error: errorMsg(err) }
  }
}

// Login de respaldo: si el servidor local no responde, se autentica contra la
// tabla usuarios de Supabase (funcion login_operador, SECURITY DEFINER).
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
      // Si ni siquiera el modo esta definido, forzar deteccion
      try { await detectarModo(true) } catch { /* best effort */ }
      return { error: 'Error de conexión. Intenta de nuevo.' }
    }
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
    guardarStorage(user, `respaldo-${Date.now()}`)
    return { data: user }
  } catch {
    return { error: 'Ocurrió un error inesperado' }
  }
}

export function logout() {
  limpiarStorage()
}

export function getSession(): Usuario | null {
  return leerStorage()
}

export async function crearUsuario(
  adminId: number,
  username: string,
  password: string,
  rol: string,
  nombres: string = '',
  apellidos: string = '',
): Promise<{ error?: string }> {
  void adminId
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

export async function listarUsuarios(): Promise<{ data?: Usuario[]; error?: string }> {
  const token = getToken()
  if (!token) return { error: 'Sesión expirada. Inicia sesión de nuevo.' }
  try {
    const res = await listarUsuariosServidor(token)
    return { data: res.data }
  } catch (err) {
    const errorRed = err instanceof ApiError && (err.isNetwork || err.status >= 500)
    if (errorRed) {
      try {
        const { data, error } = await supabase.rpc('listar_operadores')
        if (error) return { error: errorMsg(err) }
        const usuarios = (data as unknown as Usuario[] | null) ?? []
        return { data: usuarios }
      } catch {
        return { error: errorMsg(err) }
      }
    }
    return { error: errorMsg(err) }
  }
}

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
