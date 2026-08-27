/**
 * @file detectar-ubicacion.ts
 * @description
 * Núcleo de geoprocesamiento de la solicitud: detecta colonia/junta/ZAP/cobertura
 * para un punto y analiza un tramo (distancia, ancho, escuelas/iglesias/STV cercanos).
 * También gestiona la precarga y caché de todas las capas GeoJSON.
 *
 * Algoritmos y capas:
 * - **Detección puntual** (`detectarPunto`): usa `booleanPointInPolygon` sobre
 *   colonias, juntas, zonasZap y coberturaAgua. Normaliza nombres con
 *   `cleanColoniaName`/`matchJunta` y aplica reglas de `fuera_alcance`:
 *   sin colonia ni junta → fuera de alcance; solo colonia → junta="Zona Metropolitana";
 *   solo junta → colonia="Desconocida".
 * - **Detección de tramo** (`detectarTramo`): construye LineString del tramo,
 *   crea dos buffers con Turf (`RADIO_TRAMO_KM=0.003` y `RADIO_CERCANIA_KM=0.01`),
 *   suma distancias haversine por segmentos, estima ancho con `estimarAnchoCalle`
 *   sobre el segmento más largo, y busca puntos (escuelas/iglesias) dentro del
 *   buffer de cercanía y líneas STV que intersectan el tramo (`lineIntersect` +
 *   `booleanIntersects` con pre-filtro bbox).
 * - **Precarga** (`precargarCapasConProgreso`): descarga en paralelo todas las
 *   capas (`ALL_CAPAS`) con reintentos (`fetchConReintento`), reporta progreso
 *   por bytes, hace streaming si el body es legible (`leerBytes` + `concatChunks`),
 *   y alimenta tanto `capaCache` (para capas normales) como el Worker de calles
 *   (vía `cargarCalles(buffer)`).
 * - **Caché** (`capaCache`, `fetchJSON`): Map url→Promise para deduplicar fetches
 *   y permitir `cargarCapas(include?)` selectivo.
 */

import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import booleanIntersects from '@turf/boolean-intersects'
import lineIntersect from '@turf/line-intersect'
import { point, lineString } from '@turf/helpers'
import buffer from '@turf/buffer'
import { matchJunta, cleanColoniaName } from '../core/geo'
import { estimarAnchoCalle, haversineDistancia } from './calle'
import { cargarCalles } from '../lib/geolocalizarCalle'

/** Conjunto de capas GeoJSON que alimentan la detección. Todas son FeatureCollection. */
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

/** Resultado de la detección puntual (un marcador). */
export interface DeteccionPunto {
  colonia: string
  junta_auxiliar: string
  zona_zap: boolean
  cobertura_agua: boolean
  fuera_alcance: boolean
  coordenadas: { lat: number; lng: number }
}

/** Resultado del análisis de un tramo (polyline de N puntos). */
export interface DeteccionTramo {
  escuelas_cercanas: string[]
  iglesias_cercanas: string[]
  transportes_cercanos: string[]
  distancia_m: number
  ancho_calle_m: number
  coordenadas: { lat_ini: number; lng_ini: number; lat_fin: number; lng_fin: number }
}

/** Radio del buffer alrededor del tramo para buscar STV (en km). */
const RADIO_TRAMO_KM = 0.003
/** Radio del buffer para escuelas/iglesias cercanas (en km, más amplio). */
const RADIO_CERCANIA_KM = 0.01

/**
 * Extrae `properties.name` de un feature de forma segura.
 * @param f - Feature GeoJSON.
 * @returns Objeto con `name` (o cadena vacía).
 */
function getProps(f: GeoJSON.Feature): { name: string } {
  return f.properties as { name: string } || { name: '' }
}

/**
 * Calcula el bounding box [minX, minY, maxX, maxY] de un feature.
 * Soporta Polygon, MultiPolygon, LineString, MultiLineString.
 * @param f - Feature a medir.
 * @returns Bbox en coordenadas [lng, lat].
 */
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

