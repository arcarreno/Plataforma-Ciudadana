import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { Solicitud } from '../types/solicitud'
import { getPrecioObra } from '../core/constants'
import { geolocalizarCalle } from './geolocalizarCalle'
import bannerImg from '../assets/ficha-banner.png'
import footerImg from '../assets/ficha-footer.png'

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

async function captureMap(): Promise<string | null> {
  const mapContainer = document.querySelector('.leaflet-container') as HTMLElement | null
  if (!mapContainer) return null
  try {
    const tiles = mapContainer.querySelectorAll('.leaflet-tile-pane img')
    if (tiles.length === 0) return null
    const canvas = document.createElement('canvas')
    const rect = mapContainer.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    for (const tile of Array.from(tiles)) {
      const img = tile as HTMLImageElement
      const style = window.getComputedStyle(img)
      const transform = style.transform || (style as any).webkitTransform
      const match = transform?.match(/translate3d\(([^,]+)px,\s*([^,]+)px/)
      if (match) {
        ctx.drawImage(img, parseFloat(match[1]), parseFloat(match[2]))
      }
    }
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    return null
  }
}

function buildFichaHTML(
  solicitud: Solicitud,
  mapDataUrl: string | null,
  calleParam: string,
  entreCallesParam: string,
): string {
  const largo = solicitud.distancia_tramo_m ?? 0
  const ancho = solicitud.ancho_calle_m ?? 0
  const intervencion = Math.round(largo * ancho)
  const costoM2 = getPrecioObra(solicitud.tipo_solicitud)
  const inversion = costoM2 * intervencion

  const escuelas = (solicitud.escuelas_cercanas || []).slice(0, 3)
  const iglesias = (solicitud.iglesias_cercanas || []).slice(0, 3)
  const transportes = (solicitud.transportes_cercanos || []).slice(0, 3)

  const coloniaUpper = solicitud.colonia ? solicitud.colonia.toUpperCase() : ''
  const juntaUpper = solicitud.junta_auxiliar ? solicitud.junta_auxiliar.toUpperCase() : ''
  const tipoObra = solicitud.tipo_solicitud.toUpperCase()

  // Use stored values if available, otherwise use geocoded params
  const calle = solicitud.calle || calleParam
  const entreCalles = solicitud.entre_calles || entreCallesParam

  const googleMapsUrl = `https://maps.google.com/?q=${solicitud.latitud},${solicitud.longitud}`

  return `
    <!-- Banner image (from PPTX) -->
    <div class="ficha-banner"></div>

    <!-- Tipo de obra: raw text, no badge, size 14 -->
    <div class="ficha-tipo-obra">${esc(tipoObra)}</div>

    <!-- Street name: size 30, extracted from geocoding -->
    <div class="ficha-street-text">${esc(calle)}</div>

    <!-- Colonia + Junta: size 12 -->
    <div class="ficha-location-text">
      ${coloniaUpper ? `EN LA COLONIA ${esc(coloniaUpper)}` : ''}
      ${juntaUpper ? `, EN LA JUNTA AUXILIAR ${esc(juntaUpper)}` : ''}
    </div>

    <!-- Entre calles -->
    ${entreCalles ? `<div class="ficha-entre-calles">${esc(entreCalles)}</div>` : ''}

    <!-- Map (left side) -->
    <div class="ficha-map-area">
      ${mapDataUrl
        ? `<img src="${mapDataUrl}" class="ficha-map-img" />`
        : `<div class="ficha-map-ph">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
          </div>`
      }
    </div>

    <!-- Map legend -->
    <div class="ficha-map-legend">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#7D2447"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
      <span>Ubicación</span>
      <a href="${googleMapsUrl}" target="_blank" class="ficha-link">${googleMapsUrl}</a>
    </div>
    <div class="ficha-st-text">ST: ${esc(solicitud.folio_unico || '—')}</div>

    <!-- Right Panel: Datos Técnicos -->
    <div class="ficha-panel">
      <div class="ficha-section">DATOS TÉCNICOS</div>
      <div class="ficha-row">
        <div class="ficha-item">
          <div class="ficha-label">Longitud</div>
          <div class="ficha-val">${largo > 0 ? largo + ' m' : '—'}</div>
        </div>
        <div class="ficha-item">
          <div class="ficha-label">Intervención</div>
          <div class="ficha-val">${intervencion > 0 ? intervencion.toLocaleString('es-MX') + ' m²' : '—'}</div>
        </div>
      </div>
      <div class="ficha-row">
        <div class="ficha-item">
          <div class="ficha-label">Ancho</div>
          <div class="ficha-val">${ancho > 0 ? ancho + ' m' : '—'}</div>
        </div>
      </div>

      <div class="ficha-sep"></div>

      <div class="ficha-section">ENTORNO SOCIAL</div>
      <div class="ficha-row">
        <div class="ficha-item">
          <div class="ficha-label">Escuela(s)</div>
          <div class="ficha-val">${escuelas.length > 0 ? escuelas.length : 'No'}</div>
        </div>
        <div class="ficha-item">
          <div class="ficha-label">Iglesia(s)</div>
          <div class="ficha-val">${iglesias.length > 0 ? iglesias.length : 'No'}</div>
        </div>
      </div>
      <div class="ficha-row">
        <div class="ficha-item">
          <div class="ficha-label">Transporte</div>
          <div class="ficha-val">${transportes.length > 0 ? transportes.slice(0, 2).join(', ') : 'No'}</div>
        </div>
      </div>

      <div class="ficha-sep"></div>

      <div class="ficha-row">
        <div class="ficha-item">
          <div class="ficha-label">Cobertura SOAQPAP</div>
          <div class="ficha-val">${solicitud.cobertura_agua ? 'Agua de Puebla' : 'No'}</div>
        </div>
        <div class="ficha-item">
          <div class="ficha-label">Zona ZAP</div>
          <div class="ficha-val">${solicitud.zona_zap ? 'Si' : 'No'}</div>
        </div>
      </div>

      <div class="ficha-sep"></div>

      <div class="ficha-row">
        <div class="ficha-item full">
          <div class="ficha-label">Junta Auxiliar</div>
          <div class="ficha-val junta">${esc(juntaUpper)}</div>
        </div>
      </div>

      ${escuelas.length > 0 ? `
      <table class="ficha-esc-table">
        <thead><tr><th>CLAVE</th><th>NIVEL</th><th>ALUMNOS</th></tr></thead>
        <tbody>
          ${escuelas.map(e => `<tr><td>${esc(e)}</td><td>—</td><td>—</td></tr>`).join('')}
        </tbody>
      </table>
      ` : ''}

      <div class="ficha-inv">
        <span class="ficha-inv-label">Inversión estimada</span>
        <span class="ficha-inv-val">${inversion > 0 ? fmtMoney(inversion) : '—'}</span>
      </div>
    </div>

    <!-- Footer image (from PPTX) -->
    <div class="ficha-footer-img"></div>
    <div class="ficha-footer-txt">SEMOVINFRA - Atención Ciudadana | Gobierno de la Ciudad 2024-2027</div>
  `
}

function getFichaCSS(): string {
  return `
    .ficha-gen *, .ficha-gen *::before, .ficha-gen *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    .ficha-gen {
      width: 960px;
      height: 720px;
      background: #F5F0EB;
      font-family: 'Poppins', 'Calibri', sans-serif;
      color: #636462;
      position: relative;
      overflow: hidden;
      font-size: 11px;
      line-height: 1.3;
    }

    /* Banner */
    .ficha-gen .ficha-banner {
      position: absolute;
      top: 0; left: 0;
      width: 960px;
      height: 186px;
      background: url('${bannerImg}') no-repeat top left;
      background-size: 960px 186px;
    }

    /* Tipo de obra: raw text, no badge */
    .ficha-gen .ficha-tipo-obra {
      position: absolute;
      top: 34px;
      left: 50px;
      font-size: 14px;
      font-weight: 700;
      color: #FFFFFF;
    }

    /* Street name: size 30 */
    .ficha-gen .ficha-street-text {
      position: absolute;
      top: 56px;
      left: 50px;
      font-size: 30px;
      font-weight: 800;
      color: #FFFFFF;
      max-width: 530px;
      line-height: 1.1;
    }

    /* Colonia + Junta: size 12 */
    .ficha-gen .ficha-location-text {
      position: absolute;
      top: 156px;
      left: 50px;
      font-size: 12px;
      color: #FFFFFF;
      opacity: 0.9;
    }

    /* Entre calles */
    .ficha-gen .ficha-entre-calles {
      position: absolute;
      top: 174px;
      left: 50px;
      font-size: 10px;
      font-weight: 600;
      color: #DBC8B6;
      letter-spacing: 0.3px;
    }

    /* Map */
    .ficha-gen .ficha-map-area {
      position: absolute;
      top: 207px;
      left: 47px;
      width: 444px;
      height: 394px;
      background: #E8E3DE;
      border-radius: 4px;
      overflow: hidden;
    }
    .ficha-gen .ficha-map-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .ficha-gen .ficha-map-ph {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Map legend */
    .ficha-gen .ficha-map-legend {
      position: absolute;
      top: 602px;
      left: 47px;
      width: 444px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 8px;
      background: #F5F0EB;
      font-size: 9px;
      color: #636462;
    }
    .ficha-gen .ficha-link {
      color: #0E94BE;
      text-decoration: none;
      font-size: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ficha-gen .ficha-st-text {
      position: absolute;
      top: 646px;
      left: 47px;
      width: 444px;
      padding: 3px 8px;
      font-size: 9px;
      color: #999;
      background: #F5F0EB;
    }

    /* Right panel */
    .ficha-gen .ficha-panel {
      position: absolute;
      top: 207px;
      right: 34px;
      width: 432px;
    }
    .ficha-gen .ficha-section {
      font-size: 9px;
      font-weight: 700;
      color: #DBC8B6;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }
    .ficha-gen .ficha-row {
      display: flex;
      gap: 12px;
      margin-bottom: 4px;
    }
    .ficha-gen .ficha-item {
      flex: 1;
    }
    .ficha-gen .ficha-item.full {
      flex: none;
      width: 100%;
    }
    .ficha-gen .ficha-label {
      font-size: 8px;
      color: #999;
      line-height: 1.2;
    }
    .ficha-gen .ficha-val {
      font-size: 12px;
      font-weight: 700;
      color: #41504D;
      line-height: 1.2;
    }
    .ficha-gen .ficha-val.junta {
      font-size: 10px;
      color: #DBC8B6;
    }
    .ficha-gen .ficha-sep {
      height: 1px;
      background: #DBC8B6;
      opacity: 0.4;
      margin: 5px 0;
    }

    /* Schools table */
    .ficha-gen .ficha-esc-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 8px;
    }
    .ficha-gen .ficha-esc-table th {
      background: #E7E6E6;
      border: 1px solid #ccc;
      padding: 2px 4px;
      text-align: center;
      font-weight: 400;
      color: #636462;
    }
    .ficha-gen .ficha-esc-table td {
      border: 1px solid #ccc;
      padding: 2px 4px;
      text-align: center;
      font-weight: 700;
      color: #636462;
    }

    /* Inversión */
    .ficha-gen .ficha-inv {
      margin-top: 8px;
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .ficha-gen .ficha-inv-label {
      font-size: 9px;
      color: #999;
    }
    .ficha-gen .ficha-inv-val {
      font-size: 20px;
      font-weight: 700;
      color: #7D2447;
    }

    /* Footer */
    .ficha-gen .ficha-footer-img {
      position: absolute;
      bottom: 14px;
      left: 14px;
      width: 932px;
      height: 12px;
      background: url('${footerImg}') no-repeat bottom left;
      background-size: 932px 12px;
    }
    .ficha-gen .ficha-footer-txt {
      position: absolute;
      bottom: 28px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 7px;
      color: #999;
    }
  `
}

export async function generarFichaPDF(solicitud: Solicitud): Promise<string> {
  const calleInfo = solicitud.calle
    ? { calle: solicitud.calle, entreCalles: solicitud.entre_calles || '' }
    : await geolocalizarCalle(solicitud.latitud, solicitud.longitud)
        .catch(() => ({ calle: '', entreCalles: '' }))
  const [mapDataUrl] = await Promise.all([captureMap()])
  const html = buildFichaHTML(solicitud, mapDataUrl, calleInfo.calle, calleInfo.entreCalles)

  const container = document.createElement('div')
  container.className = 'ficha-gen'
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;'
  document.body.appendChild(container)

  container.innerHTML = `<style>${getFichaCSS()}</style>${html}`

  await document.fonts.ready
  await new Promise(r => setTimeout(r, 300))

  const canvas = await html2canvas(container, {
    scale: 1,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#F5F0EB',
    logging: false,
  })

  // PDF = container size exactly (960×720 px)
  const imgData = canvas.toDataURL('image/jpeg', 0.85)
  const pdfW = canvas.width / 2
  const pdfH = canvas.height / 2

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [pdfW, pdfH],
    hotfixes: ['px_scaling'],
  })

  pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)

  document.body.removeChild(container)

  const blob = pdf.output('blob')
  return URL.createObjectURL(blob)
}
