/**
 * @file geolocalizarCalle.ts
 * @description
 * Fachada del hilo principal para geolocalización de calles.
 * Delega el trabajo pesado (índice espacial + cálculos Turf) a `calles.worker.ts`
 * vía Web Worker, manteniendo la UI sin bloqueos.
 *
 * Algoritmo / flujo:
 * 1. `cargarCalles()` — si aún no está listo, instancia el Worker bajo demanda
 *    (`getWorker`/`nuevoWorker`), le envía un mensaje `cargar` (con o sin buffer
 *    pre-descargado) y espera el `listo` con timeout de 60 s. Usa `loadResolvers`
 *    y `cargando` (singleton Promise) para coalescer cargas concurrentes.
 * 2. `geolocalizarCalle(lat, lon)` — asegura que las calles estén cargadas,
 *    envía `detectar` al worker con un `id` incremental y registra la callback en
 *    `pendientes` (Map id→resolve). El worker responde con `result` y se resuelve.
 * 3. `tieneCalles()` — getter síncrono del flag `callesListas`.
 *
 * Por qué Worker: el GeoJSON de calles es grande; indexarlo y hacer
 * `pointToLineDistance`/`lineIntersect` en el hilo principal congelaría el mapa.
 */

export interface CalleInfo {
  /** Nombre de la calle principal más cercana (en mayúsculas, vacío si >30 m). */
  calle: string
  /** Texto formateado "ENTRE X Y Y" / "ENTRE X" / "" para mostrar en la ficha. */
  entreCalles: string
  /** Cantidad de calles transversales detectadas (0, 1 o 2+). */
  entreCallesDetected: number
}

/** Mensajes que intercambia el hilo principal con el Worker de calles. */
interface WorkerMsg {
  type: string
  id?: number
  ok?: boolean
  features?: number
  error?: string
  calle?: string
  entreCalles?: string
  entreCallesDetected?: number
}

/** Tiempo máximo de espera para que el worker indexe las calles antes de darlo por fallido. */
const TIMEOUT_CARGA_MS = 60_000

/** Instancia única del Worker; se crea lazy y se recrea si es terminado por timeout. */
let worker: Worker | null = null
/** Flag que indica si el índice de calles ya está construido y listo para consultas. */
let callesListas = false
/** Promise singleton que coalesce llamadas concurrentes a `cargarCalles()`. */
let cargando: Promise<boolean> | null = null
/** Contador monotónico para correlacionar mensajes request/response con el worker. */
let msgId = 0
/** Callbacks pendientes de `geolocalizarCalle` indexadas por `msgId`. */
const pendientes = new Map<number, (value: CalleInfo) => void>()
/** Resolvers en espera del evento `listo` del worker tras un `cargar`. */
const loadResolvers: ((ok: boolean) => void)[] = []

/**
 * Crea un nuevo Worker de calles y cablea sus handlers.
 * - `onmessage` distingue `listo` (carga finalizada) de `result` (geocodificación).
 * - `onerror` resetea el flag y rechaza a todos los `loadResolvers` con `false`.
 * @returns Worker recién instanciado listo para recibir mensajes `cargar`/`detectar`.
 */
function nuevoWorker(): Worker {
  // Se usa `new URL(..., import.meta.url)` para que Vite resuelva el worker como módulo ESM.
  const w = new Worker(new URL('./calles.worker.ts', import.meta.url), { type: 'module' })
  w.onmessage = (e: MessageEvent<WorkerMsg>) => {
    const msg = e.data
    if (msg.type === 'listo') {
      // El worker terminó de construir el índice; se notifica a todos los que esperan `cargarCalles`.
      callesListas = !!msg.ok
      const resolvers = loadResolvers.splice(0)
      for (const r of resolvers) r(!!msg.ok)
      if (!msg.ok) console.error('[calles] el worker no pudo cargar las calles:', msg.error)
    } else if (msg.type === 'result' && msg.id !== undefined) {
      // Respuesta a un `geolocalizarCalle` puntual: se resuelve la Promise correspondiente.
      const resolve = pendientes.get(msg.id)
      if (resolve) {
        pendientes.delete(msg.id)
        resolve({
          calle: msg.calle ?? '',
          entreCalles: msg.entreCalles ?? '',
          entreCallesDetected: msg.entreCallesDetected ?? 0,
        })
      }
    }
  }
  w.onerror = (ev) => {
    // Error no recuperable del worker: invalida el flag y libera referencias.
    callesListas = false
    if (worker === w) worker = null
    const resolvers = loadResolvers.splice(0)
    for (const r of resolvers) r(false)
    console.error('[calles] error del worker:', ev.message)
  }
  return w
}

