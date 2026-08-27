/**
 * @file calles.worker.ts
 * @description
 * Web Worker dedicado a la geolocalización de calles a partir de
 * `CALLES_PUEBLA.geojson`. Se ejecuta fuera del hilo principal para no bloquear
 * la UI durante la indexación y los cálculos geométricos.
 *
 * Algoritmos:
 * 1. **Índice de grilla uniforme** (`buildIndex`): divide el plano en celdas de
 *    `CELL_DEG = 0.003°` (~330 m). Cada feature LineString se registra en todas
 *    las celdas que intersecta su bounding box. Esto permite consultas espaciales
 *    O(1) por celda en lugar de escanear todos los features.
 * 2. **Búsqueda de calle más cercana** (`geolocalizarCalle`):
 *    - Obtiene candidatas con `indicesCerca` (radio 0.006° ~660 m) desde el índice.
 *    - Para cada candidata calcula `pointToLineDistance` (Turf, en metros) y
 *      conserva la de menor distancia. Si `bestDist > MAX_DIST_M (30 m)` se
 *      considera que no hay calle y retorna vacío.
 * 3. **Detección de entrecalles**:
 *    - Proyecta el punto clickeado sobre la calle ganadora con `nearestPointOnLine`
 *      y corta un segmento de ±`SLICE_RADIUS_M (150 m)` usando `along` + `lineSlice`.
 *    - Para cada otra candidata (excluyendo misma calle por `stripType` y rutas
 *      de transporte por `EXCLUDE_NAMES`) prueba `lineIntersect` contra el
 *      segmento recortado. Las que intersectan son las transversales.
 *    - Deduplica por nombre y formatea `ENTRE X Y Y` / `ENTRE X`.
 *
 * Protocolo de mensajes (vía `self.onmessage`):
 * - `{type:'cargar', buffer?}` → decodifica o hace fetch del GeoJSON, llama
 *   `buildIndex`, responde `{type:'listo', ok, features}`.
 * - `{type:'detectar', lat, lon, id}` → ejecuta `geolocalizarCalle` y responde
 *   `{type:'result', id, calle, entreCalles, entreCallesDetected}`.
 */

import pointToLineDistance from '@turf/point-to-line-distance'
import nearestPointOnLine from '@turf/nearest-point-on-line'
import along from '@turf/along'
import lineSlice from '@turf/line-slice'
import lineIntersect from '@turf/line-intersect'
import { point, lineString } from '@turf/helpers'
import type { Feature, LineString, FeatureCollection } from 'geojson'

/** Resultado de geolocalización para un punto. */
interface CalleInfo {
  calle: string
  entreCalles: string
  entreCallesDetected: number
}

/** Tamaño de celda de la grilla uniforme en grados decimales (~0.003° ≈ 330 m). */
const CELL_DEG = 0.003
/** Índice invertido celda → lista de índices en `callesFeatures`. Clave "i:j". */
let callesIndex = new Map<string, number[]>()
/** Array plano de features cargadas; el índice guarda posiciones en este array. */
let callesFeatures: Feature<LineString>[] = []

/**
 * Construye el índice espacial de grilla a partir de un FeatureCollection.
 * Para cada LineString calcula su bbox y lo registra en todas las celdas que toca.
 * Complejidad O(N_features * celdas_por_feature). Se reconstruye por completo en cada carga.
 * @param data - FeatureCollection de LineStrings con `properties.name`.
 */
function buildIndex(data: FeatureCollection<LineString>) {
  callesFeatures = data.features
  callesIndex = new Map()
  for (let fi = 0; fi < callesFeatures.length; fi++) {
    const f = callesFeatures[fi]
    const g = f.geometry
    // Se ignoran features sin geometría válida o con menos de 2 vértices.
    if (!g || g.type !== 'LineString' || g.coordinates.length < 2) continue
    // Cálculo del bounding box del feature.
    let minLat = Infinity
    let maxLat = -Infinity
    let minLng = Infinity
    let maxLng = -Infinity
    for (const c of g.coordinates) {
      const [lng, lat] = c
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    }
    // Rango de celdas que cubre el bbox, inclusive.
    const i0 = Math.floor(minLat / CELL_DEG)
    const i1 = Math.floor(maxLat / CELL_DEG)
    const j0 = Math.floor(minLng / CELL_DEG)
    const j1 = Math.floor(maxLng / CELL_DEG)
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const key = `${i}:${j}`
        const arr = callesIndex.get(key)
        if (arr) arr.push(fi)
        else callesIndex.set(key, [fi])
      }
    }
  }
}

