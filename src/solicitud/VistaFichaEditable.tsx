/**
 * @file VistaFichaEditable.tsx
 * @description Ficha técnica editable en formato horizontal (960px) con banner, mapa Leaflet,
 *              datos técnicos, entorno social y exportación a PDF.
 *
 * Estructura:
 *  - Constante FICHA_W=960, fichaRef para captura, scrollRef + useFitScale para responsive,
 *    docH via useElementHeight.
 *  - Estado editable: largo/ancho (num), tipoObra, calle/entreCalles, ubicacionTexto (editable
 *    combinado colonia+junta), escuelasCct (array CCT, dedup, max 3) con funciones
 *    removeEscuelaRow/clearEscuelas. Valores derivados: intervencion = largo*ancho,
 *    iglesiasList/transportesList (split, slice 3), coloniaUpper/juntaUpper, googleMapsUrl.
 *  - Mapa: tramoPuntos (tramo_puntos o lat_ini/fin), mapCenter promedio, tramoBounds para fit,
 *    Polyline dash guinda y Markers 1/2 (divIcon). TileLayer OSM interactivo solo por
 *    gestos (drag/rueda/doble-clic/táctil, sin botones) para encuadrar la vista;
 *    el PDF captura los pixeles actuales del mapa.
 *  - Siged: sigedData opcional para mostrar nivel/alumnos por CCT; match por cct upper.
 *  - Panel derecho DATOS TÉCNICOS: longitud/ancho editables (contentEditable con cleanText),
 *    intervención calculada + beneficiarios debajo (redondeado a entero), escuelas tabla (thead CLAVE/NIVEL/ALUMNOS) con botones de borrado
 *    ocultos en exporting, iglesias/transportes con bullet, coberturaAgua/zonaZap booleans,
 *    juntaAux display.
 *  - Export: snapshotMapa congela la vista en PNG (tiles+tramo+marcadores+píldora,
 *    fallback al mapa vivo) y se pinta sobre el mapa sin desmontarlo; generarPdf usa
 *    flushSync setExporting + html-to-image (render real del navegador, JPEG q0.8)
 *    -> jsPDF landscape px_scaling -> base64, más link clicable sobre la leyenda.
 *    useImperativeHandle expone exportarPdf para envío email en SolicitudDetail.
 *
 * Props: solicitud, sigedData?, ref.
 * Helpers: cleanText (innerText trim NBSP), shortRoute (corta en " - ").
 * Assets: ficha-banner.png (gris) + variantes guinda/beige/blanco del pptx (BANNERS,
 * selector en la píldora con anillo en el actual; `tinta` pinta textos del banner y
 * píldora del mapa; `banner-claro` fuerza verde institucional en banners claros),
 * ficha-mosaicos.png (greca del pptx como footer), banner/footer CSS url.
 * Estilos: .ficha-gen 960x720, banner absolute, map-area 444x394, panel 432px, etc.
 */
import { useState, useRef, useImperativeHandle } from 'react'
import { flushSync } from 'react-dom'
import { toJpeg } from 'html-to-image'
import jsPDF from 'jspdf'
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet'
import L from 'leaflet'
import { School, Church, Bus, Droplets, MapPin, Users } from 'lucide-react'
import type { Solicitud } from '../types/solicitud'
import type { SigedEscuela } from '../lib/consultarSIGED'
import bannerImg from '../assets/ficha-banner.png'
import bannerGuindaImg from '../assets/ficha-banner-guinda.png'
import bannerBeigeImg from '../assets/ficha-banner-beige.png'
import bannerBlancoImg from '../assets/ficha-banner-blanco.png'
import mosaicosImg from '../assets/ficha-mosaicos.png'
import pueblaImg from '../assets/Puebla.png'
import { useFitScale, useElementHeight } from '../lib/useFitScale'

