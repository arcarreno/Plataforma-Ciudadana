import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Usuario } from '../types/auth'
import { login as apiLogin, logout as apiLogout, getSession } from '../lib/auth'

interface AuthContextType {
  user: Usuario | null
  iniciarSesion: (username: string, password: string) => Promise<string | null>
  cerrarSesion: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(() => getSession())

  useEffect(() => {
    setUser(getSession())
  }, [])

  const iniciarSesion = useCallback(async (username: string, password: string): Promise<string | null> => {
    const res = await apiLogin(username, password)
    if (res.error) return res.error
    if (res.data) setUser(res.data)
    return null
  }, [])

  const cerrarSesion = useCallback(() => {
    apiLogout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
