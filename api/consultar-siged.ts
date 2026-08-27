/**
 * api/consultar-siged.ts — Vercel Function (prod) para consultar SIGED por CCT
 *
 * Qué hace: proxy a https://api.siged.sep.gob.mx para validar que una escuela existe.
 * Por qué existe: el frontend no puede llamar directo a SIGED por CORS y porque
 * necesitamos spoofear Origin/Referer y normalizar la respuesta (datos + estadística).
 * Duplicado de vite.config.ts -> sigedPlugin() (ese es solo para dev con Vite).
 * En prod Vercel ejecuta ESTE archivo como serverless function en /api/consultar-siged.
 *
 * Flujo: GET /api/consultar-siged?cct=21DPR0000A&turno=1
 *        -> valida CCT 10 chars -> https.get a SIGED con headers spoof -> parsea JSON
 *        -> valida datos.claveCct && idTurno !== 0 -> normaliza -> 200 {cct, nombre, nivel...}
 *        -> 400 si CCT mal, 404 si no existe, 502 si SIGED cae o JSON inválido
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import https from 'node:https'

// Base de la API oficial de SIGED (SEP)
const SIGED_BASE = 'https://api.siged.sep.gob.mx/CoreServices/servicios'

// Headers necesarios para que SIGED no bloquee la petición (requiere Origin/Referer de su dominio)
const HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  // Spoof de navegador Chrome real, si no SIGED devuelve 403
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Origin: 'https://siged.sep.gob.mx', // SIGED valida Origin
  Referer: 'https://siged.sep.gob.mx/SIGED/escuelas.html',
}

/** Subconjunto de datos que devuelve SIGED en data.datos */
interface SigedDatos {
  claveCct?: string // CCT normalizado (ej: 21DPR0000A)
  nombreCT?: string // Nombre de la escuela
  nombreNiv?: string // Nivel (Primaria, Secundaria...)
  nombreTur?: string // Turno (Matutino, Vespertino)
  nombreCont?: string // Sostenimiento (Público, Privado)
  domicilio?: string
  colonia?: string
  nombreMun?: string
  nombreEnt?: string
  codPost?: string
  latDms?: string // Latitud en DMS
  lonDms?: string // Longitud en DMS
  idTurno?: number // 0 = no encontrado, >0 = válido
}

/** Subconjunto de estadística (puede venir como array o objeto) */
interface SigedEstadistica {
  claveCct?: string
  nivel?: string
  subnivel?: string
  control?: string // Estatal, Federal...
  subControl?: string
  alumnosH?: string // Alumnos hombres (string numérico)
  alumnosM?: string // Alumnas mujeres
  docenteH?: string
  docenteM?: string
  gposT?: string // Grupos
  aulaExis?: string
  aulaUT?: string
  fuente?: string
}

/**
 * Helper: hace GET https a SIGED con headers spoof y timeout 15s.
 * Usa node:https nativo (no fetch) para controlar rejectUnauthorized y timeout.
 * @param url - URL completa a SIGED
 * @returns {status, body} status HTTP y body como string
 */
function sigedGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    // https.get con headers y timeout 15s; rejectUnauthorized:false por si el cert de SIGED falla
    const req = https.get(url, { headers: HEADERS, rejectUnauthorized: false, timeout: 15000 }, (res) => {
      let data = ''
      // Acumulamos chunks como string
      res.on('data', (chunk: string) => { data += chunk })
      // Al terminar, resolvemos con status y body completo
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }))
    })
    // Error de red (DNS, ECONNREFUSED...)
    req.on('error', reject)
    // Timeout 15s -> destruimos y rechazamos
    req.on('timeout', () => { req.destroy(); reject(new Error('SIGED timeout')) })
  })
}

