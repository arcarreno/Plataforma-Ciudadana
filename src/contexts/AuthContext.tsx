/**
 * @file AuthContext.tsx
 * @description
 * Contexto global de autenticación para la app. Provee estado del usuario
 * autenticado (`Usuario | null`) y acciones `iniciarSesion` / `cerrarSesion`
 * a toda la jerarquía de componentes mediante `AuthProvider` y el hook `useAuth`.
 * Persiste sesión en `localStorage` vía `lib/auth` (`getSession`, `login`, `logout`).
 *
 * Dependencias:
 * - React (`createContext`, `useContext`, `useState`, `useCallback`, `useEffect`)
 * - Tipo `Usuario` de `../types/auth`
 * - Funciones `login`, `logout`, `getSession` de `../lib/auth` (capa de API + storage)
 *
 * Uso:
 * ```tsx
 * // En App.tsx
 * <AuthProvider><App /></AuthProvider>
 * // En cualquier componente
 * const { user, iniciarSesion, cerrarSesion } = useAuth()
 * ```
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Usuario } from '../types/auth'
import { login as apiLogin, logout as apiLogout, getSession, persistirSesion } from '../lib/auth'

/**
 * Forma del valor expuesto por el contexto de autenticación.
 * @property user - Usuario autenticado o null si no hay sesión.
 * @property iniciarSesion - Intenta login; retorna string con mensaje de error o null si éxito.
 * @property establecerSesion - Persiste una sesión ya autenticada (auto-login tras registro).
 * @property cerrarSesion - Limpia storage y estado local.
 */
interface AuthContextType {
  user: Usuario | null
  iniciarSesion: (username: string, password: string) => Promise<string | null>
  establecerSesion: (user: Usuario, token: string) => void
  cerrarSesion: () => void
}

/**
 * Contexto React que almacena `AuthContextType`.
 * Inicialmente null hasta que `AuthProvider` lo provea; `useAuth` valida su presencia.
 */
const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Provider que envuelve la aplicación y gestiona el estado de sesión.
 * @param children - Subárbol React que tendrá acceso al contexto (toda la app).
 * @returns Provider con `user`, `iniciarSesion` y `cerrarSesion`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Inicializa leyendo sesión de localStorage de forma lazy (solo en primer render).
  const [user, setUser] = useState<Usuario | null>(() => getSession())

  /**
   * Efecto de hidratación: re-lee la sesión al montar (por si cambió en otra pestaña
   * o se precargó antes de que el provider existiera). Solo se ejecuta una vez.
   */
  useEffect(() => {
    setUser(getSession())
  }, [])

  /**
   * Intenta iniciar sesión contra el backend.
   * @param username - Usuario ingresado en el formulario.
   * @param password - Contraseña en texto plano (se envía por HTTPS al servidor).
   * @returns Mensaje de error si falla, o null si el login fue exitoso (y actualiza `user`).
   */
  const iniciarSesion = useCallback(async (username: string, password: string): Promise<string | null> => {
    // Delega a la capa `lib/auth` que maneja servidor + fallback Supabase.
    const res = await apiLogin(username, password)
    if (res.error) return res.error // Propaga error para mostrar en UI
    if (res.data) setUser(res.data) // Actualiza estado global si hay usuario
    return null // Éxito: sin error
  }, [])

  /**
   * Persiste una sesión ya autenticada (auto-login tras completar registro).
   */
  const establecerSesion = useCallback((u: Usuario, token: string) => {
    persistirSesion(u, token)
    setUser(u)
  }, [])

  /**
   * Cierra sesión: limpia localStorage (token + usuario) y resetea estado a null.
   * No navega; el caller decide redirigir si es necesario.
   */
  const cerrarSesion = useCallback(() => {
    apiLogout() // Limpia STORAGE_KEY y TOKEN_KEY en localStorage
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, iniciarSesion, establecerSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook de consumo del contexto de autenticación.
 * Debe usarse dentro de un `AuthProvider`; de lo contrario lanza error explícito.
 * @returns `AuthContextType` con usuario y acciones.
 * @throws Error si se llama fuera del provider (ayuda a detectar mal uso en desarrollo).
 */
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
