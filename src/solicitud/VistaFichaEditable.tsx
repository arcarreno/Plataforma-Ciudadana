import { useState, useRef } from 'react'
import DOMPurify from 'dompurify'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet'
import L from 'leaflet'
import { School, Church, Bus, Droplets, MapPin } from 'lucide-react'
import type { Solicitud } from '../types/solicitud'
import type { SigedEscuela } from '../lib/consultarSIGED'
import bannerImg from '../assets/ficha-banner.png'
import footerImg from '../assets/ficha-footer.png'

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function brAt58(text: string): string {
  return text.length > 58 ? text.slice(0, 58) + '<br>' + text.slice(58) : text
}

function shortRoute(r: string): string {
  const idx = r.indexOf('-')
  return idx > 0 ? r.slice(0, idx).trim() : r.trim()
}


interface Props {
  solicitud: Solicitud
  sigedData?: SigedEscuela | null
}

export default function VistaFichaEditable({ solicitud: s, sigedData }: Props) {
  const [largo, setLargo] = useState(s.distancia_tramo_m ?? 0)
  const [ancho, setAncho] = useState(s.ancho_calle_m ?? 0)
  const [tipoObra, setTipoObra] = useState(s.tipo_solicitud)
  const [calle, setCalle] = useState(s.calle || '')
  const [entreCalles, setEntreCalles] = useState(s.entre_calles || '')
  const [colonia, setColonia] = useState(s.colonia || '')
  const [juntaAux] = useState(s.junta_auxiliar || '')
  const iglesiasStr = (s.iglesias_cercanas || []).join(', ')
  const transportesStr = (s.transportes_cercanos || []).join(', ')
  const coberturaAgua = s.cobertura_agua ?? false
  const zonaZap = s.zona_zap ?? false

  const [exporting, setExporting] = useState(false)
  const fichaRef = useRef<HTMLDivElement>(null)
  const [escuelasCct, setEscuelasCct] = useState<string[]>(() => {
    const raw = (s.escuelas_cercanas || []).map(c => c.trim().toUpperCase()).filter(Boolean).slice(0, 3)
    return [...new Set(raw)]
  })

  const intervencion = Math.round(largo * ancho)

  const iglesiasList = iglesiasStr.split(',').map(e => e.trim()).filter(Boolean).slice(0, 3)
  const transportesList = transportesStr.split(',').map(e => e.trim()).filter(Boolean).slice(0, 3)

  const removeEscuelaRow = (cct: string) => {
    setEscuelasCct(prev => prev.filter(c => c !== cct))
  }
  const clearEscuelas = () => setEscuelasCct([])

  const coloniaUpper = colonia.toUpperCase()
  const juntaUpper = juntaAux.toUpperCase()
  const tipoObraUpper = tipoObra.toUpperCase()
  const googleMapsUrl = `https://maps.google.com/?q=${s.latitud},${s.longitud}`

  const tramoPuntos = (s.tramo_puntos && s.tramo_puntos.length >= 2)
    ? s.tramo_puntos
    : (s.tramo_lat_ini != null && s.tramo_lng_ini != null && s.tramo_lat_fin != null && s.tramo_lng_fin != null
        ? [{ lat: s.tramo_lat_ini, lng: s.tramo_lng_ini }, { lat: s.tramo_lat_fin, lng: s.tramo_lng_fin }]
        : null)
  const hasTramo = tramoPuntos != null
  const mapCenter = hasTramo
    ? [tramoPuntos!.reduce((s, p) => s + p.lat, 0) / tramoPuntos!.length, tramoPuntos!.reduce((s, p) => s + p.lng, 0) / tramoPuntos!.length] as [number, number]
    : [s.latitud, s.longitud] as [number, number]

  const markerIcon1 = L.divIcon({ className: '', html: '<div style="width:20px;height:20px;border-radius:50%;background:#7d2447;color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">1</div>', iconSize: [20, 20], iconAnchor: [10, 10] })
  const markerIcon2 = L.divIcon({ className: '', html: '<div style="width:20px;height:20px;border-radius:50%;background:#7d2447;color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">2</div>', iconSize: [20, 20], iconAnchor: [10, 10] })

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
    <div className="flex h-full flex-col bg-[#eaeaea]">
      {/* Floating toolbar pill */}
      <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full border border-white/25 bg-white/80 px-4 py-2 shadow-lg backdrop-blur-md">
          <button className="rounded-full bg-guinda px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-guinda/90 disabled:opacity-50" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? 'PDF...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Ficha container */}
      <div className="flex flex-1 items-start justify-center overflow-y-auto pt-16 pb-8">
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
            dangerouslySetInnerHTML={{ __html: brAt58(juntaUpper === 'ZONA METROPOLITANA' ? `${coloniaUpper ? `EN LA COLONIA ${esc(coloniaUpper)}, ` : ''}EN LA ZONA METROPOLITANA` : coloniaUpper ? `EN LA COLONIA ${esc(coloniaUpper)}${juntaUpper ? `, EN LA JUNTA AUXILIAR ${esc(juntaUpper)}` : ''}` : juntaUpper ? `EN LA JUNTA AUXILIAR ${esc(juntaUpper)}` : '') }} />

          {/* Entre calles */}
          {entreCalles && (
            <div className="ficha-entre-calles" contentEditable suppressContentEditableWarning
              onBlur={e => setEntreCalles(DOMPurify.sanitize(e.currentTarget?.innerHTML ?? ''))}
              dangerouslySetInnerHTML={{ __html: brAt58(esc(entreCalles)) }} />
          )}

          {/* Map */}
          <div className="ficha-map-area">
            <div className="ficha-map-pill">{esc(tipoObraUpper)}</div>
            <MapContainer center={mapCenter} zoom={17} className="ficha-map-inner" zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} keyboard={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {hasTramo && <Polyline positions={tramoPuntos!.map(p => [p.lat, p.lng])} pathOptions={{ color: '#7d2447', weight: 4, dashArray: '8 4' }} />}
              {hasTramo && (
                <>
                  <Marker position={[tramoPuntos![0].lat, tramoPuntos![0].lng]} icon={markerIcon1} />
                  <Marker position={[tramoPuntos![tramoPuntos!.length - 1].lat, tramoPuntos![tramoPuntos!.length - 1].lng]} icon={markerIcon2} />
                </>
              )}
            </MapContainer>
          </div>

          {/* Map info */}
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
                <div className="ficha-label"><School className="ficha-icon" /> Escuela(s)</div>
                {escuelasCct.length === 0 && <div className="ficha-val">No</div>}
                {escuelasCct.length > 0 && (
                  <div className="ficha-esc-wrap">
                    {!exporting && <button className="ficha-del-table-btn" onClick={clearEscuelas} title="Eliminar tabla">✕</button>}
                    <table className="ficha-esc-table">
                      <thead><tr><th>CLAVE</th><th>NIVEL</th><th>ALUMNOS</th></tr></thead>
                      <tbody>
                        {escuelasCct.map((cct, i) => {
                          const match = sigedData && sigedData.cct.toUpperCase() === cct ? sigedData : null
                          return (
                            <tr key={i} className="ficha-esc-row">
                              <td><span contentEditable suppressContentEditableWarning>{esc(cct)}</span></td>
                              <td><span contentEditable suppressContentEditableWarning>{match ? esc(match.nivel) : '—'}</span></td>
                              <td className="ficha-alumnos-cell">
                                <span contentEditable suppressContentEditableWarning>{match ? (match.alumnosHombres + match.alumnosMujeres) : '—'}</span>
                                {!exporting && <button className="ficha-row-del-btn" onClick={() => removeEscuelaRow(cct)}>✕</button>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="ficha-item">
                <div className="ficha-label"><Church className="ficha-icon" /> Iglesia(s)</div>
                <div className="ficha-val">{iglesiasList.length > 0 ? iglesiasList.map((t, i) => <div key={i} className="ficha-transporte-line">{esc(t)}</div>) : 'No'}</div>
              </div>
            </div>
            <div className="ficha-row">
              <div className="ficha-item">
                <div className="ficha-label"><Bus className="ficha-icon" /> Transporte</div>
                <div className="ficha-val">{transportesList.length > 0 ? transportesList.map((t, i) => <div key={i} className="ficha-transporte-line">{esc(shortRoute(t))}</div>) : 'No'}</div>
              </div>
            </div>

            <div className="ficha-sep" />

            <div className="ficha-row">
              <div className="ficha-item">
                <div className="ficha-label"><Droplets className="ficha-icon" /> Cobertura de Aguas</div>
                <div className="ficha-val">{coberturaAgua ? 'Agua de Puebla' : 'No'}</div>
              </div>
              <div className="ficha-item">
                <div className="ficha-label"><MapPin className="ficha-icon" /> Zona ZAP</div>
                <div className="ficha-val">{zonaZap ? 'Sí' : 'No'}</div>
              </div>
            </div>

            <div className="ficha-sep" />

            <div className="ficha-row">
              <div className="ficha-item full">
                <div className="ficha-label">Junta Auxiliar</div>
                <div className="ficha-val junta">{esc(juntaUpper)}</div>
              </div>
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
          position: absolute; top: 110px; left: 50px;
          font-size: 18px; color: #FFFFFF; opacity: 0.9;
        }
        .ficha-location-text[contenteditable]:hover,
        .ficha-location-text[contenteditable]:focus {
          outline: 1px dashed rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.1);
        }
        .ficha-entre-calles {
          position: absolute; top: 91px; left: 50px;
          font-size: 18px; font-weight: 600; color: #DBC8B6; letter-spacing: 0.3px;
        }
        .ficha-entre-calles[contenteditable]:hover,
        .ficha-entre-calles[contenteditable]:focus {
          outline: 1px dashed rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.1);
        }
        .ficha-map-area {
          position: absolute; top: 207px; left: 47px;
          width: 444px; height: 394px;
          background: #E8E3DE; border-radius: 12px; overflow: hidden;
        }
        .ficha-map-area .ficha-map-inner { width: 100%; height: 100%; }
        .ficha-map-area .ficha-map-inner .leaflet-control-attribution { display: none; }
        .ficha-map-pill {
          position: absolute; top: 12px; left: 12px; z-index: 1000;
          background: #41504D; color: #DBC6B3;
          padding: 4px 14px; border-radius: 999px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          pointer-events: none; white-space: nowrap;
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
          font-size: 13px; font-weight: 700; color: #DBC8B6;
          margin-bottom: 4px; letter-spacing: 0.5px;
        }
        .ficha-row { display: flex; gap: 12px; margin-bottom: 4px; }
        .ficha-item { flex: 1; }
        .ficha-item.full { flex: none; width: 100%; }
        .ficha-label { font-size: 12px; color: #999; line-height: 1.2; }
        .ficha-val { font-size: 16px; font-weight: 700; color: #41504D; line-height: 1.2; }
        .ficha-val.junta { font-size: 14px; color: #DBC8B6; }
        .ficha-sep { height: 1px; background: #DBC8B6; opacity: 0.4; margin: 5px 0; }
        .ficha-input {
          width: 100%;
          padding: 2px 4px;
          font-size: 16px;
          font-weight: 700;
          color: #41504D;
          background: transparent;
          border: none;
          outline: none;
          font-family: 'Poppins', 'Calibri', sans-serif;
          -webkit-appearance: none;
          -moz-appearance: textfield;
        }
        .ficha-icon { display: inline; width: 14px; height: 14px; vertical-align: text-bottom; margin-right: 2px; }
        .ficha-transporte-line { line-height: 1.4; }
        .ficha-transporte-line::before { content: '•'; margin-right: 6px; color: #41504D; }
        .ficha-esc-table {
          width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px;
        }
        .ficha-esc-table th {
          background: #41504D; color: #DBC6B3;
          border: 1px solid #41504D;
          padding: 2px 4px; text-align: center; font-weight: 700; font-size: 10px;
        }
        .ficha-esc-table td {
          border: 1px solid #41504D; padding: 2px 4px;
          text-align: center; font-weight: 700; color: #636462;
        }
        .ficha-esc-table td span[contenteditable] { display: block; min-width: 40px; }
        .ficha-esc-table td span[contenteditable]:hover,
        .ficha-esc-table td span[contenteditable]:focus {
          outline: 1px dashed #7d2447;
          background: #f5eef2;
        }
        .ficha-esc-wrap { position: relative; display: inline-block; width: 100%; }
        .ficha-del-table-btn { position: absolute; top: -18px; right: 0; background: #41504D; color: #DBC6B3; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; line-height: 1; cursor: pointer; opacity: 0; transition: opacity 0.15s; z-index: 2; display: flex; align-items: center; justify-content: center; }
        .ficha-esc-wrap:hover .ficha-del-table-btn { opacity: 1; }
        .ficha-del-table-btn:hover { background: #c00; color: #fff; }
        .ficha-alumnos-cell { position: relative; }
        .ficha-row-del-btn { position: absolute; right: -18px; top: 50%; transform: translateY(-50%); background: #41504D; color: #DBC6B3; border: none; border-radius: 50%; width: 16px; height: 16px; font-size: 8px; line-height: 1; cursor: pointer; opacity: 0; transition: opacity 0.15s; display: flex; align-items: center; justify-content: center; padding: 0; z-index: 2; }
        .ficha-esc-row:hover .ficha-row-del-btn { opacity: 1; }
        .ficha-row-del-btn:hover { background: #c00; color: #fff; }

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