/**
 * Handler Vercel: GET /api/consultar-siged?cct=21DPR0000A&turno=1
 * Valida CCT, consulta SIGED, normaliza y responde JSON simplificado.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS: permitimos cualquier origen (llamado desde frontend en otro dominio)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Extraemos query params (Vercel ya los parsea en req.query)
  const { cct, turno } = req.query

  // Validación: cct requerido y debe ser string
  if (!cct || typeof cct !== 'string') {
    return res.status(400).json({ error: 'Parámetro "cct" requerido' })
  }

  // Normalizamos a mayúsculas y trim
  const cctUpper = cct.toUpperCase().trim()
  // CCT debe ser exactamente 10 caracteres (clave de centro de trabajo SEP)
  if (cctUpper.length !== 10) {
    return res.status(400).json({ error: 'El CCT debe tener 10 caracteres' })
  }

  // Turno por defecto 1 (matutino) si no viene
  const idTurno = turno && typeof turno === 'string' ? turno : '1'

  let rawStatus = 0
  let rawText = ''
  try {
    // Construimos URL SIGED: /escuela/detalleCT/cct={CCT}&idTurno={turno}
    const url = `${SIGED_BASE}/escuela/detalleCT/cct=${cctUpper}&idTurno=${idTurno}`
    const resp = await sigedGet(url)
    rawStatus = resp.status
    rawText = resp.body
  } catch (netErr: any) {
    // Caída de red / timeout -> 502 Bad Gateway
    console.error('[SIGED] Network error:', netErr?.message)
    return res.status(502).json({ error: 'No se pudo conectar con SIGED: ' + (netErr?.message || 'timeout') })
  }

  // SIGED respondió pero con error HTTP (500, 404 interno de SIGED, etc.)
  if (rawStatus < 200 || rawStatus >= 300) {
    return res.status(502).json({ error: 'SIGED respondió ' + rawStatus })
  }

  // Parseamos JSON de SIGED
  let data: any = null
  try { data = JSON.parse(rawText) } catch {
    return res.status(502).json({ error: 'SIGED respondió JSON inválido' })
  }

  // Validamos que trae datos válidos: datos.claveCct existe y idTurno !== 0
  // Si idTurno === 0, SIGED indica "no encontrado" aunque devuelva 200
  const datos: SigedDatos | undefined = data?.datos
  if (!datos || !datos.claveCct || datos.idTurno === 0) {
    return res.status(404).json({ error: 'Escuela ' + cctUpper + ' no encontrada en SIGED' })
  }

  // Estadística puede venir como array [{}] o como objeto {} según el turno
  const rawEst = data?.estadistica
  const estadistica: SigedEstadistica = Array.isArray(rawEst) ? (rawEst.length > 0 ? rawEst[0] : {}) : (rawEst || {})
  // Helper para parsear strings numéricos de SIGED ("12" -> 12, "" -> 0)
  const num = (v: any) => parseInt(v, 10) || 0

  // Normalizamos a nuestro formato interno (lo que espera consultarSIGED.ts en el frontend)
  return res.status(200).json({
    cct: datos.claveCct, // CCT normalizado
    nombre: datos.nombreCT, // Nombre de la escuela
    nivel: datos.nombreNiv || estadistica.nivel || '', // Nivel (con fallback a estadística)
    subnivel: estadistica.subnivel || '',
    turno: datos.nombreTur || '', // Turno textual
    sostenimiento: datos.nombreCont || '', // Público/Privado
    control: estadistica.control || '',
    subControl: estadistica.subControl || '',
    domicilio: datos.domicilio || '',
    colonia: datos.colonia || '',
    municipio: datos.nombreMun || '',
    estado: datos.nombreEnt || '',
    codigoPostal: datos.codPost || '',
    latitud: datos.latDms || '', // DMS (grados, minutos, segundos)
    longitud: datos.lonDms || '',
    alumnosHombres: num(estadistica.alumnosH),
    alumnosMujeres: num(estadistica.alumnosM),
    totalAlumnos: num(estadistica.alumnosH) + num(estadistica.alumnosM), // Suma H+M
    docentes: num(estadistica.docenteH) + num(estadistica.docenteM),
    grupos: num(estadistica.gposT),
    fuente: estadistica.fuente || '',
  })
}
