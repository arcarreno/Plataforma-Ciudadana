import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import dotenv from 'dotenv'

dotenv.config()

const LOGO_PUEBLA = fs.readFileSync(path.resolve(__dirname, 'src/assets/Puebla.png'))
const LOGO_SEMOVINFRA = fs.readFileSync(path.resolve(__dirname, 'src/assets/Logo_Semovinfra.jpg'))

const SIGED_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Origin: 'https://siged.sep.gob.mx',
  Referer: 'https://siged.sep.gob.mx/SIGED/escuelas.html',
}

function sigedGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: SIGED_HEADERS, rejectUnauthorized: false }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }))
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout SIGED')) })
  })
}

function sigedPlugin() {
  return {
    name: 'siged-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/consultar-siged', async (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }

        let cct: string | null = null
        let turno = '1'
        try {
          const u = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
          cct = u.searchParams.get('cct')
          turno = u.searchParams.get('turno') || '1'
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'URL inválida' }))
          return
        }

        if (!cct || cct.toUpperCase().trim().length !== 10) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'CCT requerido (10 caracteres)' }))
          return
        }

        const cctUp = cct.toUpperCase().trim()
        const sigedUrl = `https://api.siged.sep.gob.mx/CoreServices/servicios/escuela/detalleCT/cct=${cctUp}&idTurno=${turno}`
        console.log('[SIGED] Request:', cctUp, 'turno:', turno)
        let rawStatus = 0
        let rawText = ''
        try {
          const resp = await sigedGet(sigedUrl)
          rawStatus = resp.status
          rawText = resp.body
        } catch (netErr: any) {
          console.error('[SIGED] Network error:', netErr?.message)
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'No se pudo conectar con SIGED: ' + (netErr?.message || 'timeout') }))
          return
        }

        if (rawStatus < 200 || rawStatus >= 300) {
          console.log('[SIGED] Upstream error:', rawStatus)
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'SIGED respondió ' + rawStatus }))
          return
        }

        let data: any = null
        try { data = JSON.parse(rawText) } catch {
          console.error('[SIGED] JSON parse error. Body:', rawText.substring(0, 300))
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'SIGED respondió JSON inválido' }))
          return
        }

        const d = data?.datos
        if (!d || !d.claveCct || d.idTurno === 0) {
          console.log('[SIGED] Not found:', cctUp)
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Escuela ' + cctUp + ' no encontrada en SIGED' }))
          return
        }

        try {
          const rawEst = data?.estadistica
          const e = Array.isArray(rawEst) ? (rawEst.length > 0 ? rawEst[0] : {}) : (rawEst || {})
          const num = (v: any) => parseInt(v, 10) || 0
          const total = num(e.alumnosH) + num(e.alumnosM)
          const result = {
            cct: d.claveCct || cctUp,
            nombre: d.nombreCT || '',
            nivel: d.nombreNiv || e.nivel || '',
            subnivel: e.subnivel || '',
            turno: d.nombreTur || '',
            sostenimiento: d.nombreCont || '',
            control: e.control || '',
            subControl: e.subControl || '',
            domicilio: d.domicilio || '',
            colonia: d.colonia || '',
            municipio: d.nombreMun || '',
            estado: d.nombreEnt || '',
            codigoPostal: d.codPost || '',
            latitud: d.latDms || '',
            longitud: d.lonDms || '',
            alumnosHombres: num(e.alumnosH),
            alumnosMujeres: num(e.alumnosM),
            totalAlumnos: total,
            docentes: num(e.docenteH) + num(e.docenteM),
            grupos: num(e.gposT),
            fuente: e.fuente || '',
          }
          console.log('[SIGED] OK:', result.nombre, '| Alumnos:', result.totalAlumnos)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch (buildErr: any) {
          console.error('[SIGED] Build result error:', buildErr?.message)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Error procesando datos de SIGED' }))
        }
      })
    },
  }
}

