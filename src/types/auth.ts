export interface Usuario {
  id: number
  username: string
  nombres: string
  apellidos: string
  rol: 'admin' | 'revisor' | 'diputado' | 'senador'
}

export function nombreCompleto(u: Usuario): string {
  return `${u.nombres} ${u.apellidos}`.trim()
}

export function esCargoPublico(rol: string): boolean {
  return rol === 'diputado' || rol === 'senador'
}