/** Banners disponibles para la ficha (el gris es el actual/por defecto). */
const BANNERS = {
  gris: { img: bannerImg, color: '#41504D', nombre: 'Gris', tinta: '#FFFFFF' },
  guinda: { img: bannerGuindaImg, color: '#7D2447', nombre: 'Guinda', tinta: '#FFFFFF' },
  beige: { img: bannerBeigeImg, color: '#DBC8B6', nombre: 'Beige', tinta: '#41504D' },
  blanco: { img: bannerBlancoImg, color: '#FFFFFF', nombre: 'Blanco', tinta: '#41504D' },
} as const

/** Color de banner elegido en la píldora (fuera del área capturada al exportar). */
type BannerKey = keyof typeof BANNERS

// Ancho fijo de ficha 960px para impresión y escala responsive
const FICHA_W = 960

/** Limpia innerText: reemplaza NBSP y trim. */
function cleanText(el: HTMLElement): string {
  return (el.innerText || '').replace(/\u00A0/g, ' ').trim()
}

function shortRoute(r: string): string {
  const idx = r.search(/\s+-\s+/)
  return idx > 0 ? r.slice(0, idx).trim() : r.trim()
}


/** Props: solicitud, sigedData opcional y ref para exportar base64. */
interface Props {
  solicitud: Solicitud
  sigedData?: SigedEscuela | null
  ref?: React.Ref<{ exportarPdf: () => Promise<string> }>
}

