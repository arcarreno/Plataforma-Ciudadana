import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import booleanIntersects from '@turf/boolean-intersects'
import lineIntersect from '@turf/line-intersect'
import { point, lineString } from '@turf/helpers'
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
  calles: GeoJSON.FeatureCollection
}

export interface DeteccionPunto {
  colonia: string
  junta_auxiliar: string
  zona_zap: boolean
  cobertura_agua: boolean
  fuera_alcance: boolean
  coordenadas: { lat: number; lng: number }
}

export interface DeteccionTramo {
  escuelas_cercanas: string[]
  iglesias_cercanas: string[]
  transportes_cercanos: string[]
  distancia_m: number
  ancho_calle_m: number
  coordenadas: { lat_ini: number; lng_ini: number; lat_fin: number; lng_fin: number }
}

const RADIO_TRAMO_KM = 0.003

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

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

const capaCache = new Map<string, Promise<GeoJSON.FeatureCollection>>()

async function fetchJSON(url: string): Promise<GeoJSON.FeatureCollection> {
  const cached = capaCache.get(url)
  if (cached) return cached
  const promise = (async () => {
    try {
      const r = await fetch(url)
      if (!r.ok) return EMPTY_FC
      return await r.json()
    } catch (_e) {
      return EMPTY_FC
    }
  })()
  capaCache.set(url, promise)
  return promise
}

const ALL_CAPAS = [
  { key: 'colonias' as const, url: '/data/COLONIAS PUEBLA.geojson' },
  { key: 'juntas' as const, url: '/data/JUNTAS AUXILIARES.geojson' },
  { key: 'zonasZap' as const, url: '/data/zonas zap2024.geojson' },
  { key: 'escuelas' as const, url: '/data/Escuelas.geojson' },
  { key: 'iglesias' as const, url: '/data/Iglesias.geojson' },
  { key: 'stv' as const, url: '/data/STV.geojson' },
  { key: 'coberturaAgua' as const, url: '/data/COBERTURA_AGUAS DE PUEBLA.geojson' },
  { key: 'calles' as const, url: '/data/CALLES_PUEBLA.geojson' },
]

export function cargarCapas(include?: (keyof CapasGeoJSON)[]): Promise<CapasGeoJSON> {
  const selected = include ? ALL_CAPAS.filter(l => include.includes(l.key)) : ALL_CAPAS
  return Promise.all(
    selected.map(l => fetchJSON(l.url).then(d => ({ key: l.key, data: d })))
  ).then(results => {
    const obj = {} as CapasGeoJSON
    for (const r of results) (obj as any)[r.key] = r.data
    if (include) {
      for (const l of ALL_CAPAS) {
        if (!include.includes(l.key)) (obj as any)[l.key] = EMPTY_FC
      }
    }
    return obj
  })
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

  return {
    colonia,
    junta_auxiliar,
    zona_zap: tieneZonaZap,
    cobertura_agua: tieneCoberturaAgua,
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

  const lineBuffer = buffer(line, RADIO_TRAMO_KM, { units: 'kilometers' })

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
      escuelas_cercanas: [], iglesias_cercanas: [], transportes_cercanos: [],
      distancia_m, ancho_calle_m,
      coordenadas: { lat_ini, lng_ini, lat_fin, lng_fin },
    }
  }

  const buf = lineBuffer as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>

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

  const escuelas_cercanas = pointInBuffer(capas.escuelas)
  const iglesias_cercanas = pointInBuffer(capas.iglesias)
  const transportes_cercanos = lineIntersects(capas.stv)

  return {
    escuelas_cercanas,
    iglesias_cercanas,
    transportes_cercanos,
    distancia_m,
    ancho_calle_m,
    coordenadas: { lat_ini, lng_ini, lat_fin, lng_fin },
  }
}
