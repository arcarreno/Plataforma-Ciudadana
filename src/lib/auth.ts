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

  const row = data[0] as { v_id: number; v_username: string; v_rol: string; v_nombres: string; v_apellidos: string }
  const user: Usuario = {
    id: row.v_id,
    username: row.v_username,
    rol: row.v_rol as Usuario['rol'],
    nombres: row.v_nombres ?? '',
    apellidos: row.v_apellidos ?? '',
  }
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
  rol: string,
  nombres: string = '',
  apellidos: string = '',
): Promise<{ error?: string }> {
  const { data, error } = await supabase.rpc('crear_usuario', {
    p_admin_id: adminId,
    p_username: username,
    p_password: password,
    p_rol: rol,
    p_nombres: nombres,
    p_apellidos: apellidos,
  })

  if (error) return { error: error.message }
  const result = data as string
  if (result !== 'ok') return { error: result }
  return {}
}

export async function listarUsuarios(): Promise<{ data?: Usuario[]; error?: string }> {
  const { data, error } = await supabase.rpc('listar_usuarios')

  if (error) return { error: error.message }
  const rows = (data ?? []) as { v_id: number; v_username: string; v_rol: string; v_nombres: string; v_apellidos: string }[]
  return {
    data: rows.map(r => ({
      id: r.v_id,
      username: r.v_username,
      rol: r.v_rol as Usuario['rol'],
      nombres: r.v_nombres ?? '',
      apellidos: r.v_apellidos ?? '',
    })),
  }
}

export async function eliminarUsuario(
  adminId: number,
  userId: number,
): Promise<{ error?: string }> {
  const { data, error } = await supabase.rpc('eliminar_usuario', {
    p_admin_id: adminId,
    p_user_id: userId,
  })

  if (error) return { error: error.message }
  const result = data as string
  if (result === 'no_puede_borrarse_a_si_mismo') return { error: 'No puedes eliminar tu propia cuenta' }
  if (result === 'no_encontrado') return { error: 'Usuario no encontrado' }
  if (result !== 'ok') return { error: result }
  return {}
}