/**
 * Test rápido de intersección de bboxes (sin Turf) para descartar features lejanas.
 * @param f - Feature a probar.
 * @param bminX - Bbox de referencia.
 * @returns `true` si los bboxes se solapan.
 */
function seCruzaBBox(
  f: GeoJSON.Feature,
  [bminX, bminY, bmaxX, bmaxY]: [number, number, number, number]
): boolean {
  const [fminX, fminY, fmaxX, fmaxY] = bboxDe(f)
  return fmaxX >= bminX && fminX <= bmaxX && fmaxY >= bminY && fminY <= bmaxY
}

/**
 * Busca el primer feature Polygon/MultiPolygon/GeometryCollection que contenga al punto.
 * Retorna el `name` de su properties o cadena vacía. Usa `booleanPointInPolygon`.
 * @param pt - Punto Turf.
 * @param capa - Capa donde buscar.
 * @returns Nombre del polígono contenedor o "".
 */
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
    } catch (_e) { /* skip — geometría inválida */ }
  }
  return ''
}

/**
 * Variante de `detectarPIP` que retorna el Feature completo en lugar del nombre.
 * Útil para inspeccionar properties adicionales (ej: `servicio` en coberturaAgua).
 * @param pt - Punto Turf.
 * @param capa - Capa donde buscar.
 * @returns Feature contenedor o `null`.
 */
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

/** FeatureCollection vacía usada como fallback cuando una capa falla. */
const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/** Caché de promesas de descarga por URL para deduplicar fetches concurrentes. */
const capaCache = new Map<string, Promise<GeoJSON.FeatureCollection>>()

/**
 * Descarga (o reutiliza de caché) un GeoJSON por URL.
 * Almacena la Promise en `capaCache` para que llamadas paralelas compartan el mismo fetch.
 * @param url - URL del GeoJSON.
 * @returns FeatureCollection (o vacía si falla).
 */
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

/** Definición de todas las capas disponibles con su key tipada y URL. */
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

/**
 * Carga un subconjunto (o todas) de las capas GeoJSON en paralelo.
 * Rellena las no solicitadas con `EMPTY_FC` para que el objeto `CapasGeoJSON` quede completo.
 * @param include - Keys a incluir; si se omite, trae todas.
 * @returns Objeto `CapasGeoJSON` con cada capa resuelta.
 */
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

/**
 * Concatena chunks Uint8Array en un único buffer contiguo.
 * @param chunks - Fragmentos recibidos por streaming.
 * @returns Uint8Array combinado.
 */
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

/**
 * Fetch con reintentos y backoff lineal (700 ms * intento).
 * @param url - URL a descargar.
 * @param intentos - Número máximo de intentos (default 3).
 * @returns Response exitosa.
 * @throws Último error si todos los intentos fallan.
 */
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

/**
 * Lee los bytes de una Response, preferentemente por streaming (`ReadableStream`)
 * para poder reportar progreso incremental vía `onBytes`. Si el streaming falla
 * o el body ya fue consumido, hace fallback a `arrayBuffer()` (re-fetcheando si es necesario).
 * @param r - Response ya obtenida.
 * @param url - URL (para re-fetch si el body está usado).
 * @param onBytes - Callback con cantidad de bytes leídos en cada chunk.
 * @returns Bytes completos o `null` si falla definitivamente.
 */
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

/** Resultado de la precarga masiva con reporte de URLs fallidas. */
export interface ResultadoPrecarga {
  ok: boolean
  fallos: string[]
}

/**
 * Precarga todas las capas con barra de progreso por bytes.
 * - Hace `fetchConReintento` en paralelo para todas las URLs y suma `content-length`
 *   para el total estimado.
 * - Lee cada body con `leerBytes` reportando `onProgress(descargado, total)`.
 * - Para `calles`, transfiere el buffer al Worker (`cargarCalles`); si falla,
 *   reintenta sin buffer (fetch interno del worker). El resto se parsea y cachea.
 * @param onProgress - Callback (bytesDescargados, bytesTotal) para UI de progreso.
 * @returns `ResultadoPrecarga` con lista de URLs que fallaron.
 */
