import type { VercelRequest, VercelResponse } from '@vercel/node'
import nodemailer from 'nodemailer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadImage(filename: string): Buffer | null {
  try {
    return fs.readFileSync(path.join(__dirname, filename))
  } catch {
    try {
      return fs.readFileSync(path.join(process.cwd(), 'api', filename))
    } catch {
      console.warn('[EMAIL] No se pudo cargar imagen:', filename)
      return null
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { correo, folio, oficioPdf, fichaPdf, oficioNombre, fichaNombre } = req.body || {}

  if (!correo || typeof correo !== 'string') {
    return res.status(400).json({ error: 'Correo del solicitante requerido' })
  }
  if (!folio || typeof folio !== 'string') {
    return res.status(400).json({ error: 'Folio requerido' })
  }
  if (!oficioPdf || !fichaPdf) {
    return res.status(400).json({ error: 'Ambos documentos PDF son requeridos' })
  }

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10)
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = process.env.SMTP_FROM || smtpUser

  if (!smtpUser || !smtpPass) {
    return res.status(500).json({ error: 'SMTP no configurado en el servidor' })
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  })

  const logoPuebla = loadImage('Puebla.png')
  const logoSemovinfra = loadImage('Logo_Semovinfra.jpg')

  const attachments: any[] = [
    { filename: oficioNombre || `Oficio_${folio}.pdf`, content: Buffer.from(oficioPdf, 'base64'), contentType: 'application/pdf' },
    { filename: fichaNombre || `Ficha_${folio}.pdf`, content: Buffer.from(fichaPdf, 'base64'), contentType: 'application/pdf' },
  ]

  if (logoPuebla) {
    attachments.push({ filename: 'puebla.png', content: logoPuebla, contentType: 'image/png', cid: 'puebla-logo' })
  }
  if (logoSemovinfra) {
    attachments.push({ filename: 'semovinfra.jpg', content: logoSemovinfra, contentType: 'image/jpeg', cid: 'semov-logo' })
  }

  try {
    const info = await transporter.sendMail({
      from: `"Atención Ciudadana Puebla" <${smtpFrom}>`,
      to: correo,
      subject: `Documentación solicitud ${folio} — Atención Ciudadana Puebla`,
      html: buildEmailHtml(folio),
      text: buildEmailText(folio),
      attachments,
    })

    console.log('[EMAIL] Enviado:', info.messageId, '→', correo)
    return res.status(200).json({ ok: true, messageId: info.messageId })
  } catch (err: any) {
    console.error('[EMAIL] Error:', err?.message || err)
    return res.status(500).json({ error: 'Error al enviar correo: ' + (err?.message || 'desconocido') })
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
  return `Atención Ciudadana — Puebla

Estimado(a) ciudadano(a),

Se adjuntan los documentos correspondientes a su solicitud ${folio}:
- Oficio de respuesta (PDF)
- Ficha técnica (PDF)

Le recomendamos conservar estos documentos para su referencia.

---
Secretaría de Movilidad e Infraestructura de la ciudad de Puebla`
}
