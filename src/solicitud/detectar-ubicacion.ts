import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import booleanIntersects from '@turf/boolean-intersects'
import lineIntersect from '@turf/line-intersect'
import { point, lineString } from '@turf/helpers'
import distance from '@turf/distance'
import nearestPointOnLine from '@turf/nearest-point-on-line'
import buffer from '@turf/buffer'
import { matchJunta, cleanColoniaName } from '../core/geo'
import { estimarAnchoCalle, haversineDistancia } from './calle'

export interface CapasGeoJSON {
  colonias: GeoJSON.FeatureCollection
  juntas: GeoJSON.FeatureCollection
  zonasZap: GeoJSON.FeatureCollection
  escuelas: GeoJSON.FeatureCollection
  iglesias: GeoJSON.FeatureCollection
  stv: GeoJSON.FeatureCollection
  coberturaAgua: GeoJSON.FeatureCollection
}

export interface DeteccionPunto {
  colonia: string
  junta_auxiliar: string
  zona_zap: boolean
  cobertura_agua: boolean
  escuelas_cercanas: string[]
  iglesias_cercanas: string[]
  transportes_cercanos: string[]
  fuera_alcance: boolean
  coordenadas: { lat: number; lng: number }
}

export interface DeteccionTramo {
  colonias: string[]
  juntas_auxiliares: string[]
  zonas_zap: string[]
  cobertura_agua: boolean
  escuelas_cercanas: string[]
  iglesias_cercanas: string[]
  transportes_cercanos: string[]
  distancia_m: number
  ancho_calle_m: number
  coordenadas: { lat_ini: number; lng_ini: number; lat_fin: number; lng_fin: number }
}

const RADIO_CERCANIA_KM = 0.1

function getProps(f: GeoJSON.Feature): { name: string } {
  return f.properties as { name: string } || { name: '' }
}

function detectarPIP(
  pt: GeoJSON.Feature<GeoJSON.Point>,
  capa: GeoJSON.FeatureCollection
): string {
  for (const f of capa.features) {
    if (!f.geometry) continue
    const gt = f.geometry.type
    if (gt !== 'Polygon' && gt !== 'MultiPolygon' && gt !== 'GeometryCollection') continue
    try {
      if (gt === 'GeometryCollection') {
        const gc = f.geometry as GeoJSON.GeometryCollection
        for (const g of gc.geometries) {
          if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
            if (booleanPointInPolygon(pt, { type: 'Feature', geometry: g, properties: {} } as any)) {
              return getProps(f).name || ''
            }
          }
        }
      } else {
        if (!f.geometry.coordinates) continue
        if (booleanPointInPolygon(pt, f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)) {
          return getProps(f).name || ''
        }
      }
    } catch (_e) { /* skip */ }
  }
  return ''
}