/**
 * Recupera los índices de features cercanas a un punto, consultando la grilla
 * en un radio de `radioDeg` grados alrededor de (lat, lon). Deduplica con Set.
 * @param lat - Latitud del punto de consulta.
 * @param lon - Longitud del punto de consulta.
 * @param radioDeg - Radio de búsqueda en grados.
 * @returns Array de índices en `callesFeatures` sin duplicados.
 */
function indicesCerca(lat: number, lon: number, radioDeg: number): number[] {
  const vistos = new Set<number>()
  const indices: number[] = []
  const i0 = Math.floor((lat - radioDeg) / CELL_DEG)
  const i1 = Math.floor((lat + radioDeg) / CELL_DEG)
  const j0 = Math.floor((lon - radioDeg) / CELL_DEG)
  const j1 = Math.floor((lon + radioDeg) / CELL_DEG)
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const arr = callesIndex.get(`${i}:${j}`)
      if (!arr) continue
      for (const idx of arr) {
        if (!vistos.has(idx)) {
          vistos.add(idx)
          indices.push(idx)
        }
      }
    }
  }
  return indices
}

/** Distancia máxima (m) para considerar que un punto está "sobre" una calle. */
const MAX_DIST_M = 30
/** Radio (m) del segmento recortado alrededor del punto proyectado para buscar cruces. */
const SLICE_RADIUS_M = 150

/** Regex para excluir rutas de transporte público (BRT, Metro, etc.) de las entrecalles. */
const EXCLUDE_NAMES = /^(RUTA\s|RUTAS\s|L\d+\s*BRT|BRT\s*L\d+|METRO|METROBÚS|MACROBÚS|TROLEBÚS|TREN\s+LIGERO)/i

/**
 * Determina si un nombre corresponde a una ruta de transporte y debe excluirse.
 * @param name - Nombre ya normalizado a mayúsculas.
 * @returns `true` si matchea `EXCLUDE_NAMES`.
 */
function isTransitRoute(name: string): boolean {
  return EXCLUDE_NAMES.test(name)
}

/**
 * Elimina prefijos de tipo vial ("Calle", "Avenida", etc.) para comparar nombres
 * de calles sin distinguir por categoría vial. Ej: "Avenida Juárez" → "JUÁREZ".
 * @param name - Nombre en mayúsculas.
 * @returns Nombre sin prefijo vial.
 */
function stripType(name: string): string {
  return name.replace(/^(Calle|Avenida|Privada|Calzada|Boulevard|Cerrada|Diagonal|Andador|Prolongación)\s+/i, '').trim()
}

/**
 * Geolocaliza la calle más cercana y sus entrecalles para un punto.
 * Pasos: (1) candidatas por grilla, (2) distancia mínima con Turf, (3) si <30 m,
 * (4) corta segmento ±150 m y busca intersecciones con otras calles.
 *
 * @param lat - Latitud del punto.
 * @param lon - Longitud del punto.
 * @returns `CalleInfo` con nombre y entrecalles; vacío si no hay match cercano.
 */
