/**
 * @file directorios.ts
 * @description Directorios institucionales EMBEBIDOS en el bundle para búsqueda
 * local instantánea (nombre + género para el saludo "Bienvenida Diputada …").
 * Antes se consultaban por red (`GET /api/auth/directorio/*`); eso hacía que
 * el nombre no apareciera cuando el túnel estaba rotando o caído. Ahora la
 * búsqueda es síncrona y funciona sin red.
 *
 * Origen de los datos: `src/data/*.json` (scrape único + curaduría manual).
 * El backend sigue sirviendo los mismos JSON en `/api/auth/directorio/*`
 * como fuente de verdad para refrescar estos archivos.
 */

import legisladoresJson from './legisladores.json'
import diputadosJson from './diputados_federales.json'
import senadoresJson from './senadores.json'

/** Tipos de directorio (mismas claves que el backend). */
export type TipoDirectorio = 'legisladores' | 'diputados' | 'senadores'

/** Entrada de directorio: nombre, correo, partido y género opcionales. */
export interface EntradaDirectorioLocal {
  nombre: string
  email: string
  partido?: string
  genero?: string
  [k: string]: unknown
}

const POR_TIPO: Record<TipoDirectorio, EntradaDirectorioLocal[]> = {
  legisladores: legisladoresJson.registros as EntradaDirectorioLocal[],
  diputados: diputadosJson.registros as EntradaDirectorioLocal[],
  senadores: senadoresJson.registros as EntradaDirectorioLocal[],
}

/**
 * Busca un correo en el directorio embebido (match exacto, case-insensitive).
 * Síncrona: no depende del túnel ni de la red.
 */
export function buscarEnDirectorioLocal(
  tipo: TipoDirectorio,
  email: string,
): EntradaDirectorioLocal | null {
  const normalizado = email.trim().toLowerCase()
  if (!normalizado) return null
  return (
    POR_TIPO[tipo].find(
      (e) => String(e.email || '').trim().toLowerCase() === normalizado,
    ) ?? null
  )
}
