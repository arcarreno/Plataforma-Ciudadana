import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { Solicitud } from '../types/solicitud'
import letterhead from '../assets/letterhead.jpg'

const CONTACTOS = [
  { area: 'Atención Ciudadana de la SEMOVINFRA', telefono: '222 309 4400 Ext. 5776 y 5744' },
  { area: 'Secretaría Particular', telefono: '222 309 4400 Ext. 5657' },
  { area: 'Subsecretaría de Infraestructura', telefono: '222 309 4400 Ext. 5678' },
  { area: 'Subsecretaría de Movilidad y Seguridad Vial', telefono: '222 309 4400 Ext. 6014' },
  { area: 'Dirección General de Planeación y Proyectos', telefono: '222 309 4400 Ext. 5787' },
  { area: 'Dirección Jurídica', telefono: '222 309 4400 Ext. 5693' },
]

function formatDate(): string {
  const d = new Date()
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
  return `${String(d.getDate()).padStart(2, '0')} DE ${meses[d.getMonth()]} DE ${d.getFullYear()}`
}

function formatYearTag(): string {
  return `${new Date().getFullYear()}, Año de Margarita Maza Parada`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildOficioHTML(solicitud: Solicitud): { page1: string; page2: string } {
  const fecha = solicitud.fecha_creacion
    ? new Date(solicitud.fecha_creacion).toLocaleDateString('es-MX')
    : '—'

  const contactosRows = CONTACTOS.map(c => `
    <tr>
      <td>${escapeHtml(c.area)}</td>
      <td>${escapeHtml(c.telefono)}</td>
    </tr>`).join('')

  const page1 = `
    <div class="oficio-header">
      <div class="header-year">${escapeHtml(formatYearTag())}</div>
      <div class="header-oficio-num">OFICIO Núm. SEMOVINFRA-${escapeHtml(solicitud.folio_unico || '')}/2026</div>
    </div>
    <div class="oficio-body">
      <div class="destinatario-line">${escapeHtml(solicitud.nombre_solicitante.toUpperCase())}</div>
      <div class="destinatario-line cargo-line">CIUDADANO(A)</div>
      <div class="destinatario-line presente-line">P R E S E N T E</div>
      <div class="texto-cuerpo">
        <p>Con fundamento en lo dispuesto por los artículos 8 de la Constitución Política de los Estados Unidos Mexicanos; 3, 4, 5, 6 fracción I.2 y 12 fracción I, IV y X del Reglamento Interior de la Secretaría de Movilidad e Infraestructura del Honorable Ayuntamiento del Municipio de Puebla, por este medio respetuosamente me permito informarle que sus solicitudes han sido remitidas a las áreas correspondientes para su análisis, programación y en su caso atención de las mismas.</p>
      </div>
      <table class="tabla-oficio">
        <thead>
          <tr>
            <th>N° Control</th>
            <th>Solicitud/Petición</th>
            <th>Oficio Recibido</th>
            <th>Turnado A:</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(solicitud.folio_unico || '—')}</td>
            <td>${escapeHtml(solicitud.tipo_solicitud)}</td>
            <td>${escapeHtml(fecha)}</td>
            <td>${escapeHtml(solicitud.estatus_fase || '—')}</td>
          </tr>
        </tbody>
      </table>
      <div class="texto-cuerpo">
        <p>Reiteramos nuestro compromiso de trabajar en beneficio de la comunidad, asegurando que los recursos sean utilizados de manera óptima para la mejora de la infraestructura urbana.</p>
      </div>
      <div class="texto-cuerpo">
        <p>Asimismo, se informa que esta Secretaría se encuentra a su disposición para contribuir en la atención a la ciudadanía, dentro de las facultades conferidas por su reglamento. En razón de lo antes expuesto, y con el objetivo de facilitar la colaboración, se proporcionan los siguientes números de contacto de la dependencia:</p>
      </div>
    </div>`

  const page2 = `
    <table class="tabla-contactos">
      <thead>
        <tr>
          <th>ÁREA</th>
          <th>Número de contacto</th>
        </tr>
      </thead>
      <tbody>
        ${contactosRows}
      </tbody>
    </table>
    <div class="texto-cuerpo">
      <p>Sin otro particular, agradezco su atención y reitero mi distinguida consideración.</p>
    </div>
    <div class="oficio-firma">
      <div class="firma-atentamente">ATENTAMENTE</div>
      <div class="firma-ciudad">CUATRO VECES HEROICA PUEBLA DE ZARAGOZA, A ${escapeHtml(formatDate())}</div>
      <div class="firma-lema">"LA CAPITAL IMPARABLE"</div>
      <div class="firma-nombre">ANA MARÍA VALENCIA PACHECO</div>
      <div class="firma-cargo">SECRETARIA TÉCNICA DE LA SECRETARÍA DE MOVILIDAD E INFRAESTRUCTURA</div>
    </div>
    <div class="oficio-ccp">
      <div>Archivo.</div>
      <div>c.c.p. Julio César Gil Torres- Director Jurídico de la SEMOVINFRA-para su conocimiento-Presente.</div>
      <div>AAMVP/jol</div>
    </div>`

  return { page1, page2 }
}

// ── CSS exacta del Generador_Oficios (App.css) ──
function getOficioCSS(): string {
  return `
    /* Reset */
    .oficio-gen *, .oficio-gen *::before, .oficio-gen *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    .oficio-gen {
      font-family: 'Poppins', 'Calibri', sans-serif;
      color: #000;
      line-height: 1.4;
    }

    /* Page wrapper — 21.6×27.9cm exacto */
    .oficio-gen .oficio-wrapper {
      width: 21.6cm;
      height: 27.9cm;
      background: #fff;
      position: relative;
      overflow: hidden;
      font-family: 'Poppins', 'Calibri', sans-serif;
      background-size: 21.6cm 27.9cm;
      background-repeat: no-repeat;
      background-position: top center;
    }

    /* Overlay translúcido */
    .oficio-gen .oficio-wrapper::after {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.18);
      z-index: 0;
      pointer-events: none;
    }

    /* Content — padding exacto del reference */
    .oficio-gen .oficio-content {
      position: relative;
      z-index: 1;
      padding: 1.5cm 3.0cm 6.5cm;
    }

    /* Header */
    .oficio-gen .oficio-header {
      text-align: right;
      margin-bottom: 32px;
    }
    .oficio-gen .header-year {
      font-size: 9pt;
      font-style: italic;
      color: #000;
      margin-top: 1.6cm;
      opacity: 0.75;
    }
    .oficio-gen .header-oficio-num {
      font-size: 10.5pt;
      font-weight: 700;
      margin-top: 2px;
      opacity: 0.75;
    }

    /* Destinatario */
    .oficio-gen .destinatario-line {
      font-size: 10.5pt;
      margin-bottom: 2px;
      line-height: 1.3;
    }
    .oficio-gen .cargo-line {
      font-weight: 700;
      margin-bottom: 2px;
    }
    .oficio-gen .presente-line {
      font-weight: 700;
      margin-bottom: 18px;
    }

    /* Body text */
    .oficio-gen .texto-cuerpo {
      font-size: 10.5pt;
      text-align: justify;
      line-height: 1.45;
    }
    .oficio-gen .texto-cuerpo p {
      margin-bottom: 10px;
      text-indent: 0.5in;
    }

    /* Table oficio */
    .oficio-gen .tabla-oficio {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 9pt;
    }
    .oficio-gen .tabla-oficio th {
      background: #E7E6E6;
      border: 1px solid #000;
      padding: 6px 8px;
      text-align: center;
      font-weight: 700;
      font-size: 9pt;
    }
    .oficio-gen .tabla-oficio td {
      border: 1px solid #000;
      padding: 4px 8px;
      text-align: center;
      font-size: 9pt;
    }

    /* Table contactos */
    .oficio-gen .tabla-contactos {
      width: 100%;
      border-collapse: collapse;
      margin: 2.54cm 0 14px;
    }
    .oficio-gen .tabla-contactos th {
      background: #E7E6E6;
      border: 1px solid #000;
      padding: 6px 8px;
      text-align: center;
      font-weight: 700;
      font-size: 10pt;
    }
    .oficio-gen .tabla-contactos td {
      border: 1px solid #000;
      padding: 4px 8px;
      text-align: center;
      font-size: 10pt;
    }

    /* Firma */
    .oficio-gen .oficio-firma {
      text-align: center;
      margin-top: 30px;
    }
    .oficio-gen .firma-atentamente {
      font-size: 11pt;
      font-weight: 700;
    }
    .oficio-gen .firma-ciudad {
      font-size: 11pt;
      font-weight: 700;
      margin-top: 2px;
    }
    .oficio-gen .firma-lema {
      font-size: 11pt;
      font-weight: 700;
      font-style: italic;
      margin-top: 2px;
    }
    .oficio-gen .firma-nombre {
      font-size: 11pt;
      font-weight: 700;
      margin-top: 28px;
    }
    .oficio-gen .firma-cargo {
      font-size: 11pt;
      font-weight: 700;
    }

    /* CCP */
    .oficio-gen .oficio-ccp {
      font-size: 7pt;
      margin-top: 24px;
      line-height: 1.4;
    }

    /* Footer — posición fija a 22cm del tope */
    .oficio-gen .oficio-footer {
      position: absolute;
      top: 22cm;
      left: 0;
      width: 100%;
      text-align: left;
      z-index: 1;
      padding: 2.75cm 0 0 12.99cm;
      pointer-events: none;
      opacity: 0.75;
    }
    .oficio-gen .footer-text {
      font-family: 'Poppins', 'Calibri', sans-serif;
      font-size: 8.5pt;
      font-weight: 700;
      color: #ADA37E;
      line-height: 1.5;
    }
  `
}

const FOOTER_HTML = `
  <div class="footer-text">
    GOBIERNO DE LA CIUDAD 2024 - 2027<br/>
    TEL +52 (222) 309 46 00 EXT. 5748<br/>
    PROL. REFORMA #3308, COL. AMOR, C.P. 72140<br/>
    PUEBLA, PUE., MÉXICO
  </div>`

export async function generarOficioPDF(solicitud: Solicitud): Promise<string> {
  const { page1, page2 } = buildOficioHTML(solicitud)

  // Create hidden container
  const container = document.createElement('div')
  container.className = 'oficio-gen'
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;'
  document.body.appendChild(container)

  // Build both pages as separate wrappers (matching reference DOM structure)
  container.innerHTML = `
    <style>${getOficioCSS()}</style>
    <div class="oficio-wrapper" data-page="1" style="background-image:url(${letterhead})">
      <div class="oficio-content">${page1}</div>
      <div class="oficio-footer">${FOOTER_HTML}</div>
    </div>
    <div class="oficio-wrapper" data-page="2" style="background-image:url(${letterhead})">
      <div class="oficio-content">${page2}</div>
      <div class="oficio-footer">${FOOTER_HTML}</div>
    </div>`

  // Wait for fonts + images
  await document.fonts.ready
  await new Promise(r => setTimeout(r, 200))

  const wrapperEls = container.querySelectorAll('.oficio-wrapper') as NodeListOf<HTMLElement>
  const canvases = await Promise.all(
    Array.from(wrapperEls).map(el =>
      html2canvas(el, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      })
    )
  )

  // Build PDF — Letter size matching reference (612x792 pts)
  const firstCanvas = canvases[0]
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [firstCanvas.width / 2, firstCanvas.height / 2],
    hotfixes: ['px_scaling'],
  })

  canvases.forEach((canvas, i) => {
    const imgData = canvas.toDataURL('image/jpeg', 0.85)
    const w = canvas.width / 2
    const h = canvas.height / 2
    if (i > 0) pdf.addPage([w, h])
    pdf.addImage(imgData, 'PNG', 0, 0, w, h)
  })

  // Cleanup
  document.body.removeChild(container)

  const blob = pdf.output('blob')
  return URL.createObjectURL(blob)
}
