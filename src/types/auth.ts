/**
 * @file auth.ts
 * @description
 * Tipos y helpers de autenticación/autorización para usuarios operadores.
 * Define la forma del usuario autenticado (proveniente de Supabase/servidor)
 * y utilidades para mostrar nombre completo y verificar si un rol tiene
 * privilegios de cargo público (para ranking y permisos).
 *
 * Dependencias: ninguna (tipos puros). Es consumido por `contexts/AuthContext`,
 * `lib/auth` y componentes con control de acceso por rol.
 *
 * Uso:
 * ```ts
 * import { type Usuario, nombreCompleto, esCargoPublico } from '@/types/auth'
 * if (esCargoPublico(user.rol)) { ... }
 * ```
 */

/**
 * Usuario operador autenticado del sistema.
 * Proviene del backend (`loginServidor` o `login_operador` en Supabase).
 * @property id - PK del usuario.
 * @property username - Nombre de usuario único para login (en cuentas nuevas es el correo).
 * @property email - Correo institucional (solo cuentas creadas por auto-registro).
 * @property nombres - Nombre(s) de pila.
 * @property apellidos - Apellidos.
 * @property rol - Rol asignado; determina permisos y bonificación de ranking.
 */
export interface Usuario {
  id: number
  username: string
  email?: string
  nombres: string
  apellidos: string
  rol: 'admin' | 'revisor' | 'diputado' | 'senador' | 'legislador'
}

/**
 * Concatena nombres y apellidos en un nombre completo para display.
 * Hace trim para evitar espacios dobles si alguno viene vacío.
 * @param u - Usuario del que se quiere el nombre completo.
 * @returns Cadena con "nombres apellidos" (ej. "Juan Pérez").
 */
export function nombreCompleto(u: Usuario): string {
  return `${u.nombres} ${u.apellidos}`.trim()
}

/**
 * Determina si un rol corresponde a cargo público con privilegios.
 * Incluye `legislador` (auto-registro del Congreso local).
 * @param rol - String del rol a evaluar (puede venir de BD o contexto).
 * @returns `true` si es admin, revisor, diputado, senador o legislador.
 */
export function esCargoPublico(rol: string): boolean {
  return rol === 'admin' || rol === 'revisor' || rol === 'diputado' || rol === 'senador' || rol === 'legislador'
}