function detectarCercanos(
  pt: GeoJSON.Feature<GeoJSON.Point>,
  capa: GeoJSON.FeatureCollection
): string[] {
  const results: string[] = []
  for (const f of capa.features) {
    if (!f.geometry) continue
    const gt = f.geometry.type
    if (gt !== 'Point' && gt !== 'LineString' && gt !== 'MultiLineString') continue
    if (!f.geometry.coordinates) continue
    try {
      let d: number | null = null
      if (gt === 'Point') {
        d = distance(pt, f as GeoJSON.Feature<GeoJSON.Point>, { units: 'kilometers' })
      } else {
        const nearest = nearestPointOnLine(
          f as GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>,
          pt
        )
        d = nearest.properties.dist != null ? nearest.properties.dist : null
      }
      if (d !== null && d <= RADIO_CERCANIA_KM) {
        results.push(getProps(f).name || '(sin nombre)')
      }
    } catch (_e) { /* skip */ }
  }
  return results
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

async function fetchJSON(url: string) {
  try {
    const r = await fetch(url)
    if (!r.ok) return EMPTY_FC
    return await r.json()
  } catch (_e) {
    return EMPTY_FC
  }
}

export function cargarCapas(): Promise<CapasGeoJSON> {
  return Promise.all([
    fetchJSON('/data/COLONIAS PUEBLA.geojson'),
    fetchJSON('/data/JUNTAS AUXILIARES.geojson'),
    fetchJSON('/data/zonas zap2024.geojson'),
    fetchJSON('/data/Escuelas.geojson'),
    fetchJSON('/data/Iglesias.geojson'),
    fetchJSON('/data/STV.geojson'),
    fetchJSON('/data/COBERTURA_AGUAS DE PUEBLA.geojson'),
  ]).then(([colonias, juntas, zonasZap, escuelas, iglesias, stv, coberturaAgua]) => ({
    colonias, juntas, zonasZap, escuelas, iglesias, stv, coberturaAgua,
  }))
}

export function detectarPunto(lat: number, lng: number, capas: CapasGeoJSON): DeteccionPunto {
  const pt = point([lng, lat])

  const rawColonia = detectarPIP(pt, capas.colonias)
  const rawJunta = detectarPIP(pt, capas.juntas)
  const tieneZonaZap = detectarPIP(pt, capas.zonasZap) !== ''
  const tieneCoberturaAgua = detectarPIP(pt, capas.coberturaAgua) !== ''

  let colonia = rawColonia ? cleanColoniaName(rawColonia) : ''
  let junta_auxiliar = rawJunta ? matchJunta(rawJunta) : ''

  let fuera_alcance = false

  if (!colonia && !junta_auxiliar) {
    fuera_alcance = true
  } else if (colonia && !junta_auxiliar) {
    junta_auxiliar = 'Zona Metropolitana'
  } else if (!colonia && junta_auxiliar) {
    colonia = 'Desconocida'
  }

  const escuelas_cercanas = detectarCercanos(pt, capas.escuelas)
  const iglesias_cercanas = detectarCercanos(pt, capas.iglesias)
  const transportes_cercanos = detectarCercanos(pt, capas.stv)

  return {
    colonia,
    junta_auxiliar,
    zona_zap: tieneZonaZap,
    cobertura_agua: tieneCoberturaAgua,
    escuelas_cercanas,
    iglesias_cercanas,
    transportes_cercanos,
    fuera_alcance,
    coordenadas: { lat, lng },
  }
}

export function detectarTramo(
  puntos: { lat: number; lng: number }[],
  capas: CapasGeoJSON
): DeteccionTramo {
  const lat_ini = puntos[0].lat
  const lng_ini = puntos[0].lng
  const lat_fin = puntos[puntos.length - 1].lat
  const lng_fin = puntos[puntos.length - 1].lng

  const coords = puntos.map(p => [p.lng, p.lat] as [number, number])
  const line = lineString(coords)

  const lineBuffer = buffer(line, RADIO_CERCANIA_KM, { units: 'kilometers' })

  let distancia_m = 0
  for (let i = 1; i < puntos.length; i++) {
    distancia_m += haversineDistancia(puntos[i - 1].lat, puntos[i - 1].lng, puntos[i].lat, puntos[i].lng)
  }

  let maxSegLen = -1
  let segMidLat = lat_ini
  let segMidLng = lng_ini
  for (let i = 1; i < puntos.length; i++) {
    const segLen = haversineDistancia(puntos[i - 1].lat, puntos[i - 1].lng, puntos[i].lat, puntos[i].lng)
    if (segLen > maxSegLen) {
      maxSegLen = segLen
      segMidLat = (puntos[i - 1].lat + puntos[i].lat) / 2
      segMidLng = (puntos[i - 1].lng + puntos[i].lng) / 2
    }
  }
  const ancho_calle_m = estimarAnchoCalle(segMidLat, segMidLng, puntos[0].lat, puntos[0].lng, capas.stv)

  if (!lineBuffer) {
    return {
      colonias: [], juntas_auxiliares: [], zonas_zap: [], cobertura_agua: false,
      escuelas_cercanas: [], iglesias_cercanas: [], transportes_cercanos: [],
      distancia_m, ancho_calle_m,
      coordenadas: { lat_ini, lng_ini, lat_fin, lng_fin },
    }
  }

  const buf = lineBuffer as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>

  function polygonIntersects(fc: GeoJSON.FeatureCollection): string[] {
    const names: string[] = []
    for (const f of fc.features) {
      if (!f.geometry) continue
      if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue
      if (!f.geometry.coordinates) continue
      try {
        if (booleanIntersects(f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>, buf)) {
          names.push(getProps(f).name || '')
        }
      } catch (_e) { /* skip invalid geometry */ }
    }
    return names
  }

  function pointInBuffer(fc: GeoJSON.FeatureCollection): string[] {
    const names: string[] = []
    for (const f of fc.features) {
      if (!f.geometry) continue
      if (f.geometry.type !== 'Point') continue
      if (!f.geometry.coordinates) continue
      try {
        if (booleanPointInPolygon(f as GeoJSON.Feature<GeoJSON.Point>, buf)) {
          names.push(getProps(f).name || '')
        }
      } catch (_e) { /* skip */ }
    }
    return names
  }

  function lineIntersects(fc: GeoJSON.FeatureCollection): string[] {
    const names: string[] = []
    for (const f of fc.features) {
      if (!f.geometry) continue
      if (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString') continue
      if (!f.geometry.coordinates) continue
      try {
        const inter = lineIntersect(line, f as GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>)
        if (inter.features.length > 0 || booleanIntersects(f as GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>, buf)) {
          names.push(getProps(f).name || '')
        }
      } catch (_e) { /* skip */ }
    }
    return names
  }

  const colonias = polygonIntersects(capas.colonias).map(cleanColoniaName)
  const juntas_auxiliares_raw = polygonIntersects(capas.juntas)
  if (juntas_auxiliares_raw.length === 0) {
    juntas_auxiliares_raw.push('Zona Metropolitana')
  }
  const zonas_zap = polygonIntersects(capas.zonasZap)
  const cobertura_agua = polygonIntersects(capas.coberturaAgua).length > 0
  const escuelas_cercanas = pointInBuffer(capas.escuelas)
  const iglesias_cercanas = pointInBuffer(capas.iglesias)
  const transportes_cercanos = lineIntersects(capas.stv)

  return {
    colonias,
    juntas_auxiliares: juntas_auxiliares_raw.map(matchJunta),
    zonas_zap,
    cobertura_agua,
    escuelas_cercanas,
    iglesias_cercanas,
    transportes_cercanos,
    distancia_m,
    ancho_calle_m,
    coordenadas: { lat_ini, lng_ini, lat_fin, lng_fin },
  }
}
