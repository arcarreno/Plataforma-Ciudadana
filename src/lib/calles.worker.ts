import pointToLineDistance from '@turf/point-to-line-distance'
import nearestPointOnLine from '@turf/nearest-point-on-line'
import along from '@turf/along'
import lineSlice from '@turf/line-slice'
import lineIntersect from '@turf/line-intersect'
import { point, lineString } from '@turf/helpers'
import type { Feature, LineString, FeatureCollection } from 'geojson'

interface CalleInfo {
  calle: string
  entreCalles: string
  entreCallesDetected: number
}

const CELL_DEG = 0.003
let callesIndex = new Map<string, number[]>()
let callesFeatures: Feature<LineString>[] = []

function buildIndex(data: FeatureCollection<LineString>) {
  callesFeatures = data.features
  callesIndex = new Map()
  for (let fi = 0; fi < callesFeatures.length; fi++) {
    const f = callesFeatures[fi]
    const g = f.geometry
    if (!g || g.type !== 'LineString' || g.coordinates.length < 2) continue
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

const MAX_DIST_M = 30
const SLICE_RADIUS_M = 150

const EXCLUDE_NAMES = /^(RUTA\s|RUTAS\s|L\d+\s*BRT|BRT\s*L\d+|METRO|METROBÚS|MACROBÚS|TROLEBÚS|TREN\s+LIGERO)/i

function isTransitRoute(name: string): boolean {
  return EXCLUDE_NAMES.test(name)
}

function stripType(name: string): string {
  return name.replace(/^(Calle|Avenida|Privada|Calzada|Boulevard|Cerrada|Diagonal|Andador|Prolongación)\s+/i, '').trim()
}

function geolocalizarCalle(lat: number, lon: number): CalleInfo {
  if (!callesFeatures.length) return { calle: '', entreCalles: '', entreCallesDetected: 0 }

  const pt = point([lon, lat])

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
      const dist = pointToLineDistance(pt, line, { units: 'meters' })
      if (dist < bestDist) {
        bestDist = dist
        bestName = f.properties?.name ?? ''
        bestFeature = f
      }
    } catch {}
  }

  if (bestDist > MAX_DIST_M || !bestName) return { calle: '', entreCalles: '', entreCallesDetected: 0 }

  const calle = bestName.toUpperCase()

  if (!bestFeature) return { calle, entreCalles: '', entreCallesDetected: 0 }

  const mainLine = lineString(bestFeature.geometry.coordinates)
  const nearest = nearestPointOnLine(mainLine, pt, { units: 'meters' })
  const clickProgress = nearest.properties.location

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
    if (stripType(normalized) === stripType(calle)) continue
    if (isTransitRoute(normalized)) continue

    const coords = f.geometry.coordinates
    if (coords.length < 2) continue

    try {
      const otherLine = lineString(coords)
      const inter = lineIntersect(slicedMain, otherLine)
      if (inter.features.length > 0) {
        crossNames.push(normalized)
      }
    } catch {}
  }

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

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null
  postMessage(msg: unknown): void
}

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data
  if (!msg || typeof msg !== 'object') return
  switch (msg.type) {
    case 'cargar': {
      try {
        const text = new TextDecoder().decode(msg.buffer)
        buildIndex(JSON.parse(text) as FeatureCollection<LineString>)
        ctx.postMessage({ type: 'listo', id: msg.id, ok: true, features: callesFeatures.length })
      } catch (err) {
        ctx.postMessage({ type: 'listo', id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) })
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
