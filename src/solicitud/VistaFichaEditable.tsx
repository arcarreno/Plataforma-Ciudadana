import { useState, useRef } from 'react'
import DOMPurify from 'dompurify'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import type { Solicitud } from '../types/solicitud'
import { getPrecioObra } from '../core/constants'
import bannerImg from '../assets/ficha-banner.png'
import footerImg from '../assets/ficha-footer.png'

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

interface Props {
  solicitud: Solicitud
  mapDataUrl: string | null
  onClose: () => void
}

export default function VistaFichaEditable({ solicitud: s, mapDataUrl, onClose }: Props) {
  const [largo, setLargo] = useState(s.distancia_tramo_m ?? 0)
  const [ancho, setAncho] = useState(s.ancho_calle_m ?? 0)
  const [tipoObra, setTipoObra] = useState(s.tipo_solicitud)
  const [calle, setCalle] = useState(s.calle || '')
  const [entreCalles, setEntreCalles] = useState(s.entre_calles || '')
  const [colonia, setColonia] = useState(s.colonia || '')
  const [juntaAux] = useState(s.junta_auxiliar || '')
  const [escuelas, setEscuelas] = useState((s.escuelas_cercanas || []).join(', '))
  const [iglesias, setIglesias] = useState((s.iglesias_cercanas || []).join(', '))
  const [transportes, setTransportes] = useState((s.transportes_cercanos || []).join(', '))
  const [coberturaAgua, setCoberturaAgua] = useState(s.cobertura_agua ?? false)
  const [zonaZap, setZonaZap] = useState(s.zona_zap ?? false)

  const [exporting, setExporting] = useState(false)
  const fichaRef = useRef<HTMLDivElement>(null)

  const intervencion = Math.round(largo * ancho)
  const costoM2 = getPrecioObra(tipoObra)
  const inversion = costoM2 * intervencion

  const escuelasList = escuelas.split(',').map(e => e.trim()).filter(Boolean).slice(0, 3)

  const coloniaUpper = colonia.toUpperCase()
  const juntaUpper = juntaAux.toUpperCase()
  const tipoObraUpper = tipoObra.toUpperCase()
  const googleMapsUrl = `https://maps.google.com/?q=${s.latitud},${s.longitud}`

  const handleExportPdf = async () => {
    if (!fichaRef.current) return
    setExporting(true)
    try {
      const canvas = await html2canvas(fichaRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#F5F0EB',
        logging: false,
      })
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
      pdf.save(`Ficha_tecnica_${s.folio_unico}.pdf`)
    } catch (err) {
      console.error('Error al exportar Ficha PDF:', err)
    }
    setExporting(false)
  }

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-[#eaeaea]">
      {/* Toolbar */}
      <div className="flex items-center justify-center px-4 py-3">
        <div className="flex items-center gap-2 rounded-full border border-white/25 bg-white/80 px-4 py-2 shadow-lg backdrop-blur-md">
          <button className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300" onClick={onClose}>← Volver</button>
          <div className="mx-1 h-6 w-px bg-black/10" />
          <button className="rounded-full bg-guinda px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-guinda/90 disabled:opacity-50" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? 'PDF...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Ficha container */}
      <div className="flex flex-1 items-start justify-center overflow-y-auto p-8">
        <div ref={fichaRef} className="ficha-gen">
          {/* Banner */}
          <div className="ficha-banner" />

          {/* Tipo de obra */}
          <div className="ficha-tipo-obra" contentEditable suppressContentEditableWarning
            onBlur={e => setTipoObra(DOMPurify.sanitize(e.currentTarget?.innerHTML ?? ''))}
            dangerouslySetInnerHTML={{ __html: esc(tipoObraUpper) }} />

          {/* Street */}
          <div className="ficha-street-text" contentEditable suppressContentEditableWarning
            onBlur={e => setCalle(DOMPurify.sanitize(e.currentTarget?.innerHTML ?? ''))}
            dangerouslySetInnerHTML={{ __html: esc(calle) }} />

          {/* Colonia + Junta */}
          <div className="ficha-location-text" contentEditable suppressContentEditableWarning
            onBlur={e => {
              const html = DOMPurify.sanitize(e.currentTarget?.innerHTML ?? '')
              setColonia(html)
            }}
            dangerouslySetInnerHTML={{ __html: coloniaUpper ? `EN LA COLONIA ${esc(coloniaUpper)}${juntaUpper ? `, EN LA JUNTA AUXILIAR ${esc(juntaUpper)}` : ''}` : juntaUpper ? `EN LA JUNTA AUXILIAR ${esc(juntaUpper)}` : '' }} />

          {/* Entre calles */}
          {entreCalles && (
            <div className="ficha-entre-calles" contentEditable suppressContentEditableWarning
              onBlur={e => setEntreCalles(DOMPurify.sanitize(e.currentTarget?.innerHTML ?? ''))}
              dangerouslySetInnerHTML={{ __html: esc(entreCalles) }} />
          )}

          {/* Map */}
          <div className="ficha-map-area">
            {mapDataUrl
              ? <img src={mapDataUrl} className="ficha-map-img" alt="Mapa" />
              : <div className="ficha-map-ph">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                </div>
            }
          </div>

          {/* Map legend */}
          <div className="ficha-map-legend">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#7D2447"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <span>Ubicación</span>
            <a href={googleMapsUrl} target="_blank" className="ficha-link" rel="noreferrer">{googleMapsUrl}</a>
          </div>
          <div className="ficha-st-text">ST: {esc(s.folio_unico || '—')}</div>

          {/* Right Panel: Datos Técnicos */}
          <div className="ficha-panel">
            <div className="ficha-section">DATOS TÉCNICOS</div>
            <div className="ficha-row">
              <div className="ficha-item">
                <div className="ficha-label">Longitud (m)</div>
                <input type="number" value={largo} onChange={e => setLargo(Number(e.target.value) || 0)}
                  className="ficha-input" min={0} step={1} />
              </div>
              <div className="ficha-item">
                <div className="ficha-label">Intervención</div>
                <div className="ficha-val">{intervencion > 0 ? intervencion.toLocaleString('es-MX') + ' m²' : '—'}</div>
              </div>
            </div>
            <div className="ficha-row">
              <div className="ficha-item">
                <div className="ficha-label">Ancho (m)</div>
                <input type="number" value={ancho} onChange={e => setAncho(Number(e.target.value) || 0)}
                  className="ficha-input" min={0} step={0.1} />
              </div>
            </div>

            <div className="ficha-sep" />

            <div className="ficha-section">ENTORNO SOCIAL</div>
            <div className="ficha-row">
              <div className="ficha-item">
                <div className="ficha-label">Escuela(s)</div>
                <input type="text" value={escuelas} onChange={e => setEscuelas(e.target.value)}
                  className="ficha-input" placeholder="Separar por comas" />
              </div>
              <div className="ficha-item">
                <div className="ficha-label">Iglesia(s)</div>
                <input type="text" value={iglesias} onChange={e => setIglesias(e.target.value)}
                  className="ficha-input" placeholder="Separar por comas" />
              </div>
            </div>
            <div className="ficha-row">
              <div className="ficha-item">
                <div className="ficha-label">Transporte</div>
                <input type="text" value={transportes} onChange={e => setTransportes(e.target.value)}
                  className="ficha-input" placeholder="Separar por comas" />
              </div>
            </div>

            <div className="ficha-sep" />

            <div className="ficha-row">
              <div className="ficha-item">
                <div className="ficha-label">Cobertura SOAQPAP</div>
                <select value={coberturaAgua ? 'si' : 'no'} onChange={e => setCoberturaAgua(e.target.value === 'si')}
                  className="ficha-select">
                  <option value="si">Agua de Puebla</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="ficha-item">
                <div className="ficha-label">Zona ZAP</div>
                <select value={zonaZap ? 'si' : 'no'} onChange={e => setZonaZap(e.target.value === 'si')}
                  className="ficha-select">
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>

            <div className="ficha-sep" />

            <div className="ficha-row">
              <div className="ficha-item full">
                <div className="ficha-label">Junta Auxiliar</div>
                <div className="ficha-val junta">{esc(juntaUpper)}</div>
              </div>
            </div>

            {escuelasList.length > 0 && (
              <table className="ficha-esc-table">
                <thead><tr><th>CLAVE</th><th>NIVEL</th><th>ALUMNOS</th></tr></thead>
                <tbody>
                  {escuelasList.map((e, i) => (
                    <tr key={i}>
                      <td contentEditable suppressContentEditableWarning>{esc(e)}</td>
                      <td contentEditable suppressContentEditableWarning>—</td>
                      <td contentEditable suppressContentEditableWarning>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="ficha-inv">
              <span className="ficha-inv-label">Inversión estimada</span>
              <span className="ficha-inv-val">{inversion > 0 ? fmtMoney(inversion) : '—'}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="ficha-footer-img" />
          <div className="ficha-footer-txt">SEMOVINFRA - Atención Ciudadana | Gobierno de la Ciudad 2024-2027</div>
        </div>
      </div>

      <style>{`
        .ficha-gen, .ficha-gen *::before, .ficha-gen *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        .ficha-gen {
          width: 960px;
          min-height: 720px;
          background: #F5F0EB;
          font-family: 'Poppins', 'Calibri', sans-serif;
          color: #636462;
          position: relative;
          overflow: hidden;
          font-size: 11px;
          line-height: 1.3;
          box-shadow: 0 4px 20px rgba(0,0,0,0.12);
        }
        .ficha-banner {
          position: absolute; top: 0; left: 0;
          width: 960px; height: 186px;
          background: url('${bannerImg}') no-repeat top left;
          background-size: 960px 186px;
        }
        .ficha-tipo-obra {
          position: absolute; top: 34px; left: 50px;
          font-size: 14px; font-weight: 700; color: #FFFFFF;
        }
        .ficha-tipo-obra[contenteditable]:hover,
        .ficha-tipo-obra[contenteditable]:focus {
          outline: 1px dashed rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.1);
        }
        .ficha-street-text {
          position: absolute; top: 56px; left: 50px;
          font-size: 30px; font-weight: 800; color: #FFFFFF;
          max-width: 530px; line-height: 1.1;
        }
        .ficha-street-text[contenteditable]:hover,
        .ficha-street-text[contenteditable]:focus {
          outline: 1px dashed rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.1);
        }
        .ficha-location-text {
          position: absolute; top: 156px; left: 50px;
          font-size: 12px; color: #FFFFFF; opacity: 0.9;
        }
        .ficha-location-text[contenteditable]:hover,
        .ficha-location-text[contenteditable]:focus {
          outline: 1px dashed rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.1);
        }
        .ficha-entre-calles {
          position: absolute; top: 174px; left: 50px;
          font-size: 10px; font-weight: 600; color: #DBC8B6; letter-spacing: 0.3px;
        }
        .ficha-entre-calles[contenteditable]:hover,
        .ficha-entre-calles[contenteditable]:focus {
          outline: 1px dashed rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.1);
        }
        .ficha-map-area {
          position: absolute; top: 207px; left: 47px;
          width: 444px; height: 394px;
          background: #E8E3DE; border-radius: 4px; overflow: hidden;
        }
        .ficha-map-img { width: 100%; height: 100%; object-fit: cover; }
        .ficha-map-ph {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
        }
        .ficha-map-legend {
          position: absolute; top: 602px; left: 47px;
          width: 444px; display: flex; align-items: center; gap: 6px;
          padding: 5px 8px; background: #F5F0EB;
          font-size: 9px; color: #636462;
        }
        .ficha-link { color: #0E94BE; text-decoration: none; font-size: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ficha-st-text {
          position: absolute; top: 646px; left: 47px;
          width: 444px; padding: 3px 8px;
          font-size: 9px; color: #999; background: #F5F0EB;
        }
        .ficha-panel {
          position: absolute; top: 207px; right: 34px;
          width: 432px;
        }
        .ficha-section {
          font-size: 9px; font-weight: 700; color: #DBC8B6;
          margin-bottom: 4px; letter-spacing: 0.5px;
        }
        .ficha-row { display: flex; gap: 12px; margin-bottom: 4px; }
        .ficha-item { flex: 1; }
        .ficha-item.full { flex: none; width: 100%; }
        .ficha-label { font-size: 8px; color: #999; line-height: 1.2; }
        .ficha-val { font-size: 12px; font-weight: 700; color: #41504D; line-height: 1.2; }
        .ficha-val.junta { font-size: 10px; color: #DBC8B6; }
        .ficha-sep { height: 1px; background: #DBC8B6; opacity: 0.4; margin: 5px 0; }
        .ficha-input, .ficha-select {
          width: 100%;
          padding: 2px 4px;
          font-size: 12px;
          font-weight: 700;
          color: #41504D;
          background: #fff;
          border: 1px solid #DBC8B6;
          border-radius: 4px;
          outline: none;
          font-family: 'Poppins', 'Calibri', sans-serif;
        }
        .ficha-input:focus, .ficha-select:focus {
          border-color: #7D2447;
          box-shadow: 0 0 0 2px rgba(125,36,71,0.15);
        }
        .ficha-esc-table {
          width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 8px;
        }
        .ficha-esc-table th {
          background: #E7E6E6; border: 1px solid #ccc;
          padding: 2px 4px; text-align: center; font-weight: 400; color: #636462;
        }
        .ficha-esc-table td {
          border: 1px solid #ccc; padding: 2px 4px;
          text-align: center; font-weight: 700; color: #636462;
        }
        .ficha-esc-table td[contenteditable]:hover,
        .ficha-esc-table td[contenteditable]:focus {
          outline: 1px dashed #7d2447;
          background: #f5eef2;
        }
        .ficha-inv { margin-top: 8px; display: flex; align-items: baseline; gap: 8px; }
        .ficha-inv-label { font-size: 9px; color: #999; }
        .ficha-inv-val { font-size: 20px; font-weight: 700; color: #7D2447; }
        .ficha-footer-img {
          position: absolute; bottom: 14px; left: 14px;
          width: 932px; height: 12px;
          background: url('${footerImg}') no-repeat bottom left;
          background-size: 932px 12px;
        }
        .ficha-footer-txt {
          position: absolute; bottom: 28px; left: 0; right: 0;
          text-align: center; font-size: 7px; color: #999;
        }
      `}</style>
    </div>
  )
}
