import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import booleanIntersects from '@turf/boolean-intersects'
import lineIntersect from '@turf/line-intersect'
import { point, lineString } from '@turf/helpers'
import buffer from '@turf/buffer'
import { matchJunta, cleanColoniaName } from '../core/geo'
import { estimarAnchoCalle, haversineDistancia } from './calle'
import { cargarCalles } from '../lib/geolocalizarCalle'

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
const RADIO_CERCANIA_KM = 0.01

function getProps(f: GeoJSON.Feature): { name: string } {
  return f.properties as { name: string } || { name: '' }
}

function bboxDe(f: GeoJSON.Feature): [number, number, number, number] {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const visit = (coords: number[][]) => {
    for (const c of coords) {
      if (c[0] < minX) minX = c[0]
      if (c[0] > maxX) maxX = c[0]
      if (c[1] < minY) minY = c[1]
      if (c[1] > maxY) maxY = c[1]
    }
  }
  const g = f.geometry as GeoJSON.Geometry | null
  if (!g) return [0, 0, 0, 0]
  if (g.type === 'Polygon') visit((g.coordinates as number[][][]).flat())
  else if (g.type === 'MultiPolygon') visit((g.coordinates as number[][][][]).flat(2))
  else if (g.type === 'LineString') visit(g.coordinates as number[][])
  else if (g.type === 'MultiLineString') visit((g.coordinates as number[][][]).flat())
  return [minX, minY, maxX, maxY]
}

function seCruzaBBox(
  f: GeoJSON.Feature,
  [bminX, bminY, bmaxX, bmaxY]: [number, number, number, number]
): boolean {
  const [fminX, fminY, fmaxX, fmaxY] = bboxDe(f)
  return fmaxX >= bminX && fminX <= bmaxX && fmaxY >= bminY && fminY <= bmaxY
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

function detectarEnCapa(
  pt: GeoJSON.Feature<GeoJSON.Point>,
  capa: GeoJSON.FeatureCollection
): GeoJSON.Feature | null {
  for (const f of capa.features) {
    if (!f.geometry) continue
    const gt = f.geometry.type
    if (gt === 'GeometryCollection') {
      const gc = f.geometry as GeoJSON.GeometryCollection
      for (const g of gc.geometries) {
        if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue
        try {
          if (booleanPointInPolygon(pt, { type: 'Feature', geometry: g, properties: {} } as any)) {
            return f
          }
        } catch (_e) { /* skip */ }
      }
    } else if (gt === 'Polygon' || gt === 'MultiPolygon') {
      if (!f.geometry.coordinates) continue
      try {
        if (booleanPointInPolygon(pt, f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)) {
          return f
        }
      } catch (_e) { /* skip */ }
    }
  }
  return null
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

const capaCache = new Map<string, Promise<GeoJSON.FeatureCollection>>()

async function fetchJSON(url: string): Promise<GeoJSON.FeatureCollection> {
  const cached = capaCache.get(url)
  if (cached) return cached
  const promise = (async () => {
    try {
      const r = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      if (!r.ok) return EMPTY_FC
      return await r.json()
    } catch (_e) {
      return EMPTY_FC
    }
  })()
  capaCache.set(url, promise)
  return promise
}

export const ALL_CAPAS = [
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

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}

async function fetchConReintento(url: string, intentos = 3): Promise<Response> {
  let lastErr: unknown = null
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } })
      if (r.ok) return r
      lastErr = new Error(`HTTP ${r.status}`)
    } catch (e) {
      lastErr = e
    }
    if (i < intentos - 1) await new Promise(res => setTimeout(res, 700 * (i + 1)))
  }
  throw lastErr ?? new Error(`no se pudo descargar ${url}`)
}

async function leerBytes(
  r: Response,
  url: string,
  onBytes: (n: number) => void
): Promise<Uint8Array | null> {
  if (r.body && !r.bodyUsed) {
    try {
      const reader = r.body.getReader()
      const chunks: Uint8Array[] = []
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        onBytes(value.length)
      }
      return concatChunks(chunks)
    } catch (e) {
      console.warn('[precarga] streaming falló para', url, e, '- reintentando descarga directa')
    }
  }
  try {
    const r2 = r.bodyUsed ? await fetchConReintento(url) : r
    const buf = await r2.arrayBuffer()
    onBytes(buf.byteLength)
    return new Uint8Array(buf)
  } catch (e) {
    console.error('[precarga] error en descarga directa', url, e)
    return null
  }
}

