interface NominatimAddress {
  road?: string
  neighbourhood?: string
  suburb?: string
  city?: string
}

interface NominatimResponse {
  address?: NominatimAddress
  display_name?: string
}

interface OverpassElement {
  tags?: { name?: string; highway?: string }
}

export interface CalleInfo {
  calle: string
  entreCalles: string
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const OVERPASS_BASE = 'https://overpass-api.de/api/interpreter'
const UA = 'AtencionCiudadana/1.0'

function stripType(name: string): string {
  return name.replace(/^(Calle|Avenida|Privada|Calzada|Boulevard)\s+/i, '').trim()
}

function cacheKey(lat: number, lon: number): string {
  return `geocalle:${lat.toFixed(3)},${lon.toFixed(3)}`
}

function writeCache(lat: number, lon: number, info: CalleInfo): void {
  try {
    localStorage.setItem(cacheKey(lat, lon), JSON.stringify(info))
  } catch {}
}

function readCache(lat: number, lon: number): CalleInfo | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lon))
    return raw ? (JSON.parse(raw) as CalleInfo) : null
  } catch {
    return null
  }
}

async function fetchNominatim(lat: number, lon: number): Promise<string> {
  const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=18`
  const resp = await fetch(url, { headers: { 'User-Agent': UA } })
  const data: NominatimResponse = await resp.json()
  return data.address?.road?.toUpperCase() || ''
}

async function fetchOverpass(lat: number, lon: number): Promise<string[]> {
  const query = `[out:json][timeout:5];way["highway"](around:150,${lat},${lon});out tags;`
  const body = 'data=' + encodeURIComponent(query)
  const resp = await fetch(OVERPASS_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body,
  })
  const data: { elements: OverpassElement[] } = await resp.json()
  const seen = new Set<string>()
  return data.elements
    .map(el => el.tags?.name?.toUpperCase().trim())
    .filter((n): n is string => !!n && !seen.has(n) && !!seen.add(n))
}

function buildEntreCalles(calle: string, nearby: string[]): string {
  const mainBase = stripType(calle)
  const streets = nearby.filter(n => stripType(n) !== mainBase)
  if (streets.length === 0) return ''
  const entre1 = streets[0]
  const entre2 = streets[1]
  if (entre1 && entre2) return `ENTRE ${entre1} Y ${entre2}`
  return `ENTRE ${entre1}`
}

export async function geolocalizarCalle(lat: number, lon: number): Promise<CalleInfo> {
  const cached = readCache(lat, lon)
  if (cached) return cached

  try {
    const [calle, nearby] = await Promise.all([
      fetchNominatim(lat, lon),
      fetchOverpass(lat, lon),
    ])

    if (!calle) return { calle: '', entreCalles: '' }

    const result: CalleInfo = {
      calle,
      entreCalles: buildEntreCalles(calle, nearby),
    }

    writeCache(lat, lon, result)
    return result
  } catch (err) {
    console.warn('Error en geolocalización:', err)
    return { calle: '', entreCalles: '' }
  }
}