function emailPlugin() {
  return {
    name: 'email-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/enviar-documentacion', async (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        for await (const chunk of req) body += chunk

        let parsed: any
        try { parsed = JSON.parse(body) } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'JSON inválido' }))
          return
        }

        const { correo, folio, oficioPdf, fichaPdf, oficioNombre, fichaNombre } = parsed || {}
        if (!correo || !folio || !oficioPdf || !fichaPdf) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'correo, folio, oficioPdf y fichaPdf son requeridos' }))
          return
        }

        const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
        const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10)
        const smtpUser = process.env.SMTP_USER
        const smtpPass = process.env.SMTP_PASS
        const smtpFrom = process.env.SMTP_FROM || smtpUser

        if (!smtpUser || !smtpPass) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'SMTP no configurado (SMTP_USER/SMTP_PASS)' }))
          return
        }

        const transporter = nodemailer.createTransport({
          host: smtpHost, port: smtpPort, secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        })

        try {
          const info = await transporter.sendMail({
            from: `"Atención Ciudadana Puebla" <${smtpFrom}>`,
            to: correo,
            subject: `Documentación solicitud ${folio} — Atención Ciudadana Puebla`,
            html: buildEmailHtml(folio), text: buildEmailText(folio),
            attachments: [
              { filename: 'puebla.png', content: LOGO_PUEBLA, contentType: 'image/png', cid: 'puebla-logo' },
              { filename: 'semovinfra.jpg', content: LOGO_SEMOVINFRA, contentType: 'image/jpeg', cid: 'semov-logo' },
              { filename: oficioNombre || `Oficio_${folio}.pdf`, content: Buffer.from(oficioPdf, 'base64'), contentType: 'application/pdf' },
              { filename: fichaNombre || `Ficha_${folio}.pdf`, content: Buffer.from(fichaPdf, 'base64'), contentType: 'application/pdf' },
            ],
          })
          console.log('[EMAIL] Enviado:', info.messageId, '→', correo)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, messageId: info.messageId }))
        } catch (err: any) {
          console.error('[EMAIL] Error:', err?.message)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Error al enviar: ' + (err?.message || 'desconocido') }))
        }
      })
    },
  }
}

function buildEmailHtml(folio: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f0f0f0;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;"><tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">
  <tr>
    <td style="background:#7b1a3a;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;">
      <img src="cid:puebla-logo" alt="Puebla" width="48" height="48" style="display:block;border-radius:4px;" />
      <span style="color:#ffffff;font-size:18px;font-weight:bold;">Atención Ciudadana</span>
      <img src="cid:semov-logo" alt="SEMOVINFRA" width="48" height="48" style="display:block;border-radius:4px;" />
    </td>
  </tr>
  <tr>
    <td style="padding:30px 32px;">
      <p style="color:#333333;font-size:15px;margin:0 0 12px 0;">Estimado(a) ciudadano(a),</p>
      <p style="color:#555555;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
        Se adjuntan los documentos correspondientes a su solicitud
        <strong style="color:#7b1a3a;">${folio}</strong>:
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
        <tr><td style="color:#555;font-size:14px;line-height:2;padding-left:8px;">&#8226; <strong>Oficio de respuesta</strong> (PDF)</td></tr>
        <tr><td style="color:#555;font-size:14px;line-height:2;padding-left:8px;">&#8226; <strong>Ficha técnica</strong> (PDF)</td></tr>
      </table>
      <p style="color:#555555;font-size:14px;line-height:1.6;margin:0 0 0 0;">
        Le recomendamos conservar estos documentos para su referencia.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 24px 32px;">
      <hr style="border:none;border-top:1px solid #eee;margin:0 0 16px 0;">
      <p style="color:#999999;font-size:11px;text-align:center;margin:0;line-height:1.5;">
        Secretaría de Movilidad e Infraestructura de la ciudad de Puebla
      </p>
    </td>
  </tr>
</table>
</td></tr></table>
</body>
</html>`
}

function buildEmailText(folio: string): string {
  return `Atención Ciudadana — Puebla\n\nEstimado(a) ciudadano(a),\n\nSe adjuntan los documentos correspondientes a su solicitud ${folio}:\n- Oficio de respuesta (PDF)\n- Ficha técnica (PDF)\n\nLe recomendamos conservar estos documentos para su referencia.\n\n---\nSecretaría de Movilidad e Infraestructura de la ciudad de Puebla`
}

export default defineConfig({
  plugins: [react(), tailwindcss(), sigedPlugin(), emailPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://10.4.3.154:4920',
        changeOrigin: true,
      },
    },
  },
})
