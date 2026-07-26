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

export async function geolocalizarCalle(lat: number, lon: number): Promise<CalleInfo> {
  try {
    // 1) Reverse geocode → street name
    const nomUrl = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=18`
    const nomResp = await fetch(nomUrl, { headers: { 'User-Agent': UA } })
    const nomData: NominatimResponse = await nomResp.json()
    const mainStreet = nomData.address?.road || ''

    if (!mainStreet) {
      return { calle: '', entreCalles: '' }
    }

    const calleName = mainStreet.toUpperCase()

    // 2) Overpass → nearby streets within 150m
    const overpassQuery = `
      [out:json][timeout:10];
      way["highway"](around:150,${lat},${lon});
      out tags;
    `
    const overpassBody = 'data=' + encodeURIComponent(overpassQuery)
    const ovResp = await fetch(OVERPASS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: overpassBody,
    })
    const ovData: { elements: OverpassElement[] } = await ovResp.json()

    // 3) Extract unique street names, exclude main street
    const mainBase = stripType(mainStreet)
    const seen = new Set<string>()
    const nearby: string[] = []

    for (const el of ovData.elements) {
      const name = el.tags?.name
      if (!name) continue
      const base = stripType(name)
      if (base === mainBase) continue
      if (seen.has(base)) continue
      seen.add(base)
      nearby.push(name.toUpperCase())
    }

    // 4) Pick first 2 cross streets
    const entre1 = nearby[0] || ''
    const entre2 = nearby[1] || ''

    let entreCalles = ''
    if (entre1 && entre2) {
      entreCalles = `ENTRE ${entre1} Y ${entre2}`
    } else if (entre1) {
      entreCalles = `ENTRE ${entre1}`
    }

    return {
      calle: calleName,
      entreCalles,
    }
  } catch (err) {
    console.warn('Error en geolocalización:', err)
    return { calle: '', entreCalles: '' }
  }
}