export interface ResultadoPrecarga {
  ok: boolean
  fallos: string[]
}

export async function precargarCapasConProgreso(
  onProgress: (bytesDescargados: number, bytesTotal: number) => void
): Promise<ResultadoPrecarga> {
  const urls = ALL_CAPAS.map(l => l.url)
  const fallos: string[] = []

  const resultados = await Promise.allSettled(urls.map(url => fetchConReintento(url)))

  let total = 0
  for (const r of resultados) {
    if (r.status === 'fulfilled') total += Number(r.value.headers.get('content-length')) || 0
  }

  let descargado = 0
  const sumar = (n: number) => {
    descargado += n
    onProgress(descargado, total)
  }

  await Promise.all(
    ALL_CAPAS.map(async (l, idx) => {
      const r = resultados[idx]
      if (r.status !== 'fulfilled') {
        console.error('[precarga] no se pudo descargar', l.url)
        fallos.push(l.url)
        return
      }
      try {
        const bytes = await leerBytes(r.value, l.url, sumar)
        if (!bytes) {
          fallos.push(l.url)
          return
        }
        if (l.key === 'calles') {
          let listas = await cargarCalles(bytes.buffer as ArrayBuffer)
          if (!listas) {
            console.error('[precarga] calles fallaron en el worker, reintentando descarga directa')
            listas = await cargarCalles()
          }
          if (!listas) {
            console.error('[precarga] las calles no quedaron listas')
            fallos.push(l.url)
          }
        } else {
          try {
            const fc = JSON.parse(new TextDecoder().decode(bytes)) as GeoJSON.FeatureCollection
            capaCache.set(l.url, Promise.resolve(fc))
          } catch (e) {
            console.error('[precarga] error al parsear', l.url, e)
            fallos.push(l.url)
          }
        }
      } catch (e) {
        console.error('[precarga] error al procesar', l.url, e)
        fallos.push(l.url)
      }
    })
  )

  onProgress(total, total)
  return { ok: fallos.length === 0, fallos }
}

export function detectarPunto(lat: number, lng: number, capas: CapasGeoJSON): DeteccionPunto {
  const pt = point([lng, lat])

  const rawColonia = detectarPIP(pt, capas.colonias)
  const rawJunta = detectarPIP(pt, capas.juntas)
  const tieneZonaZap = detectarEnCapa(pt, capas.zonasZap) !== null

  const featCoberturaAgua = detectarEnCapa(pt, capas.coberturaAgua)
  const servicioAgua = ((featCoberturaAgua?.properties as Record<string, unknown> | null)?.servicio ?? '') as string
  const tieneCoberturaAgua = featCoberturaAgua !== null && !servicioAgua.toUpperCase().startsWith('NO FACTURA')

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
  const lineBufferCercania = buffer(line, RADIO_CERCANIA_KM, { units: 'kilometers' })

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
  const bufCercania = (lineBufferCercania ?? lineBuffer) as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>

  function pointInBuffer(fc: GeoJSON.FeatureCollection, bufferGeom: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>): string[] {
    const names: string[] = []
    for (const f of fc.features) {
      if (!f.geometry) continue
      if (f.geometry.type !== 'Point') continue
      if (!f.geometry.coordinates) continue
      try {
        if (booleanPointInPolygon(f as GeoJSON.Feature<GeoJSON.Point>, bufferGeom)) {
          names.push(getProps(f).name || '')
        }
      } catch (_e) { /* skip */ }
    }
    return names
  }

  function lineIntersects(fc: GeoJSON.FeatureCollection): string[] {
    const names: string[] = []
    const bufBBox = bboxDe(buf)
    for (const f of fc.features) {
      if (!f.geometry) continue
      if (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString') continue
      if (!f.geometry.coordinates) continue
      try {
        if (!seCruzaBBox(f, bufBBox)) continue
        const inter = lineIntersect(line, f as GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>)
        if (inter.features.length > 0 || booleanIntersects(f as GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>, buf)) {
          names.push(getProps(f).name || '')
        }
      } catch (_e) { /* skip */ }
    }
    return names
  }

  const escuelas_cercanas = pointInBuffer(capas.escuelas, bufCercania)
  const iglesias_cercanas = pointInBuffer(capas.iglesias, bufCercania)
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
