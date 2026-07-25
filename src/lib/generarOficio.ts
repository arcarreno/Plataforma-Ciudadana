import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Solicitud } from '../types/solicitud'

const PTS_PER_CM = 72 / 2.54
const PAGE_W = 21.6 * PTS_PER_CM
const PAGE_H = 27.9 * PTS_PER_CM
const LEFT = 3.0 * PTS_PER_CM
const RIGHT = LEFT
const CONTENT_W = PAGE_W - LEFT - RIGHT
const TOP_P1 = 1.5 * PTS_PER_CM
const TOP_CONT = 4.5 * PTS_PER_CM
const BOTTOM_LIMIT = 24.70 * PTS_PER_CM

const FONT_SIZES = {
  year: 9, oficioNum: 10.5, destinatario: 10.5, fundamento: 10.5,
  table: 9, cuerpo: 10.5, firma: 11, ccp: 7, footer: 8.5,
}

const LINE_H = { cuerpo: 1.45, firma: 1.3, table: 1.2, ccp: 1.2 }

const COLOR = {
  headerBg: rgb(0.9059, 0.9020, 0.9020),
  black: rgb(0, 0, 0),
  footerText: rgb(0.6784, 0.6392, 0.4941),
  gray: rgb(0.5, 0.5, 0.5),
}

function formatDate(): string {
  const d = new Date()
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
  return `${String(d.getDate()).padStart(2, '0')} DE ${meses[d.getMonth()]} DE ${d.getFullYear()}`
}

function formatYearTag(): string {
  return `${new Date().getFullYear()}, Año de Margarita Maza Parada`
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  if (!text) return ['']
  const paras = text.split('\n')
  const lines: string[] = []
  for (const para of paras) {
    const words = para.split(/\s+/)
    let cur = ''
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && cur) {
        lines.push(cur)
        cur = word
      } else {
        cur = test
      }
    }
    if (cur) lines.push(cur)
  }
  return lines.length > 0 ? lines : ['']
}

function blockHeight(text: string, font: any, fontSize: number, maxWidth: number, lh: number): number {
  if (!text) return 0
  const lines = wrapText(text, font, fontSize, maxWidth)
  return lines.length * fontSize * lh
}

function drawTextBlock(page: any, text: string, font: any, fontSize: number, x: number, y: number, maxWidth: number, lh: number): number {
  const lines = wrapText(text, font, fontSize, maxWidth)
  let dy = y
  for (const line of lines) {
    page.drawText(line, { x, y: dy, size: fontSize, font, color: COLOR.black })
    dy -= fontSize * lh
  }
  return lines.length * fontSize * lh
}

function drawTableRow(page: any, font: any, cells: string[], colWidths: number[], rowH: number, x: number, y: number, fillColor?: any) {
  let cx = x
  for (let i = 0; i < cells.length; i++) {
    const cw = colWidths[i]
    if (fillColor) {
      page.drawRectangle({ x: cx, y: y - rowH, width: cw, height: rowH, color: fillColor })
    }
    page.drawRectangle({ x: cx, y: y - rowH, width: cw, height: rowH, borderColor: COLOR.black, borderWidth: 0.5 })
    const pad = 4 / 2.54 * PTS_PER_CM
    drawTextBlock(page, cells[i], font, FONT_SIZES.table, cx + pad, y - pad - (rowH - pad * 2 - FONT_SIZES.table * LINE_H.table) / 2, cw - pad * 2, LINE_H.table)
    cx += cw
  }
}

const CONTACTOS = [
  { area: 'Atención Ciudadana de la SEMOVINFRA', telefono: '222 309 4400 Ext. 5776 y 5744' },
  { area: 'Secretaría Particular', telefono: '222 309 4400 Ext. 5657' },
  { area: 'Subsecretaría de Infraestructura', telefono: '222 309 4400 Ext. 5678' },
  { area: 'Subsecretaría de Movilidad y Seguridad Vial', telefono: '222 309 4400 Ext. 6014' },
  { area: 'Dirección General de Planeación y Proyectos', telefono: '222 309 4400 Ext. 5787' },
  { area: 'Dirección Jurídica', telefono: '222 309 4400 Ext. 5693' },
]