// --- Ficha editable: estados largo/ancho, textos, CCTs, mapa y export ---
export default function VistaFichaEditable({ solicitud: s, sigedData, ref }: Props) {
  // largo/ancho editables; tipoObra/calle/entreCalles; colonia/junta fijas upper
  const [largo, setLargo] = useState(s.distancia_tramo_m ?? 0)
  const [ancho, setAncho] = useState(s.ancho_calle_m ?? 0)
  const [tipoObra, setTipoObra] = useState(s.tipo_solicitud)
  const [calle, setCalle] = useState(s.calle || '')
  const [entreCalles, setEntreCalles] = useState(s.entre_calles || '')
  const [colonia] = useState(s.colonia || '')
  const [juntaAux] = useState(s.junta_auxiliar || '')
  /** Banner actual de la ficha (selector en la píldora PDF). */
  const [banner, setBanner] = useState<BannerKey>('gris')
  /** Banners claros (beige/blanco): textos del banner en verde institucional. */
  const bannerClaro = BANNERS[banner].tinta !== '#FFFFFF'
  /** Instancia Leaflet para congelar la vista en PNG al exportar. */
  const mapRef = useRef<L.Map | null>(null)
  /** PNG estático del mapa (solo durante el export: congela la vista encuadrada). */
  const [mapaEstatico, setMapaEstatico] = useState<string | null>(null)
  const iglesiasStr = (s.iglesias_cercanas || []).join(', ')
  const transportesStr = (s.transportes_cercanos || []).join(', ')
  const coberturaAgua = s.cobertura_agua ?? false
  const zonaZap = s.zona_zap ?? false

  // exporting flag + refs ficha/scroll + scales fit
  const [exporting, setExporting] = useState(false)
  const fichaRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sFicha = useFitScale(scrollRef, FICHA_W)
  const docH = useElementHeight(fichaRef) ?? 720
  // Lista CCT dedup slice 3; funciones remove/clear
  const [escuelasCct, setEscuelasCct] = useState<string[]>(() => {
    const raw = (s.escuelas_cercanas || []).map(c => c.trim().toUpperCase()).filter(Boolean).slice(0, 3)
    return [...new Set(raw)]
  })

    // Cálculo derivado largo * ancho (m²)
const intervencion = Math.round(largo * ancho)
  // Beneficiarios estimados desde la longitud: sin decimales (entero más cercano)
const beneficiarios = Math.round((largo / 6) * 2 * 4.5)

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

  // Texto inicial EN LA COLONIA... / JUNTA AUXILIAR... construido desde colonia/junta
  const ubicacionInicial = (() => {
    const partes: string[] = []
    if (coloniaUpper) partes.push(`EN LA COLONIA ${coloniaUpper}`)
    if (juntaUpper) {
      const juntaLabel = juntaUpper === 'ZONA METROPOLITANA'
        ? 'EN LA ZONA METROPOLITANA'
        : `EN LA JUNTA AUXILIAR ${juntaUpper}`
      partes.push(coloniaUpper ? `, ${juntaLabel}` : juntaLabel)
    }
    return partes.join('')
  })()
  const [ubicacionTexto, setUbicacionTexto] = useState(ubicacionInicial)

    // Resuelve puntos de tramo desde tramo_puntos o lat_ini/fin (fallback)
const tramoPuntos = (s.tramo_puntos && s.tramo_puntos.length >= 2)
    ? s.tramo_puntos
    : (s.tramo_lat_ini != null && s.tramo_lng_ini != null && s.tramo_lat_fin != null && s.tramo_lng_fin != null
        ? [{ lat: s.tramo_lat_ini, lng: s.tramo_lng_ini }, { lat: s.tramo_lat_fin, lng: s.tramo_lng_fin }]
        : null)
  const hasTramo = tramoPuntos != null
  // Centro promedio de tramo o pin si no hay tramo
  const mapCenter = hasTramo
    ? [tramoPuntos!.reduce((s, p) => s + p.lat, 0) / tramoPuntos!.length, tramoPuntos!.reduce((s, p) => s + p.lng, 0) / tramoPuntos!.length] as [number, number]
    : [s.latitud, s.longitud] as [number, number]

  const tramoBounds: [[number, number], [number, number]] | null = hasTramo && tramoPuntos!.length >= 2
    ? [
        [Math.min(...tramoPuntos!.map(p => p.lat)), Math.min(...tramoPuntos!.map(p => p.lng))],
        [Math.max(...tramoPuntos!.map(p => p.lat)), Math.max(...tramoPuntos!.map(p => p.lng))],
      ]
    : null
  const boundsFit = tramoBounds && (tramoBounds[0][0] !== tramoBounds[1][0] || tramoBounds[0][1] !== tramoBounds[1][1])
    ? tramoBounds
    : null

  // Iconos 1/2 para extremos de tramo
  const markerIcon1 = L.divIcon({ className: '', html: '<div style="width:20px;height:20px;border-radius:50%;background:#7d2447;color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">1</div>', iconSize: [20, 20], iconAnchor: [10, 10] })
  const markerIcon2 = L.divIcon({ className: '', html: '<div style="width:20px;height:20px;border-radius:50%;background:#7d2447;color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">2</div>', iconSize: [20, 20], iconAnchor: [10, 10] })

    /** Captura con html2canvas scale1.5 + jsPDF landscape para exportar/base64. */

  /**
   * Congela la vista actual del mapa en un PNG (la misma que encuadró el usuario).
   * Se pinta sobre el mapa vivo durante el export para que html2canvas capture
   * pixeles fijos (cero desplazamientos de marcadores/píldora). Retorna null si
   * algo falla y se usa el mapa vivo como antes (fallback).
   */
  const snapshotMapa = async (): Promise<string | null> => {
    try {
      const map = mapRef.current
      if (!map) return null
      const size = map.getSize()
      if (size.x < 10 || size.y < 10) return null
      const K = 2 // nitidez del PNG (el área mide 444x394 CSS px)
      const W = Math.round(size.x * K)
      const H = Math.round(size.y * K)
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.fillStyle = '#E8E3DE'
      ctx.fillRect(0, 0, W, H)
      const zoom = map.getZoom()
      const pb = map.getPixelBounds()
      const minX = pb?.min?.x
      const minY = pb?.min?.y
      const maxX = pb?.max?.x
      const maxY = pb?.max?.y
      if (minX == null || minY == null || maxX == null || maxY == null) return null
      const T = 256
      const x0 = Math.floor(minX / T)
      const x1 = Math.floor(maxX / T)
      const y0 = Math.floor(minY / T)
      const y1 = Math.floor(maxY / T)
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 48) return null
      const cargar = async (x: number, y: number): Promise<ImageBitmap | null> => {
        try {
          const sub = 'abc'[(x + y) % 3]
          const r = await fetch(`https://${sub}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`)
          if (!r.ok) return null
          return await createImageBitmap(await r.blob())
        } catch {
          return null
        }
      }
      const pedidos: Promise<{ x: number; y: number; img: ImageBitmap | null }>[] = []
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          pedidos.push(cargar(x, y).then(img => ({ x, y, img })))
        }
      }
      for (const { x, y, img } of await Promise.all(pedidos)) {
        if (img) ctx.drawImage(img, (x * T - minX) * K, (y * T - minY) * K, T * K, T * K)
      }
      // Polilínea del tramo + marcadores 1/2 (igual que el mapa vivo)
      if (hasTramo && tramoPuntos) {
        ctx.strokeStyle = '#7d2447'
        ctx.lineWidth = 4 * K
        ctx.setLineDash([8 * K, 4 * K])
        ctx.beginPath()
        tramoPuntos.forEach((p, i) => {
          const pt = map.latLngToContainerPoint([p.lat, p.lng])
          if (i === 0) ctx.moveTo(pt.x * K, pt.y * K)
          else ctx.lineTo(pt.x * K, pt.y * K)
        })
        ctx.stroke()
        ctx.setLineDash([])
        const extremos = [tramoPuntos[0], tramoPuntos[tramoPuntos.length - 1]]
        extremos.forEach((p, i) => {
          const pt = map.latLngToContainerPoint([p.lat, p.lng])
          const cx = pt.x * K
          const cy = pt.y * K
          ctx.beginPath()
          ctx.arc(cx, cy, 10 * K, 0, Math.PI * 2)
          ctx.fillStyle = '#7d2447'
          ctx.fill()
          ctx.lineWidth = 2 * K
          ctx.strokeStyle = '#ffffff'
          ctx.stroke()
          ctx.fillStyle = '#ffffff'
          ctx.font = `800 ${10 * K}px Poppins, Arial, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(i + 1), cx, cy + K * 0.5)
        })
      }
      // Píldora del tipo de obra con el color del banner elegido
      ctx.font = `700 ${10 * K}px Poppins, Arial, sans-serif`
      const tw = ctx.measureText(tipoObraUpper).width
      const px = 12 * K
      const py = 12 * K
      const pw = tw + 28 * K
      const ph = 20 * K
      ctx.fillStyle = BANNERS[banner].color
      const rr = (ctx as unknown as { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect
      if (typeof rr === 'function') {
        rr.call(ctx, px, py, pw, ph, 10 * K)
        ctx.fill()
      } else {
        ctx.fillRect(px, py, pw, ph)
      }
      ctx.fillStyle = BANNERS[banner].tinta
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(tipoObraUpper, px + 14 * K, py + ph / 2 + K * 0.5)
      return canvas.toDataURL('image/png')
    } catch {
      return null
    }
  }

const generarPdf = async (): Promise<string> => {
    if (!fichaRef.current) throw new Error('Ficha no disponible')
    // Congela el mapa ANTES del flush: el PNG hereda la vista encuadrada actual.
    // Si falla, mapaEstatico queda null y se captura el mapa vivo como antes.
    const estatico = await snapshotMapa().catch(() => null)
    // Forzar flush síncrono: el clon debe ver la clase .pdf-export (sin transform/
    // overflow) para capturar a tamaño natural.
    flushSync(() => {
      setExporting(true)
      setMapaEstatico(estatico)
    })
    try {
      // Render real del navegador (SVG foreignObject): idéntico a pantalla,
      // incluyendo fuentes Poppins y estilos Tailwind/Leaflet empaquetados.
      const imgData = await toJpeg(fichaRef.current, {
        quality: 0.8,
        backgroundColor: '#F5F0EB',
        pixelRatio: 1.5,
        cacheBust: true,
      })
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
        img.onerror = () => reject(new Error('No se pudo leer la imagen generada'))
        img.src = imgData
      })
      const pdfW = dims.w / 2
      const pdfH = dims.h / 2
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [pdfW, pdfH],
        hotfixes: ['px_scaling'],
      })
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH)
      // Enlace clicable sobre la fila de la leyenda (coordenadas ficha → PDF).
      const f = pdfW / FICHA_W
      pdf.link(47 * f, 600 * f, 444 * f, 26 * f, { url: googleMapsUrl })
      return pdf.output('datauristring').split(',')[1] ?? ''
    } finally {
      setExporting(false)
      setMapaEstatico(null)
    }
  }

  const handleExportPdf = async () => {
    try {
      const base64 = await generarPdf()
      if (!base64) return
      const bytes = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)))
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Ficha_tecnica_${s.folio_unico}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error al exportar Ficha PDF:', err)
    }
  }

  useImperativeHandle(ref, () => ({ exportarPdf: generarPdf }))

  // --- JSX: banner, tipo obra, calle/entre/colonia, mapa, legend, panel datos técnicos y footer ---
  return (
    <div className={`${exporting ? 'pdf-export ' : ''}flex h-full flex-col bg-[#eaeaea]`}>
      {/* Floating toolbar pill */}
      <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full border border-white/25 bg-white/80 px-4 py-2 shadow-lg backdrop-blur-md">
          {/* Selector de color de banner (no sale en el PDF: está fuera de fichaRef) */}
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Color de banner">
            {(Object.keys(BANNERS) as BannerKey[]).map(k => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={banner === k}
                title={`Banner ${BANNERS[k].nombre}${banner === k ? ' (actual)' : ''}`}
                onClick={() => setBanner(k)}
                className={`h-6 w-6 rounded-full border border-black/15 transition-all ${
                  banner === k ? 'ring-2 ring-guinda ring-offset-2 ring-offset-white' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: BANNERS[k].color }}
              />
            ))}
          </div>
          <div className="h-6 w-px bg-gray-300" />
          <button className="rounded-full bg-guinda px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-guinda/90 disabled:opacity-50" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? 'PDF...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Ficha container */}
      <div ref={scrollRef} className="ficha-scroll flex flex-1 items-start justify-center overflow-y-auto pt-16 pb-8">
        <div className="fit-wrap" style={{ width: FICHA_W * sFicha, height: docH * sFicha }}>
          <div ref={fichaRef} className={`ficha-gen fit-inner${bannerClaro ? ' banner-claro' : ''}`}
            style={{ transform: sFicha < 1 ? `scale(${sFicha})` : undefined, transformOrigin: 'top left' }}>
          {/* Banner (color elegido en la píldora; el exportado sale con este) */}
          <div className="ficha-banner" style={{ backgroundImage: `url('${BANNERS[banner].img}')` }} />
          {/* Logos Gobierno de Puebla en la zona vacía superior derecha del banner */}
          <img
            src={pueblaImg}
            alt="Puebla - Gobierno de la Ciudad"
            className={`ficha-logo-puebla${BANNERS[banner].tinta === '#FFFFFF' ? ' blanco' : ''}`}
          />

          {/* Tipo de obra */}
          <div className="ficha-tipo-obra" contentEditable suppressContentEditableWarning
            onBlur={e => setTipoObra(cleanText(e.currentTarget))}>
            {tipoObraUpper}
          </div>

          {/* Banner texts in flow */}
          <div className="ficha-banner-texts">
            {/* Street */}
            <div className="ficha-street-text" contentEditable suppressContentEditableWarning
              onBlur={e => setCalle(cleanText(e.currentTarget))}>
              {calle}
            </div>

            {/* Entre calles */}
            {entreCalles && (
              <div className="ficha-entre-calles" contentEditable suppressContentEditableWarning
                onBlur={e => setEntreCalles(cleanText(e.currentTarget))}>
                {entreCalles}
              </div>
            )}

            {/* Colonia + Junta (todo editable, una sola pieza) */}
            {ubicacionTexto && (
              <div className="ficha-location-text ficha-editable" contentEditable suppressContentEditableWarning
                onBlur={e => setUbicacionTexto(cleanText(e.currentTarget))}>
                {ubicacionTexto}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="ficha-map-area">
            <div className="ficha-map-pill" style={{ backgroundColor: BANNERS[banner].color, color: BANNERS[banner].tinta }}>{tipoObraUpper}</div>
            <MapContainer ref={mapRef} center={mapCenter} zoom={17} bounds={boundsFit ?? undefined} boundsOptions={boundsFit ? { padding: [24, 24] } : undefined} className="ficha-map-inner" zoomControl={false} dragging scrollWheelZoom doubleClickZoom touchZoom keyboard={false} preferCanvas>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {hasTramo && <Polyline positions={tramoPuntos!.map(p => [p.lat, p.lng])} pathOptions={{ color: '#7d2447', weight: 4, dashArray: '8 4' }} />}
              {hasTramo && (
                <>
                  <Marker position={[tramoPuntos![0].lat, tramoPuntos![0].lng]} icon={markerIcon1} />
                  <Marker position={[tramoPuntos![tramoPuntos!.length - 1].lat, tramoPuntos![tramoPuntos!.length - 1].lng]} icon={markerIcon2} />
                </>
              )}
            </MapContainer>
            {/* PNG congelado sobre el mapa vivo solo durante el export (cero desplazamientos) */}
            {exporting && mapaEstatico && (
              <img src={mapaEstatico} alt="" draggable={false} className="ficha-map-captura" />
            )}
          </div>

          {/* Map info */}
          <div className="ficha-map-legend">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#7D2447"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <span>Ubicación</span>
            <a href={googleMapsUrl} target="_blank" className="ficha-link" rel="noreferrer">{googleMapsUrl}</a>
          </div>
          <div className="ficha-st-text">Folio:  {s.folio_unico || '—'}</div>

          {/* Right Panel: Datos Técnicos */}
                    {/* Panel derecho: datos técnicos + entorno social + junta */}
  <div className="ficha-panel">
            <div className="ficha-section">DATOS TÉCNICOS</div>
            <div className="ficha-row">
              <div className="ficha-item">
                <div className="ficha-label">Longitud (m)</div>
                <div className="ficha-input" contentEditable suppressContentEditableWarning
                  onBlur={e => setLargo(parseInt(cleanText(e.currentTarget), 10) || 0)}>
                  {largo > 0 ? String(largo) : ''}
                </div>
              </div>
              <div className="ficha-item">
                <div className="ficha-label">Intervención</div>
                <div className="ficha-val">{intervencion > 0 ? intervencion.toLocaleString('es-MX') + ' m²' : '—'}</div>
              </div>
            </div>
            <div className="ficha-row">
              <div className="ficha-item">
                <div className="ficha-label">Ancho (m)</div>
                <div className="ficha-input" contentEditable suppressContentEditableWarning
                  onBlur={e => setAncho(parseFloat(cleanText(e.currentTarget)) || 0)}>
                  {ancho > 0 ? String(ancho) : ''}
                </div>
              </div>
              <div className="ficha-item">
                <div className="ficha-label"><Users className="ficha-icon" /> Beneficiarios</div>
                <div className="ficha-val">{beneficiarios > 0 ? beneficiarios.toLocaleString('es-MX') + ' personas' : '—'}</div>
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
                              <td><span contentEditable suppressContentEditableWarning>{cct}</span></td>
                              <td><span contentEditable suppressContentEditableWarning>{match ? match.nivel : '—'}</span></td>
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
                <div className="ficha-val">{iglesiasList.length > 0 ? iglesiasList.map((t, i) => <div key={i} className="ficha-transporte-line">{t}</div>) : 'No'}</div>
              </div>
            </div>
            <div className="ficha-row">
              <div className="ficha-item">
                <div className="ficha-label"><Bus className="ficha-icon" /> Transporte</div>
                <div className="ficha-val">{transportesList.length > 0 ? transportesList.map((t, i) => <div key={i} className="ficha-transporte-line">{shortRoute(t)}</div>) : 'No'}</div>
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
                <div className="ficha-val junta">{juntaUpper}</div>
              </div>
            </div>



          </div>

          {/* Footer */}
          <div className="ficha-footer-img" />
          <div className="ficha-footer-txt">SEMOVINFRA - Atención Ciudadana | Gobierno de la Ciudad 2024-2027</div>
          </div>
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
        .fit-wrap { overflow:hidden; margin:0 auto; }
        .pdf-export .fit-wrap { overflow:visible !important; }
        .pdf-export .fit-inner { transform:none !important; }
        .pdf-export .ficha-scroll { overflow:visible !important; }
        .ficha-banner {
          position: absolute; top: 0; left: 0;
          width: 960px; height: 186px;
          background: url('${bannerImg}') no-repeat top left;
          background-size: 960px 186px;
        }
        .ficha-logo-puebla {
          position: absolute; top: 28px; right: 34px;
          height: 72px; width: auto; z-index: 2;
          pointer-events: none;
        }
        /* Banners oscuros (guinda/gris): logo en blanco vía matriz inversa.
           brightness(0) colapsa todo a negro e invert(1) lo vuelve blanco,
           conservando la transparencia (el texto calado muestra el banner). */
        .ficha-logo-puebla.blanco { filter: brightness(0) invert(1); }
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
          font-size: 30px; font-weight: 800; color: #FFFFFF;
          line-height: 1.1;
        }
        .ficha-street-text[contenteditable]:hover,
        .ficha-street-text[contenteditable]:focus {
          outline: 1px dashed rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.1);
        }
        .ficha-banner-texts {
          position: absolute; top: 56px; left: 50px;
          display: flex; flex-direction: column; gap: 2px;
          max-width: 560px;
          overflow-wrap: normal; word-break: normal;
        }
        .ficha-location-text {
          font-size: 18px; color: #FFFFFF; opacity: 0.9;
        }
        .ficha-editable { outline: none; border-radius: 2px; }
        .ficha-editable:hover,
        .ficha-editable:focus {
          outline: 1px dashed rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.1);
        }
        .ficha-entre-calles {
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
        /* PNG congelado: tapa el mapa vivo en el export (el mapa no se desmonta, conserva la vista) */
        .ficha-map-captura { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 900; }
        /* En el export la píldora HTML se oculta (ya va dibujada en el PNG) */
        .pdf-export .ficha-map-pill { display: none !important; }
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
        .ficha-link { color: #0E94BE; text-decoration: none; font-size: 8px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
        .ficha-val.junta { font-size: 14px; color: #C2BA98; }
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
          position: absolute; bottom: 10px; left: 14px;
          width: 932px; height: 16px;
          background: url('${mosaicosImg}') no-repeat bottom left;
          background-size: 932px 16px;
        }
        .ficha-footer-txt {
          position: absolute; bottom: 30px; left: 0; right: 0;
          text-align: center; font-size: 7px; color: #999;
        }
        /* Banners claros (beige/blanco): textos del banner en verde institucional */
        .banner-claro .ficha-tipo-obra,
        .banner-claro .ficha-street-text,
        .banner-claro .ficha-location-text,
        .banner-claro .ficha-entre-calles { color: #41504D; }
        .banner-claro .ficha-tipo-obra[contenteditable]:hover,
        .banner-claro .ficha-tipo-obra[contenteditable]:focus,
        .banner-claro .ficha-street-text[contenteditable]:hover,
        .banner-claro .ficha-street-text[contenteditable]:focus,
        .banner-claro .ficha-editable:hover,
        .banner-claro .ficha-editable:focus,
        .banner-claro .ficha-entre-calles[contenteditable]:hover,
        .banner-claro .ficha-entre-calles[contenteditable]:focus {
          outline: 1px dashed rgba(65,80,77,0.6);
          background: rgba(65,80,77,0.1);
        }
      `}</style>
    </div>
  )
}
