import { supabase } from './supabase'
import type { Usuario } from '../types/auth'

const STORAGE_KEY = 'semovinfra_auth'

function guardarStorage(user: Usuario) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

function limpiarStorage() {
  localStorage.removeItem(STORAGE_KEY)
}

function leerStorage(): Usuario | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function login(
  username: string,
  password: string
): Promise<{ data?: Usuario; error?: string }> {
  const { data, error } = await supabase.rpc('login_usuario', {
    p_username: username,
    p_password: password,
  })

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Usuario o contraseña incorrectos' }

  const row = data[0] as { v_id: number; v_username: string; v_rol: string }
  const user: Usuario = { id: row.v_id, username: row.v_username, rol: row.v_rol as Usuario['rol'] }
  guardarStorage(user)
  return { data: user }
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
  rol: string
): Promise<{ error?: string }> {
  const { data, error } = await supabase.rpc('crear_usuario', {
    p_admin_id: adminId,
    p_username: username,
    p_password: password,
    p_rol: rol,
  })

  if (error) return { error: error.message }
  const result = data as string
  if (result !== 'ok') return { error: result }
  return {}
}

export async function listarUsuarios(): Promise<{ data?: Usuario[]; error?: string }> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, username, rol')
    .order('id', { ascending: true })

  if (error) return { error: error.message }
  return { data: data as Usuario[] }
}