/**
 * Obtiene (o crea) la instancia singleton del Worker.
 * @returns Worker activo.
 */
function getWorker(): Worker {
  if (!worker) worker = nuevoWorker()
  return worker
}

/**
 * Indica si el índice de calles ya está listo para consultas.
 * Útil para decidir si mostrar placeholders o disparar precarga.
 * @returns `true` si `callesListas` es verdadero.
 */
export function tieneCalles(): boolean {
  return callesListas
}

/**
 * Carga e indexa el GeoJSON de calles en el Worker.
 * - Es idempotente: si ya está listo retorna `true` inmediato.
 * - Coalesce llamadas concurrentes mediante `cargando`.
 * - Acepta un `ArrayBuffer` pre-descargado (vía `precargarCapasConProgreso`) para
 *   evitar un segundo fetch dentro del worker; si no se provee, el worker hace
 *   `fetch('/data/CALLES_PUEBLA.geojson')` por su cuenta.
 * - Hace `Promise.race` contra un timeout de 60 s; si expira y el worker sigue
 *   sin responder, lo termina para no dejar hilos zombis.
 *
 * @param buffer - Bytes del GeoJSON ya descargados (opcional, transferido como Transferable).
 * @returns `true` si el índice quedó listo, `false` si falló o expiró el timeout.
 */
export async function cargarCalles(buffer?: ArrayBuffer): Promise<boolean> {
  if (callesListas) return true
  if (cargando) return cargando

  cargando = (async () => {
    const w = getWorker()
    const id = ++msgId
    // Promise que se resolverá cuando llegue el mensaje `listo` del worker.
    const promesa = new Promise<boolean>((resolve) => {
      loadResolvers.push(resolve)
    })
    if (buffer) {
      // Se transfiere el buffer (zero-copy) al worker para decodificar y parsear allí.
      w.postMessage({ type: 'cargar', id, buffer }, [buffer])
    } else {
      w.postMessage({ type: 'cargar', id })
    }
    // Carrera entre la respuesta real y el timeout de seguridad.
    const resultado = await Promise.race([
      promesa,
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), TIMEOUT_CARGA_MS)),
    ])
    if (!resultado && !callesListas && worker === w) {
      // Timeout sin éxito: se aborta el worker para liberar memoria/CPU.
      try {
        w.terminate()
      } catch {
        /* noop — terminate puede fallar si ya está detenido */
      }
      worker = null
    }
    return resultado
  })()

  try {
    return await cargando
  } finally {
    // Se libera el singleton para que un reintento futuro pueda crear una nueva promesa.
    cargando = null
  }
}

/**
 * Geolocaliza la calle más cercana y sus entrecalles para un punto (lat/lon).
 * Si el índice aún no está listo, intenta cargarlo de forma perezosa.
 *
 * @param lat - Latitud WGS84 del punto clickeado.
 * @param lon - Longitud WGS84 del punto clickeado.
 * @returns `CalleInfo` con nombre y entrecalles; vacío si no hay calle <30 m o no cargó.
 */
export async function geolocalizarCalle(lat: number, lon: number): Promise<CalleInfo> {
  if (!callesListas) {
    await cargarCalles()
    if (!callesListas) return { calle: '', entreCalles: '', entreCallesDetected: 0 }
  }
  const w = getWorker()
  const id = ++msgId
  return new Promise<CalleInfo>((resolve) => {
    pendientes.set(id, resolve)
    w.postMessage({ type: 'detectar', id, lat, lon })
  })
}
