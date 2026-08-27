/**
 * api/enviar-documentacion.ts — Vercel Function (prod) para enviar Oficio + Ficha por correo
 *
 * Qué hace: recibe 2 PDFs en base64 + datos del ciudadano y los envía por SMTP (Gmail + nodemailer).
 * Por qué existe: alternativa gratis a SendGrid/Mailgun (que cobran por 1000 envíos).
 * Duplicado de vite.config.ts -> emailPlugin() (ese es solo para dev con Vite).
 * En prod Vercel ejecuta ESTE archivo como serverless en POST /api/enviar-documentacion.
 *
 * Flujo: SolicitudDetail.tsx genera PDFs (html2canvas+jsPDF -> base64)
 *        -> POST /api/enviar-documentacion {correo, folio, oficioPdf, fichaPdf}
 *        -> valida -> createTransport(smtp.gmail.com:587) -> sendMail con HTML guinda + 2 PDFs + 2 logos CID
 *        -> 200 {ok:true, messageId} o 500 si SMTP falla
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import nodemailer from 'nodemailer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// __dirname no existe en ESM, lo reconstruimos desde import.meta.url
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Carga una imagen del disco para adjuntarla como CID (inline en el HTML).
 * Intenta dos rutas porque Vercel puede ejecutar desde /api o desde cwd distinto.
 * @param filename - Nombre del archivo (ej: "Puebla.png")
 * @returns Buffer o null si no existe (no rompe el envío, solo no muestra logo)
 */
function loadImage(filename: string): Buffer | null {
  try {
    // Intento 1: relativo a este archivo (__dirname/api/Puebla.png)
    return fs.readFileSync(path.join(__dirname, filename))
  } catch {
    try {
      // Intento 2: relativo a process.cwd() (raíz del proyecto)
      return fs.readFileSync(path.join(process.cwd(), 'api', filename))
    } catch {
      // No es crítico: log y seguimos sin logo
      console.warn('[EMAIL] No se pudo cargar imagen:', filename)
      return null
    }
  }
}

/**
 * Handler Vercel: POST /api/enviar-documentacion
 * Body: {correo, folio, oficioPdf (base64), fichaPdf (base64), oficioNombre?, fichaNombre?}
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS: permitimos cualquier origen (frontend en Vercel distinto al api)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Solo POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Extraemos body (Vercel ya lo parsea si Content-Type: application/json)
  const { correo, folio, oficioPdf, fichaPdf, oficioNombre, fichaNombre } = req.body || {}

  // Validaciones de campos requeridos
  if (!correo || typeof correo !== 'string') {
    return res.status(400).json({ error: 'Correo del solicitante requerido' })
  }
  if (!folio || typeof folio !== 'string') {
    return res.status(400).json({ error: 'Folio requerido' })
  }
  if (!oficioPdf || !fichaPdf) {
    return res.status(400).json({ error: 'Ambos documentos PDF son requeridos' })
  }

  // Config SMTP desde env (Vercel Environment Variables)
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com' // Gmail por defecto
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10) // 587 = STARTTLS, 465 = SSL
  const smtpUser = process.env.SMTP_USER // arancago25@gmail.com
  const smtpPass = process.env.SMTP_PASS // App Password (no la pass real)
  const smtpFrom = process.env.SMTP_FROM || smtpUser // Remitente visible

  // Si no hay credenciales, no podemos enviar
  if (!smtpUser || !smtpPass) {
    return res.status(500).json({ error: 'SMTP no configurado en el servidor' })
  }

  // Creamos transporter de nodemailer (cliente SMTP)
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true solo para 465 (SSL), false para 587 (STARTTLS)
    auth: { user: smtpUser, pass: smtpPass },
  })

  // Cargamos logos para CID (se verán dentro del HTML del correo)
  const logoPuebla = loadImage('Puebla.png')
  const logoSemovinfra = loadImage('Logo_Semovinfra.jpg')

  // Adjuntos: siempre los 2 PDFs, más los logos si se pudieron cargar
  const attachments: any[] = [
    // Oficio PDF (base64 -> Buffer)
    { filename: oficioNombre || `Oficio_${folio}.pdf`, content: Buffer.from(oficioPdf, 'base64'), contentType: 'application/pdf' },
    // Ficha PDF
    { filename: fichaNombre || `Ficha_${folio}.pdf`, content: Buffer.from(fichaPdf, 'base64'), contentType: 'application/pdf' },
  ]

  // Logos CID: se referencian en el HTML como <img src="cid:puebla-logo">
  if (logoPuebla) {
    attachments.push({ filename: 'puebla.png', content: logoPuebla, contentType: 'image/png', cid: 'puebla-logo' })
  }
  if (logoSemovinfra) {
    attachments.push({ filename: 'semovinfra.jpg', content: logoSemovinfra, contentType: 'image/jpeg', cid: 'semov-logo' })
  }

  try {
    // Enviamos el correo
    const info = await transporter.sendMail({
      from: `"Atención Ciudadana Puebla" <${smtpFrom}>`, // Remitente con nombre bonito
      to: correo, // Destinatario: el ciudadano (s.correo)
      subject: `Documentación solicitud ${folio} — Atención Ciudadana Puebla`,
      html: buildEmailHtml(folio), // Versión HTML guinda con logos CID
      text: buildEmailText(folio), // Versión texto plano (fallback si el cliente no soporta HTML)
      attachments, // 2 PDFs + 2 logos CID
    })

    console.log('[EMAIL] Enviado:', info.messageId, '→', correo)
    return res.status(200).json({ ok: true, messageId: info.messageId })
  } catch (err: any) {
    // Error de SMTP (auth, red, límite de Gmail, etc.)
    console.error('[EMAIL] Error:', err?.message || err)
    return res.status(500).json({ error: 'Error al enviar correo: ' + (err?.message || 'desconocido') })
  }
}

/**
 * Construye el HTML del correo (tablas para compatibilidad con Outlook/Gmail).
 * Usa cid:puebla-logo y cid:semov-logo para los logos inline.
 * Colores: guinda #7b1a3a, fondo #f0f0f0, blanco #fff.
 * @param folio - Folio de la solicitud (ej: ST0001)
 */
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

/**
 * Versión texto plano del correo (para clientes que no renderizan HTML).
 * @param folio - Folio de la solicitud
 */
function buildEmailText(folio: string): string {
  return `Atención Ciudadana — Puebla

Estimado(a) ciudadano(a),

Se adjuntan los documentos correspondientes a su solicitud ${folio}:
- Oficio de respuesta (PDF)
- Ficha técnica (PDF)

Le recomendamos conservar estos documentos para su referencia.

---
Secretaría de Movilidad e Infraestructura de la ciudad de Puebla`
}