function geolocalizarCalle(lat: number, lon: number): CalleInfo {
  if (!callesFeatures.length) return { calle: '', entreCalles: '', entreCallesDetected: 0 }

  // Punto Turf en orden [lon, lat] (GeoJSON).
  const pt = point([lon, lat])

  // Candidatas en ~660 m a la redonda según la grilla.
  const candidatas = indicesCerca(lat, lon, 0.006)
    .map(i => callesFeatures[i])
    .filter((f): f is Feature<LineString> => !!f)

  let bestDist = Infinity
  let bestName = ''
  let bestFeature: Feature<LineString> | null = null

  for (const f of candidatas) {
    if (!f.geometry || f.geometry.type !== 'LineString') continue
    const coords = f.geometry.coordinates
    if (coords.length < 2) continue

    try {
      const line = lineString(coords)
      // Distancia geodésica punto-línea en metros (Turf usa Haversine internamente).
      const dist = pointToLineDistance(pt, line, { units: 'meters' })
      if (dist < bestDist) {
        bestDist = dist
        bestName = f.properties?.name ?? ''
        bestFeature = f
      }
    } catch {}
  }

  // Si la calle más cercana está a >30 m, se considera que el punto no está sobre vialidad.
  if (bestDist > MAX_DIST_M || !bestName) return { calle: '', entreCalles: '', entreCallesDetected: 0 }

  const calle = bestName.toUpperCase()

  if (!bestFeature) return { calle, entreCalles: '', entreCallesDetected: 0 }

  // Proyección del punto sobre la línea ganadora para recortar un segmento de análisis.
  const mainLine = lineString(bestFeature.geometry.coordinates)
  const nearest = nearestPointOnLine(mainLine, pt, { units: 'meters' })
  const clickProgress = nearest.properties.location // distancia acumulada en metros desde el inicio

  // Segmento de ±150 m alrededor de la proyección; fuera de él no se buscan cruces.
  const startDist = Math.max(0, clickProgress - SLICE_RADIUS_M)
  const endDist = clickProgress + SLICE_RADIUS_M
  const sliceStart = along(mainLine, startDist, { units: 'meters' })
  const sliceEnd = along(mainLine, endDist, { units: 'meters' })
  const slicedMain = lineSlice(sliceStart, sliceEnd, mainLine)

  const crossNames: string[] = []

  for (const f of candidatas) {
    if (!f.geometry || f.geometry.type !== 'LineString') continue
    const name = f.properties?.name
    if (!name) continue

    const normalized = name.toUpperCase()
    // Evita contar la misma calle (sin distinguir "Calle" vs "Avenida") como entrecalle.
    if (stripType(normalized) === stripType(calle)) continue
    if (isTransitRoute(normalized)) continue

    const coords = f.geometry.coordinates
    if (coords.length < 2) continue

    try {
      const otherLine = lineString(coords)
      // Intersección geométrica exacta entre el segmento recortado y la otra calle.
      const inter = lineIntersect(slicedMain, otherLine)
      if (inter.features.length > 0) {
        crossNames.push(normalized)
      }
    } catch {}
  }

  // Deduplica nombres (una calle puede aparecer en varios tramos LineString).
  const unique = [...new Set(crossNames)]

  let entreCalles = ''
  if (unique.length >= 2) {
    entreCalles = `ENTRE ${unique[0]} Y ${unique[1]}`
  } else if (unique.length === 1) {
    entreCalles = `ENTRE ${unique[0]}`
  }

  return {
    calle,
    entreCalles,
    entreCallesDetected: unique.length,
  }
}

/** Tipado mínimo del scope del Worker (self) para postMessage/onmessage. */
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null
  postMessage(msg: unknown): void
}

/**
 * Dispatcher de mensajes del Worker.
 * - `cargar`: si trae `buffer` lo decodifica (TextDecoder) y parsea; si no, hace fetch.
 *   Siempre responde `listo` con ok/error.
 * - `detectar`: ejecuta `geolocalizarCalle` síncronamente y responde `result` con spread de CalleInfo.
 */
ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data
  if (!msg || typeof msg !== 'object') return
  switch (msg.type) {
    case 'cargar': {
      const id = msg.id
      const responder = (ok: boolean, error?: string) => {
        ctx.postMessage({
          type: 'listo',
          id,
          ok,
          features: ok ? callesFeatures.length : undefined,
          error,
        })
      }
      if (msg.buffer) {
        try {
          // Buffer transferido desde el hilo principal: decodificación síncrona sin fetch.
          const text = new TextDecoder().decode(msg.buffer)
          buildIndex(JSON.parse(text) as FeatureCollection<LineString>)
          responder(true)
        } catch (err) {
          responder(false, err instanceof Error ? err.message : String(err))
        }
      } else {
        // Ruta de carga autónoma: el worker descarga el GeoJSON por sí mismo.
        ;(async () => {
          try {
            const r = await fetch('/data/CALLES_PUEBLA.geojson', { headers: { 'ngrok-skip-browser-warning': 'true' } })
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            const data = (await r.json()) as FeatureCollection<LineString>
            buildIndex(data)
            responder(true)
          } catch (err) {
            responder(false, err instanceof Error ? err.message : String(err))
          }
        })()
      }
      break
    }
    case 'detectar': {
      const info = geolocalizarCalle(Number(msg.lat), Number(msg.lon))
      ctx.postMessage({ type: 'result', id: msg.id, ...info })
      break
    }
  }
}
