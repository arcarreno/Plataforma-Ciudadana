import type { VercelRequest, VercelResponse } from '@vercel/node'
import https from 'node:https'

const SIGED_BASE = 'https://api.siged.sep.gob.mx/CoreServices/servicios'

const HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Origin: 'https://siged.sep.gob.mx',
  Referer: 'https://siged.sep.gob.mx/SIGED/escuelas.html',
}

interface SigedDatos {
  claveCct?: string
  nombreCT?: string
  nombreNiv?: string
  nombreTur?: string
  nombreCont?: string
  domicilio?: string
  colonia?: string
  nombreMun?: string
  nombreEnt?: string
  codPost?: string
  latDms?: string
  lonDms?: string
  idTurno?: number
}

interface SigedEstadistica {
  claveCct?: string
  nivel?: string
  subnivel?: string
  control?: string
  subControl?: string
  alumnosH?: string
  alumnosM?: string
  docenteH?: string
  docenteM?: string
  gposT?: string
  aulaExis?: string
  aulaUT?: string
  fuente?: string
}

function sigedGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: HEADERS, rejectUnauthorized: false, timeout: 15000 }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('SIGED timeout')) })
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { cct, turno } = req.query

  if (!cct || typeof cct !== 'string') {
    return res.status(400).json({ error: 'Parámetro "cct" requerido' })
  }

  const cctUpper = cct.toUpperCase().trim()
  if (cctUpper.length !== 10) {
    return res.status(400).json({ error: 'El CCT debe tener 10 caracteres' })
  }

  const idTurno = turno && typeof turno === 'string' ? turno : '1'

  let rawStatus = 0
  let rawText = ''
  try {
    const url = `${SIGED_BASE}/escuela/detalleCT/cct=${cctUpper}&idTurno=${idTurno}`
    const resp = await sigedGet(url)
    rawStatus = resp.status
    rawText = resp.body
  } catch (netErr: any) {
    console.error('[SIGED] Network error:', netErr?.message)
    return res.status(502).json({ error: 'No se pudo conectar con SIGED: ' + (netErr?.message || 'timeout') })
  }

  if (rawStatus < 200 || rawStatus >= 300) {
    return res.status(502).json({ error: 'SIGED respondió ' + rawStatus })
  }

  let data: any = null
  try { data = JSON.parse(rawText) } catch {
    return res.status(502).json({ error: 'SIGED respondió JSON inválido' })
  }

  const datos: SigedDatos | undefined = data?.datos
  if (!datos || !datos.claveCct || datos.idTurno === 0) {
    return res.status(404).json({ error: 'Escuela ' + cctUpper + ' no encontrada en SIGED' })
  }

  const rawEst = data?.estadistica
  const estadistica: SigedEstadistica = Array.isArray(rawEst) ? (rawEst.length > 0 ? rawEst[0] : {}) : (rawEst || {})
  const num = (v: any) => parseInt(v, 10) || 0

  return res.status(200).json({
    cct: datos.claveCct,
    nombre: datos.nombreCT,
    nivel: datos.nombreNiv || estadistica.nivel || '',
    subnivel: estadistica.subnivel || '',
    turno: datos.nombreTur || '',
    sostenimiento: datos.nombreCont || '',
    control: estadistica.control || '',
    subControl: estadistica.subControl || '',
    domicilio: datos.domicilio || '',
    colonia: datos.colonia || '',
    municipio: datos.nombreMun || '',
    estado: datos.nombreEnt || '',
    codigoPostal: datos.codPost || '',
    latitud: datos.latDms || '',
    longitud: datos.lonDms || '',
    alumnosHombres: num(estadistica.alumnosH),
    alumnosMujeres: num(estadistica.alumnosM),
    totalAlumnos: num(estadistica.alumnosH) + num(estadistica.alumnosM),
    docentes: num(estadistica.docenteH) + num(estadistica.docenteM),
    grupos: num(estadistica.gposT),
    fuente: estadistica.fuente || '',
  })
}
