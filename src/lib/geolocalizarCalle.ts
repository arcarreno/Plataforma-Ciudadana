import pointToLineDistance from '@turf/point-to-line-distance'
import nearestPointOnLine from '@turf/nearest-point-on-line'
import along from '@turf/along'
import lineSlice from '@turf/line-slice'
import lineIntersect from '@turf/line-intersect'
import { point, lineString } from '@turf/helpers'
import type { Feature, LineString, FeatureCollection } from 'geojson'

export interface CalleInfo {
  calle: string
  entreCalles: string
  entreCallesDetected: number
}

let callesCache: FeatureCollection<LineString> | null = null

const CELL_DEG = 0.003
let callesIndex = new Map<string, number[]>()
let callesFeatures: Feature<LineString>[] = []
let callesPromesa: Promise<void> | null = null

export function tieneCalles(): boolean {
  return !!callesCache && callesCache.features.length > 0
}

export function cargarCalles(): Promise<void> {
  if (callesPromesa) return callesPromesa
  callesPromesa = (async () => {
    try {
      const r = await fetch('/data/CALLES_PUEBLA.geojson')
      if (!r.ok) return
      setCallesData((await r.json()) as FeatureCollection<LineString>)
    } catch {
      // sin calles: geolocalizarCalle devuelve vacio
    }
  })()
  return callesPromesa
}

export function setCallesData(data: FeatureCollection<LineString>) {
  callesCache = data
  callesFeatures = data.features
  callesIndex = new Map()
  for (let i = 0; i < callesFeatures.length; i++) {
    const f = callesFeatures[i]
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
        if (arr) arr.push(i)
        else callesIndex.set(key, [i])
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

export async function geolocalizarCalle(lat: number, lon: number): Promise<CalleInfo> {
  const data = callesCache
  if (!data || !data.features.length) return { calle: '', entreCalles: '', entreCallesDetected: 0 }

  const pt = point([lon, lat])

  const candidatas = indicesCerca(lat, lon, 0.006).map(i => callesFeatures[i]).filter(f => !!f)

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
