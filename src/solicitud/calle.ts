/**
 * @file calle.ts
 * @description
 * Utilidades geométricas para el tramo de obra: estimación de ancho de calle
 * y cálculo de distancia haversine. Usado por `detectarTramo` para llenar
 * `ancho_calle_m` y `distancia_m`.
 *
 * Algoritmo `estimarAnchoCalle`:
 * 1. Construye un `tramo` LineString con los extremos del tramo y un bbox
 *    expandido por `BUFFER_DEG (0.0005° ~55 m)` para filtrar rápido.
 * 2. Recolecta `edges` (segmentos) de la capa STV (LineString/MultiLineString)
 *    cuyo bbox intersecta el del tramo. Cada edge guarda su ángulo con `calcAngle`.
 * 3. Filtra `nearby`: edges cuyo punto medio cae dentro del bbox y que además
 *    intersectan geométricamente al `tramo` (`lineIntersect`). Son las banquetas/
 *    paramentos que cruzan perpendicularmente el tramo.
 * 4. Si hay <2 edges `nearby`, retorna ancho por defecto 7 m.
 * 5. Intenta medir anchos por pares de edges casi-paralelos (diff ángulo 150-210°):
 *    calcula distancia perpendicular en grados y convierte a metros con
 *    `DEG_TO_M = 111320 * cos(lat)`. Solo conserva 3-50 m.
 * 6. Fallback: si no hay pares paralelos, toma la distancia mínima del punto medio
 *    del tramo a cualquier edge (`nearestPointOnLine`, en km) y estima `*2000`
 *    (km→m ×2 = ancho completo). Si también falla, retorna 7 m.
 */

import { lineString, point } from '@turf/helpers'
import distance from '@turf/distance'
import nearestPointOnLine from '@turf/nearest-point-on-line'
import lineIntersect from '@turf/line-intersect'

/** Segmento elemental de la capa STV con su ángulo en grados. */
interface Edge {
  a: [number, number]
  b: [number, number]
  angle: number
}

/**
 * Calcula el azimut de un segmento en grados [-180,180].
 * @param a - Punto inicial [lng, lat].
 * @param b - Punto final [lng, lat].
 * @returns Ángulo en grados (atan2(dy,dx)*180/π).
 */
function calcAngle(a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  return Math.atan2(dy, dx) * (180 / Math.PI)
}

/**
 * Diferencia angular mínima entre dos ángulos (0-180°), normalizada a vuelta completa.
 * @param a - Ángulo A en grados.
 * @param b - Ángulo B en grados.
 * @returns Diferencia absoluta mínima.
 */
function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b)
  if (d > 180) d = 360 - d
  return d
}

/**
 * Distancia perpendicular de un punto a una recta infinita definida por lineA-lineB.
 * Fórmula: | (x2-x1)(y1-py) - (x1-px)(y2-y1) | / sqrt((x2-x1)²+(y2-y1)²).
 * @param lineA - Primer punto de la recta.
 * @param lineB - Segundo punto de la recta.
 * @param pt - Punto a medir.
 * @returns Distancia en las mismas unidades que las coordenadas (grados).
 */
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

/**
 * Estima el ancho de calle en metros analizando la capa STV (ejes/paramentos).
 * Ver descripción del archivo para el algoritmo completo por pasos.
 *
 * @param lat_ini - Latitud del punto inicial del tramo.
 * @param lng_ini - Longitud del punto inicial del tramo.
 * @param lat_fin - Latitud del punto final del tramo.
 * @param lng_fin - Longitud del punto final del tramo.
 * @param stv - FeatureCollection de la capa STV (se esperan LineString/MultiLineString).
 * @returns Ancho estimado en metros, redondeado a 1 decimal; 7 por defecto si no hay datos.
 */
export function estimarAnchoCalle(
  lat_ini: number, lng_ini: number,
  lat_fin: number, lng_fin: number,
  stv: GeoJSON.FeatureCollection
): number {
  // Línea del tramo para pruebas de intersección con Turf.
  const tramo = lineString([[lng_ini, lat_ini], [lng_fin, lat_fin]])

  // Bbox expandido para pre-filtrar features STV sin costo geométrico alto.
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

    // Filtro rápido por bbox del feature completo antes de descomponer en edges.
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
    // Punto medio del edge para test de contención rápido.
    const ex = (e.a[0] + e.b[0]) / 2
    const ey = (e.a[1] + e.b[1]) / 2
    const minX = Math.min(lx1, lx2) - BUFFER_DEG
    const maxX = Math.max(lx1, lx2) + BUFFER_DEG
    const minY = Math.min(ly1, ly2) - BUFFER_DEG
    const maxY = Math.max(ly1, ly2) + BUFFER_DEG
    if (ex >= minX && ex <= maxX && ey >= minY && ey <= maxY) {
      try {
        // Solo se conservan edges que realmente cruzan el tramo (no solo cercanos en bbox).
        const inter = lineIntersect(tramo, lineString([e.a, e.b]))
        if (inter.features.length > 0) {
          nearby.push(e)
        }
      } catch (_e) { /* skip — geometrías degeneradas */ }
    }
  }

  // Sin suficientes intersecciones no hay forma fiable de medir ancho.
  if (nearby.length < 2) return 7

  // Factor de conversión grados→metros ajustado por latitud (aprox. 111.32 km por grado * cos(lat)).
  const LAT_COS = Math.cos(lat_ini * Math.PI / 180)
  const DEG_TO_M = 111320 * LAT_COS

  let widths: number[] = []

  for (let i = 0; i < nearby.length; i++) {
    for (let j = i + 1; j < nearby.length; j++) {
      const diff = angleDiff(nearby[i].angle, nearby[j].angle)
      // Par de bordes opuestos/paralelos: ángulos casi opuestos (150-210° de diferencia).
      if (diff > 150 && diff <= 210) {
        const midJ: [number, number] = [
          (nearby[j].a[0] + nearby[j].b[0]) / 2,
          (nearby[j].a[1] + nearby[j].b[1]) / 2,
        ]
        // Distancia perpendicular del punto medio de j a la recta de i.
        const wDeg = perpendicularDistance(nearby[i].a, nearby[i].b, midJ)
        const wMeters = wDeg * DEG_TO_M
        // Se descartan anchos absurdos (<3 m banqueta, >50 m autopista).
        if (wMeters > 3 && wMeters < 50) {
          widths.push(wMeters)
        }
      }
    }
  }

  if (widths.length === 0) {
    // Fallback: distancia del centro del tramo al edge más cercano ×2.
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

  // Promedio de todos los anchos válidos medidos entre pares paralelos.
  const avg = widths.reduce((s, w) => s + w, 0) / widths.length
  return Math.round(avg * 10) / 10
}

/**
 * Distancia haversine entre dos puntos geográficos usando Turf.
 * @param lat1 - Latitud origen.
 * @param lng1 - Longitud origen.
 * @param lat2 - Latitud destino.
 * @param lng2 - Longitud destino.
 * @returns Distancia en metros redondeada a 1 decimal.
 */
export function haversineDistancia(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const d = distance(point([lng1, lat1]), point([lng2, lat2]), { units: 'meters' })
  return Math.round(d * 10) / 10
}
