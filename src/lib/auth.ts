import {
  loginServidor,
  listarUsuariosServidor,
  crearUsuarioServidor,
  eliminarUsuarioServidor,
} from './servidor'
import { ApiError } from './api'
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
    if (err instanceof ApiError && err.status === 401) {
      return { error: 'Usuario o contraseña incorrectos' }
    }
    return { error: errorMsg(err) }
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
