/**
 * @file backend.ts
 * @description
 * Lógica de detección y conmutación automática del modo de backend de la aplicación.
 * La app puede operar en dos modos:
 * - `servidor` → consume el backend Express local (API propia).
 * - `supabase` → lee/escribe directamente contra Supabase con anon key (modo respaldo/offline).
 *
 * Dependencias:
 * - `./supabase` → cliente singleton para consultar la tabla `heartbeat_servidor`.
 * - `localStorage` → persiste la última decisión de modo (`semovinfra_modo`).
 *
 * Flujo general:
 * 1. El servidor Express actualiza periódicamente `heartbeat_servidor.updated_at` (id=1).
 * 2. `detectarModo()` lee ese heartbeat; si está "fresco" (< 5 min) → modo `servidor`, si no → `supabase`.
 * 3. El resultado se cachea en memoria 60 s (`CACHE_MODO_MS`) y en `localStorage` para evitar
 *    golpear Supabase en cada request.
 * 4. Componentes se suscriben con `suscribirModo(fn)` para reaccionar a cambios de modo.
 * 5. `invalidarModo()` fuerza la re-evaluación tras un error de red.
 *
 * Decisiones de diseño:
 * - Umbral de 5 min: tolera latencia/reinicio breve del servidor sin cambiar a respaldo.
 * - Cache de 60 s en memoria + localStorage: reduce lecturas pero mantiene reactividad.
 * - `emitir()` usa try/catch porque `localStorage` puede no estar disponible (SSR/privado).
 * - `lastHeartbeat` se guarda para que la UI pueda mostrar "último contacto del servidor".
 */
import { supabase } from './supabase'

/**
 * Modo operativo actual del sistema.
 * - `servidor`: el heartbeat está fresco; se usan endpoints Express.
 * - `supabase`: heartbeat vencido o ausente; se usa Supabase directo como respaldo.
 */
export type ModoBackend = 'servidor' | 'supabase'

// ---------------------------------------------------------------------------
// Constantes de temporización
// ---------------------------------------------------------------------------

/**
 * Umbral máximo de antigüedad del heartbeat para considerar que el servidor está vivo.
 * Si `now - updated_at > UMBRAL_HEARTBEAT_MS` → se conmuta a `supabase`.
 * Valor: 5 minutos = 5 * 60 * 1000 ms.
 */
export const UMBRAL_HEARTBEAT_MS = 5 * 60 * 1000

/**
 * Tiempo de validez del cache en memoria de `detectarModo()`.
 * Evita consultar Supabase en cada navegación/render.
 * Valor: 60 segundos.
 */
export const CACHE_MODO_MS = 60 * 1000

/** Clave de `localStorage` donde se persiste el último modo detectado. */
const STORAGE_KEY = 'semovinfra_modo'

/** Cache en memoria del último modo calculado; `null` = aún no calculado o invalidado. */
let modoCache: ModoBackend | null = null

/** Timestamp (ms) del último `detectarModo()` exitoso; sirve para evaluar `CACHE_MODO_MS`. */
let lastCheck = 0

/** Último valor de `heartbeat_servidor.updated_at` leído; `null` si no hay fila o hubo error. */
let lastHeartbeat: Date | null = null

/** Firma de los observadores suscritos a cambios de modo. */
type Listener = (modo: ModoBackend) => void

/** Conjunto de listeners activos registrados vía `suscribirModo`. */
const listeners = new Set<Listener>()

/**
 * Suscribe una función a los cambios de modo.
 * @param fn - Callback invocado con el nuevo `ModoBackend` cada vez que cambia.
 * @returns Función para desuscribirse (`() => void`): elimina `fn` del Set.
 * @example
 * const off = suscribirModo((m) => console.log('nuevo modo', m))
 * // ... luego
 * off()
 */
export function suscribirModo(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/**
 * Persiste el modo en `localStorage` y notifica a todos los listeners.
 * Envuelto en try/catch porque `localStorage` puede lanzar en contextos sin storage.
 * @param modo - Nuevo modo a difundir.
 */
function emitir(modo: ModoBackend) {
  try {
    localStorage.setItem(STORAGE_KEY, modo)
  } catch {
    /* best effort — ignorar si no hay storage */
  }
  // Notificar a cada suscriptor de forma síncrona
  listeners.forEach((fn) => fn(modo))
}

/**
 * Lee el modo desde el cache en memoria o, si no hay, desde `localStorage`.
 * No hace I/O de red; es síncrono y barato.
 * @returns `ModoBackend` cacheado/persistido o `null` si no hay valor previo.
 */
export function modoEnCache(): ModoBackend | null {
  // Prioridad 1: cache en memoria (más reciente que localStorage)
  if (modoCache) return modoCache
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    // Solo aceptar valores válidos; cualquier otra cosa se considera ausente
    return v === 'servidor' || v === 'supabase' ? v : null
  } catch {
    return null
  }
}

/**
 * Lee el heartbeat del servidor desde Supabase.
 * Consulta `heartbeat_servidor` donde `id = 1`, columna `updated_at`.
 * @returns `Date` del último heartbeat si existe y es un string ISO válido, `null` en caso contrario o error.
 * @remarks Usa `maybeSingle()` porque la fila puede no existir sin que sea error.
 */
export async function leerHeartbeat(): Promise<Date | null> {
  try {
    const { data } = await supabase
      .from('heartbeat_servidor')
      .select('updated_at')
      .eq('id', 1)
      .maybeSingle()
    // Validar que sea string antes de construir Date (evitar Invalid Date)
    if (data && typeof data.updated_at === 'string') {
      return new Date(data.updated_at)
    }
    return null
  } catch {
    // Error de red / permisos → asumir que no hay heartbeat
    return null
  }
}

/**
 * Detecta el modo actual consultando el heartbeat (con cache).
 * @param force - Si `true`, ignora el cache en memoria y fuerza lectura a Supabase.
 * @returns Promesa con `'servidor'` si el heartbeat es fresco, `'supabase'` en caso contrario.
 * @example
 * const modo = await detectarModo()
 * if (modo === 'servidor') { /* usar API Express *\/ }
 */
export async function detectarModo(force = false): Promise<ModoBackend> {
  const now = Date.now()
  // Atajo: si hay cache válido y no se fuerza, devolver sin I/O
  if (!force && modoCache && now - lastCheck < CACHE_MODO_MS) {
    return modoCache
  }
  // Lectura real a Supabase
  const hb = await leerHeartbeat()
  // "Fresca" = existe y su edad es menor al umbral
  const fresca = hb !== null && now - hb.getTime() < UMBRAL_HEARTBEAT_MS
  lastHeartbeat = hb
  lastCheck = now
  const nuevo: ModoBackend = fresca ? 'servidor' : 'supabase'
  // Solo emitir si hubo cambio, para no spamear listeners/storage
  if (modoCache !== nuevo) {
    modoCache = nuevo
    emitir(nuevo)
  } else {
    modoCache = nuevo
  }
  return nuevo
}

/**
 * Devuelve el último heartbeat leído por `detectarModo()` sin hacer I/O.
 * Útil para mostrar en UI "último contacto: hace X min".
 * @returns `Date` del último heartbeat o `null` si aún no se ha consultado.
 */
export function ultimoHeartbeat(): Date | null {
  return lastHeartbeat
}

/**
 * Invalida el cache en memoria de modo, forzando que el próximo `detectarModo()` consulte Supabase.
 * Llamar cuando un request al servidor falla por red (para re-evaluar si hay que pasar a `supabase`).
 */
export function invalidarModo() {
  modoCache = null
  lastCheck = 0
}
