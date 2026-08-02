export interface CalleInfo {
  calle: string
  entreCalles: string
  entreCallesDetected: number
}

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

let worker: Worker | null = null
let callesListas = false
let cargando: Promise<boolean> | null = null
let msgId = 0
const pendientes = new Map<number, (value: CalleInfo) => void>()
const loadResolvers: ((ok: boolean) => void)[] = []

function getWorker(): Worker {
  if (worker) return worker
  const w = new Worker(new URL('./calles.worker.ts', import.meta.url), { type: 'module' })
  w.onmessage = (e: MessageEvent<WorkerMsg>) => {
    const msg = e.data
    if (msg.type === 'listo') {
      callesListas = !!msg.ok
      const resolvers = loadResolvers.splice(0)
      for (const r of resolvers) r(!!msg.ok)
      if (!msg.ok) console.error('[calles] el worker no pudo cargar las calles:', msg.error)
    } else if (msg.type === 'result' && msg.id !== undefined) {
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
    callesListas = false
    const resolvers = loadResolvers.splice(0)
    for (const r of resolvers) r(false)
    console.error('[calles] error del worker:', ev.message)
  }
  worker = w
  return w
}

export function tieneCalles(): boolean {
  return callesListas
}

export async function cargarCalles(buffer?: ArrayBuffer): Promise<boolean> {
  if (callesListas) return true
  if (cargando) return cargando

  cargando = (async () => {
    try {
      const w = getWorker()
      const id = ++msgId
      const promesa = new Promise<boolean>((resolve) => {
        loadResolvers.push(resolve)
      })
      if (buffer) {
        w.postMessage({ type: 'cargar', id, buffer }, [buffer])
      } else {
        const r = await fetch('/data/CALLES_PUEBLA.geojson')
        if (!r.ok) return false
        const buf = await r.arrayBuffer()
        w.postMessage({ type: 'cargar', id, buffer: buf }, [buf])
      }
      return await promesa
    } finally {
      cargando = null
    }
  })()

  return cargando
}

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