export async function generarOficioPDF(solicitud: Solicitud): Promise<void> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let letterheadImg = null
  try {
    const resp = await fetch('/src/assets/letterhead.jpg')
    const buf = await resp.arrayBuffer()
    letterheadImg = await pdfDoc.embedJpg(buf)
  } catch { /* continue without background */ }

  const GAP = { h1: 12, table: 5.1, p: 3.7 }

  const colW = Array(4).fill(CONTENT_W / 4)
  const colLabels = ['OFICIO RECIBIDO', 'SOLICITUD', 'FOLIO ST', 'OFICIO DE RESPUESTA Y/O SEGUIMIENTO']

  function addPageWithBg() {
    const p = pdfDoc.addPage([PAGE_W, PAGE_H])
    if (letterheadImg) {
      p.drawImage(letterheadImg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
    }
    return p
  }

  function drawFooter(p: any) {
    const fy = BOTTOM_LIMIT + 0.05 * PTS_PER_CM
    const footerX = 12.99 * PTS_PER_CM
    const footerLines = [
      'GOBIERNO DE LA CIUDAD 2024 - 2027',
      'TEL +52 (222) 309 46 00 EXT. 5748',
      'PROL. REFORMA #3308, COL. AMOR, C.P. 72140',
      'PUEBLA, PUE., MÉXICO',
    ]
    let dy = fy + (2.75 * PTS_PER_CM)
    for (const line of footerLines) {
      p.drawText(line, { x: footerX, y: dy, size: FONT_SIZES.footer, font, color: COLOR.footerText })
      dy -= FONT_SIZES.footer * 1.5
    }
  }

  let page = addPageWithBg()
  drawFooter(page)
  let isFirst = true
  let y = PAGE_H - TOP_P1

  function ensureSpace(needPts: number) {
    if (y - needPts < BOTTOM_LIMIT) {
      page = addPageWithBg()
      drawFooter(page)
      isFirst = false
      y = PAGE_H - TOP_CONT
    }
  }

  const hx = LEFT

  // HEADER
  ensureSpace(FONT_SIZES.year * 1.2 + FONT_SIZES.oficioNum * 1.2 + GAP.h1)
  page.drawText(`"${formatYearTag()}"`, { x: hx, y, size: FONT_SIZES.year, font, color: COLOR.gray })
  y -= FONT_SIZES.year * 1.2

  const oficioNum = `OFICIO Núm. SEMOVINFRA-${solicitud.folio_unico}/2026`
  page.drawText(oficioNum, { x: hx, y, size: FONT_SIZES.oficioNum, font: fontBold, color: COLOR.gray })
  y -= FONT_SIZES.oficioNum * 1.2 + GAP.h1

  // DESTINATARIO
  const destinatario = solicitud.nombre_solicitante.toUpperCase()
  const destH = blockHeight(destinatario, font, FONT_SIZES.destinatario, CONTENT_W * 0.7, LINE_H.cuerpo)
  ensureSpace(destH)
  drawTextBlock(page, destinatario, font, FONT_SIZES.destinatario, hx, y, CONTENT_W * 0.7, LINE_H.cuerpo)
  y -= destH

  // CARGO (placeholder)
  const cargo = 'CIUDADANO(A)'
  const cargoH = blockHeight(cargo, fontBold, FONT_SIZES.destinatario, CONTENT_W * 0.7, LINE_H.cuerpo)
  ensureSpace(cargoH)
  drawTextBlock(page, cargo, fontBold, FONT_SIZES.destinatario, hx, y, CONTENT_W * 0.7, LINE_H.cuerpo)
  y -= cargoH

  // PRESENTE
  ensureSpace(FONT_SIZES.destinatario * LINE_H.cuerpo)
  page.drawText('P R E S E N T E', { x: hx, y, size: FONT_SIZES.destinatario, font: fontBold, color: COLOR.black })
  y -= FONT_SIZES.destinatario * LINE_H.cuerpo + 18 / 2.54 * PTS_PER_CM

  // FUNDAMENTO
  const fundamento = `Con fundamento en lo dispuesto por los artículos 8 de la Constitución Política de los Estados Unidos Mexicanos; 3, 4, 5, 6 fracción I.2 y 12 fracción I, IV y X del Reglamento Interior de la Secretaría de Movilidad e Infraestructura del Honorable Ayuntamiento del Municipio de Puebla, por este medio respetuosamente me permito informarle que sus solicitudes han sido remitidas a las áreas correspondientes para su análisis, programación y en su caso atención de las mismas.`
  const fundH = blockHeight(fundamento, font, FONT_SIZES.fundamento, CONTENT_W, LINE_H.cuerpo)
  ensureSpace(fundH)
  drawTextBlock(page, fundamento, font, FONT_SIZES.fundamento, hx, y, CONTENT_W, LINE_H.cuerpo)
  y -= fundH + GAP.table

  // TABLE
  const rowData = [
    solicitud.fecha_creacion
      ? new Date(solicitud.fecha_creacion).toLocaleDateString('es-MX')
      : '—',
    solicitud.tipo_solicitud,
    solicitud.folio_unico || '—',
    solicitud.estatus_fase || '—',
  ]

  const theadH = FONT_SIZES.table * LINE_H.table + 12 / 2.54 * PTS_PER_CM
  ensureSpace(theadH)
  drawTableRow(page, fontBold, colLabels, colW, theadH, hx, y, COLOR.headerBg)
  y -= theadH

  let rowH = FONT_SIZES.table * LINE_H.table + 8 / 2.54 * PTS_PER_CM
  const pad = 8 / 2.54 * PTS_PER_CM
  for (let i = 0; i < 4; i++) {
    const cellW = colW[i] - pad * 2
    const h = blockHeight(rowData[i], font, FONT_SIZES.table, cellW, LINE_H.table) + pad * 2
    rowH = Math.max(rowH, h)
  }
  ensureSpace(rowH)
  drawTableRow(page, font, rowData, colW, rowH, hx, y, null)
  y -= rowH + GAP.table

  // COMPROMISO
  const compromiso = 'Reiteramos nuestro compromiso de trabajar en beneficio de la comunidad, asegurando que los recursos sean utilizados de manera óptima para la mejora de la infraestructura urbana.'
  const compH = blockHeight(compromiso, font, FONT_SIZES.cuerpo, CONTENT_W, LINE_H.cuerpo)
  ensureSpace(compH)
  drawTextBlock(page, compromiso, font, FONT_SIZES.cuerpo, hx, y, CONTENT_W, LINE_H.cuerpo)
  y -= compH + GAP.p

  // CONTACTO
  const contacto = 'Asimismo, se informa que esta Secretaría se encuentra a su disposición para contribuir en la atención a la ciudadanía, dentro de las facultades conferidas por su reglamento. En razón de lo antes expuesto, y con el objetivo de facilitar la colaboración, se proporcionan los siguientes números de contacto de la dependencia:'
  const contactH = blockHeight(contacto, font, FONT_SIZES.cuerpo, CONTENT_W, LINE_H.cuerpo)
  ensureSpace(contactH)
  drawTextBlock(page, contacto, font, FONT_SIZES.cuerpo, hx, y, CONTENT_W, LINE_H.cuerpo)
  y -= contactH + GAP.p

  // CONTACTS TABLE
  const cpad = 4 / 2.54 * PTS_PER_CM
  const ctheadH = FONT_SIZES.table * LINE_H.table + cpad * 2
  const ctW = CONTENT_W / 2
  let ctH = ctheadH
  for (const c of CONTACTOS) {
    const tH = Math.max(
      blockHeight(c.area, font, 10, ctW - cpad * 2, LINE_H.table) + cpad * 2,
      blockHeight(c.telefono, font, 10, ctW - cpad * 2, LINE_H.table) + cpad * 2,
      10 * LINE_H.table + cpad * 2
    )
    ctH += tH
  }
  if (CONTACTOS.length > 0) {
    ensureSpace(ctH)
    page.drawRectangle({ x: hx, y: y - ctheadH, width: ctW, height: ctheadH, color: COLOR.headerBg })
    page.drawRectangle({ x: hx + ctW, y: y - ctheadH, width: ctW, height: ctheadH, color: COLOR.headerBg })
    page.drawRectangle({ x: hx, y: y - ctheadH, width: ctW, height: ctheadH, borderColor: COLOR.black, borderWidth: 0.5 })
    page.drawRectangle({ x: hx + ctW, y: y - ctheadH, width: ctW, height: ctheadH, borderColor: COLOR.black, borderWidth: 0.5 })
    page.drawText('ÁREA', { x: hx + cpad, y: y - cpad - (ctheadH - cpad * 2 - FONT_SIZES.table * LINE_H.table) / 2, size: FONT_SIZES.table, font: fontBold, color: COLOR.black })
    page.drawText('Número de contacto', { x: hx + ctW + cpad, y: y - cpad - (ctheadH - cpad * 2 - FONT_SIZES.table * LINE_H.table) / 2, size: FONT_SIZES.table, font: fontBold, color: COLOR.black })
    y -= ctheadH

    for (const c of CONTACTOS) {
      const cRowH = Math.max(
        blockHeight(c.area, font, 10, ctW - cpad * 2, LINE_H.table) + cpad * 2,
        blockHeight(c.telefono, font, 10, ctW - cpad * 2, LINE_H.table) + cpad * 2,
        10 * LINE_H.table + cpad * 2
      )
      ensureSpace(cRowH)
      page.drawRectangle({ x: hx, y: y - cRowH, width: ctW, height: cRowH, borderColor: COLOR.black, borderWidth: 0.5 })
      page.drawRectangle({ x: hx + ctW, y: y - cRowH, width: ctW, height: cRowH, borderColor: COLOR.black, borderWidth: 0.5 })
      const aY = y - cpad - (cRowH - cpad * 2 - FONT_SIZES.table * LINE_H.table) / 2
      drawTextBlock(page, c.area, font, 10, hx + cpad, aY, ctW - cpad * 2, LINE_H.table)
      drawTextBlock(page, c.telefono, font, 10, hx + ctW + cpad, aY, ctW - cpad * 2, LINE_H.table)
      y -= cRowH
    }
    y -= GAP.p
  }

  // CIERRE
  const cierre = 'Sin otro particular, agradezco su atención y reitero mi distinguida consideración.'
  const cierreH = blockHeight(cierre, font, FONT_SIZES.cuerpo, CONTENT_W, LINE_H.cuerpo)
  ensureSpace(cierreH)
  drawTextBlock(page, cierre, font, FONT_SIZES.cuerpo, hx, y, CONTENT_W, LINE_H.cuerpo)
  y -= cierreH + GAP.p

  // FIRMA
  const firmaX = CONTENT_W * 0.35 + LEFT
  const firmaElements = [
    { text: 'ATENTAMENTE', bold: true },
    { text: `CUATRO VECES HEROICA PUEBLA DE ZARAGOZA, A ${formatDate()}`, bold: false },
    { text: '"LA CAPITAL IMPARABLE"', bold: false },
    { text: 'ANA MARÍA VALENCIA PACHECO', bold: true },
    { text: 'SECRETARIA TÉCNICA DE LA SECRETARÍA DE MOVILIDAD E INFRAESTRUCTURA', bold: true },
  ]

  let firmaTotalH = 0
  for (const fe of firmaElements) {
    const h = blockHeight(fe.text, fe.bold ? fontBold : font, FONT_SIZES.firma, CONTENT_W * 0.6, LINE_H.firma)
    firmaTotalH += h + 4 / 2.54 * PTS_PER_CM
  }
  ensureSpace(firmaTotalH)

  for (const fe of firmaElements) {
    const h = blockHeight(fe.text, fe.bold ? fontBold : font, FONT_SIZES.firma, CONTENT_W * 0.6, LINE_H.firma)
    drawTextBlock(page, fe.text, fe.bold ? fontBold : font, FONT_SIZES.firma, firmaX, y, CONTENT_W * 0.6, LINE_H.firma)
    y -= h + 4 / 2.54 * PTS_PER_CM
  }

  // CCP (ghost text at bottom)
  const ccpLines = [
    'Archivo.',
    'c.c.p. Julio César Gil Torres- Director Jurídico de la SEMOVINFRA-para su conocimiento-Presente.',
    'AAMVP/jol',
  ]
  const ccpText = ccpLines.join('\n')
  const ccpH = blockHeight(ccpText, font, FONT_SIZES.ccp, CONTENT_W, LINE_H.ccp)
  drawTextBlock(page, ccpText, font, FONT_SIZES.ccp, hx, BOTTOM_LIMIT + 0.5 * PTS_PER_CM, CONTENT_W, LINE_H.ccp)

  // Download
  const bytes = await pdfDoc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `oficio_${solicitud.folio_unico}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
