import { lineString, point } from '@turf/helpers'
import distance from '@turf/distance'
import nearestPointOnLine from '@turf/nearest-point-on-line'
import lineIntersect from '@turf/line-intersect'

interface Edge {
  a: [number, number]
  b: [number, number]
  angle: number
}

function calcAngle(a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  return Math.atan2(dy, dx) * (180 / Math.PI)
}

function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b)
  if (d > 180) d = 360 - d
  return d
}

function perpendicularDistance(
  lineA: [number, number],
  lineB: [number, number],
  pt: [number, number]
): number {
  const [x1, y1] = lineA
  const [x2, y2] = lineB
  const [px, py] = pt
  const num = Math.abs((x2 - x1) * (y1 - py) - (x1 - px) * (y2 - y1))
  const den = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  return den === 0 ? 0 : num / den
}

export function estimarAnchoCalle(
  lat_ini: number, lng_ini: number,
  lat_fin: number, lng_fin: number,
  stv: GeoJSON.FeatureCollection
): number {
  const tramo = lineString([[lng_ini, lat_ini], [lng_fin, lat_fin]])

  const BUFFER_DEG = 0.0005
  const [lx1, ly1] = [lng_ini, lat_ini]
  const [lx2, ly2] = [lng_fin, lat_fin]
  const minX = Math.min(lx1, lx2) - BUFFER_DEG
  const maxX = Math.max(lx1, lx2) + BUFFER_DEG
  const minY = Math.min(ly1, ly2) - BUFFER_DEG
  const maxY = Math.max(ly1, ly2) + BUFFER_DEG

  const edges: Edge[] = []

  for (const f of stv.features) {
    if (!f.geometry) continue
    let coords: [number, number][]
    if (f.geometry.type === 'LineString') {
      coords = f.geometry.coordinates as [number, number][]
    } else if (f.geometry.type === 'MultiLineString') {
      coords = f.geometry.coordinates.flat() as [number, number][]
    } else {
      continue
    }

    let fMinX = Infinity
    let fMaxX = -Infinity
    let fMinY = Infinity
    let fMaxY = -Infinity
    for (const c of coords) {
      if (c[0] < fMinX) fMinX = c[0]
      if (c[0] > fMaxX) fMaxX = c[0]
      if (c[1] < fMinY) fMinY = c[1]
      if (c[1] > fMaxY) fMaxY = c[1]
    }
    if (fMaxX < minX || fMinX > maxX || fMaxY < minY || fMinY > maxY) continue

    for (let i = 0; i < coords.length - 1; i++) {
      edges.push({
        a: coords[i],
        b: coords[i + 1],
        angle: calcAngle(coords[i], coords[i + 1]),
      })
    }
  }

  const nearby: Edge[] = []

  for (const e of edges) {
    const ex = (e.a[0] + e.b[0]) / 2
    const ey = (e.a[1] + e.b[1]) / 2
    const minX = Math.min(lx1, lx2) - BUFFER_DEG
    const maxX = Math.max(lx1, lx2) + BUFFER_DEG
    const minY = Math.min(ly1, ly2) - BUFFER_DEG
    const maxY = Math.max(ly1, ly2) + BUFFER_DEG
    if (ex >= minX && ex <= maxX && ey >= minY && ey <= maxY) {
      try {
        const inter = lineIntersect(tramo, lineString([e.a, e.b]))
        if (inter.features.length > 0) {
          nearby.push(e)
        }
      } catch (_e) { /* skip */ }
    }
  }

  if (nearby.length < 2) return 7

  const LAT_COS = Math.cos(lat_ini * Math.PI / 180)
  const DEG_TO_M = 111320 * LAT_COS

  let widths: number[] = []

  for (let i = 0; i < nearby.length; i++) {
    for (let j = i + 1; j < nearby.length; j++) {
      const diff = angleDiff(nearby[i].angle, nearby[j].angle)
      if (diff > 150 && diff <= 210) {
        const midJ: [number, number] = [
          (nearby[j].a[0] + nearby[j].b[0]) / 2,
          (nearby[j].a[1] + nearby[j].b[1]) / 2,
        ]
        const wDeg = perpendicularDistance(nearby[i].a, nearby[i].b, midJ)
        const wMeters = wDeg * DEG_TO_M
        if (wMeters > 3 && wMeters < 50) {
          widths.push(wMeters)
        }
      }
    }
  }

  if (widths.length === 0) {
    const mid: [number, number] = [
      (lng_ini + lng_fin) / 2,
      (lat_ini + lat_fin) / 2,
    ]
    // nearestPointOnLine returns dist in km (turf default)
    let minDistKm = Infinity
    for (const e of nearby) {
      const nearest = nearestPointOnLine(lineString([e.a, e.b]), point(mid))
      if (nearest.properties.dist !== undefined) {
        minDistKm = Math.min(minDistKm, nearest.properties.dist)
      }
    }
    if (minDistKm < Infinity && minDistKm <= 0.025) {
      // midpoint-to-edge (km→m) × 2 = full width estimate
      const fallbackMeters = minDistKm * 2000
      return Math.max(5, Math.round(fallbackMeters * 10) / 10)
    }
    return 7
  }

  const avg = widths.reduce((s, w) => s + w, 0) / widths.length
  return Math.round(avg * 10) / 10
}

export function haversineDistancia(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const d = distance(point([lng1, lat1]), point([lng2, lat2]), { units: 'meters' })
  return Math.round(d * 10) / 10
}
