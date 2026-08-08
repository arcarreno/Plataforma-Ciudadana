import { supabase } from './supabase'

export type ModoBackend = 'servidor' | 'supabase'

// Si el heartbeat del servidor está quieto más de 5 min, el sistema
// pasa a modo Supabase (escritura/lectura directa con anon key).
export const UMBRAL_HEARTBEAT_MS = 5 * 60 * 1000
// Cachear la decisión para no golpear Supabase en cada request.
export const CACHE_MODO_MS = 60 * 1000

const STORAGE_KEY = 'semovinfra_modo'
let modoCache: ModoBackend | null = null
let lastCheck = 0
let lastHeartbeat: Date | null = null

type Listener = (modo: ModoBackend) => void
const listeners = new Set<Listener>()

export function suscribirModo(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function emitir(modo: ModoBackend) {
  try {
    localStorage.setItem(STORAGE_KEY, modo)
  } catch {
    /* best effort */
  }
  listeners.forEach((fn) => fn(modo))
}

export function modoEnCache(): ModoBackend | null {
  if (modoCache) return modoCache
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'servidor' || v === 'supabase' ? v : null
  } catch {
    return null
  }
}

export async function leerHeartbeat(): Promise<Date | null> {
  try {
    const { data } = await supabase
      .from('heartbeat_servidor')
      .select('updated_at')
      .eq('id', 1)
      .maybeSingle()
    if (data && typeof data.updated_at === 'string') {
      return new Date(data.updated_at)
    }
    return null
  } catch {
    return null
  }
}

export async function detectarModo(force = false): Promise<ModoBackend> {
  const now = Date.now()
  if (!force && modoCache && now - lastCheck < CACHE_MODO_MS) {
    return modoCache
  }
  const hb = await leerHeartbeat()
  const fresca = hb !== null && now - hb.getTime() < UMBRAL_HEARTBEAT_MS
  lastHeartbeat = hb
  lastCheck = now
  const nuevo: ModoBackend = fresca ? 'servidor' : 'supabase'
  if (modoCache !== nuevo) {
    modoCache = nuevo
    emitir(nuevo)
  } else {
    modoCache = nuevo
  }
  return nuevo
}

export function ultimoHeartbeat(): Date | null {
  return lastHeartbeat
}

// Forzar recarga del modo (para cuando un request al servidor falla por red).
export function invalidarModo() {
  modoCache = null
  lastCheck = 0
}