export async function precargarCapasConProgreso(
  onProgress: (bytesDescargados: number, bytesTotal: number) => void
): Promise<ResultadoPrecarga> {
  const urls = ALL_CAPAS.map(l => l.url)
  const fallos: string[] = []

  // Fase 1: fetch paralelo con reintentos; se toleran fallos individuales (allSettled).
  const resultados = await Promise.allSettled(urls.map(url => fetchConReintento(url)))

  // Suma de content-length de las respuestas exitosas para estimar el total.
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
          // Las calles van al Worker; se transfiere el ArrayBuffer (zero-copy).
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

/**
 * Detecta información territorial para un punto (lat/lng).
 * Usa `detectarPIP`/`detectarEnCapa` y aplica normalización + reglas de `fuera_alcance`.
 * @param lat - Latitud del punto.
 * @param lng - Longitud del punto.
 * @param capas - Capas ya cargadas.
 * @returns `DeteccionPunto` con colonia/junta/ZAP/cobertura y flag fuera de alcance.
 */
export function detectarPunto(lat: number, lng: number, capas: CapasGeoJSON): DeteccionPunto {
  const pt = point([lng, lat])

  const rawColonia = detectarPIP(pt, capas.colonias)
  const rawJunta = detectarPIP(pt, capas.juntas)
  const tieneZonaZap = detectarEnCapa(pt, capas.zonasZap) !== null

  // Cobertura de agua: se considera "sin cobertura" si `servicio` empieza con "NO FACTURA".
  const featCoberturaAgua = detectarEnCapa(pt, capas.coberturaAgua)
  const servicioAgua = ((featCoberturaAgua?.properties as Record<string, unknown> | null)?.servicio ?? '') as string
  const tieneCoberturaAgua = featCoberturaAgua !== null && !servicioAgua.toUpperCase().startsWith('NO FACTURA')

  let colonia = rawColonia ? cleanColoniaName(rawColonia) : ''
  let junta_auxiliar = rawJunta ? matchJunta(rawJunta) : ''

  let fuera_alcance = false

  // Reglas de negocio para puntos fuera del municipio o con datos incompletos.
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

/**
 * Analiza un tramo (secuencia de puntos) para extraer métricas y entorno.
 * - Calcula `distancia_m` sumando haversine por segmentos.
 * - Estima `ancho_calle_m` sobre el segmento más largo (para evitar diagonales cortas).
 * - Crea buffers Turf y busca escuelas/iglesias dentro de `RADIO_CERCANIA_KM`
 *   y STV que intersectan el tramo (con pre-filtro bbox + `lineIntersect`/`booleanIntersects`).
 * @param puntos - Array de {lat,lng} en orden del trazo.
 * @param capas - Capas ya cargadas.
 * @returns `DeteccionTramo` con listas de referencias cercanas y métricas.
 */
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

  // Dos buffers: uno ajustado al tramo para STV y uno más amplio para puntos de interés.
  const lineBuffer = buffer(line, RADIO_TRAMO_KM, { units: 'kilometers' })
  const lineBufferCercania = buffer(line, RADIO_CERCANIA_KM, { units: 'kilometers' })

  // Distancia total acumulada por segmentos.
  let distancia_m = 0
  for (let i = 1; i < puntos.length; i++) {
    distancia_m += haversineDistancia(puntos[i - 1].lat, puntos[i - 1].lng, puntos[i].lat, puntos[i].lng)
  }

  // Se busca el segmento más largo para estimar el ancho de forma más representativa.
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

  /**
   * Busca puntos (escuelas/iglesias) dentro de un buffer poligonal.
   * @param fc - FeatureCollection de puntos.
   * @param bufferGeom - Polígono del buffer Turf.
   * @returns Nombres de los puntos contenidos.
   */
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

  /**
   * Busca líneas STV que intersectan el tramo o su buffer.
   * Usa pre-filtro bbox + `lineIntersect` (intersección exacta) o `booleanIntersects` (solape con buffer).
   * @param fc - FeatureCollection de líneas STV.
   * @returns Nombres de las líneas que cruzan el tramo.
   */
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
