import PptxGenJS from 'pptxgenjs'
import type { Solicitud } from '../types/solicitud'

export async function generarFichaTecnica(solicitud: Solicitud): Promise<string> {
  const pptx = new PptxGenJS()

  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches
  pptx.author = 'SEMOVINFRA'
  pptx.title = `Ficha Técnica ${solicitud.folio_unico}`

  const slide = pptx.addSlide()

  // ── Clean background (no pre-filled template) ──
  slide.background = { color: 'F5F0EB' }

  // ── Top bar ──
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.08,
    fill: { color: '7D2447' },
  })

  // ── Header: Logo area + Title ──
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4, y: 0.25, w: 1.8, h: 0.9,
    fill: { color: '7D2447' },
    rectRadius: 0.05,
  })
  slide.addText('SEMOVINFRA', {
    x: 0.4, y: 0.25, w: 1.8, h: 0.9,
    fontSize: 14, fontFace: 'Arial', color: 'FFFFFF',
    bold: true, align: 'center', valign: 'middle',
  })

  slide.addText('FICHA TÉCNICA DE SEGUIMIENTO', {
    x: 2.5, y: 0.25, w: 7, h: 0.5,
    fontSize: 20, fontFace: 'Arial', color: '7D2447',
    bold: true,
  })

  // Folio + Date row
  const fecha = solicitud.fecha_creacion
    ? new Date(solicitud.fecha_creacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  slide.addText(`Folio: ${solicitud.folio_unico}`, {
    x: 2.5, y: 0.75, w: 4, h: 0.3,
    fontSize: 11, fontFace: 'Arial', color: '555555',
    bold: true,
  })
  slide.addText(`Fecha: ${fecha}`, {
    x: 7, y: 0.75, w: 4, h: 0.3,
    fontSize: 11, fontFace: 'Arial', color: '555555',
  })

  // ── Separator ──
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4, y: 1.2, w: 12.53, h: 0.02,
    fill: { color: '7D2447' },
  })

  // ── Left column: Data table ──
  const tableRows: { label: string; value: string }[] = [
    { label: 'Nombre del solicitante', value: solicitud.nombre_solicitante },
    { label: 'CURP', value: solicitud.curp },
    { label: 'Teléfono', value: solicitud.telefono || '—' },
    { label: 'Correo electrónico', value: solicitud.correo || '—' },
    { label: 'Tipo de obra', value: solicitud.tipo_solicitud },
    { label: 'Colonia', value: solicitud.colonia },
    { label: 'Junta auxiliar', value: solicitud.junta_auxiliar },
    { label: 'Estatus', value: solicitud.estatus_fase || '—' },
  ]

  if (solicitud.distancia_tramo_m != null) {
    tableRows.push({ label: 'Distancia del tramo', value: `${solicitud.distancia_tramo_m} m` })
  }
  if (solicitud.ancho_calle_m != null) {
    tableRows.push({ label: 'Ancho de calle', value: `~${solicitud.ancho_calle_m} m` })
  }
  if (solicitud.zona_zap != null) {
    tableRows.push({ label: 'Zona ZAP', value: solicitud.zona_zap ? 'Sí' : 'No' })
  }
  if (solicitud.cobertura_agua != null) {
    tableRows.push({ label: 'Cobertura de agua', value: solicitud.cobertura_agua ? 'Sí' : 'No aplica' })
  }
  if (solicitud.escuelas_cercanas && solicitud.escuelas_cercanas.length > 0) {
    tableRows.push({ label: 'Escuelas cercanas', value: solicitud.escuelas_cercanas.join(', ') })
  }
  if (solicitud.iglesias_cercanas && solicitud.iglesias_cercanas.length > 0) {
    tableRows.push({ label: 'Iglesias cercanas', value: solicitud.iglesias_cercanas.join(', ') })
  }
  if (solicitud.transportes_cercanos && solicitud.transportes_cercanos.length > 0) {
    tableRows.push({ label: 'Transporte público', value: solicitud.transportes_cercanos.join(', ') })
  }

  const tblData = tableRows.map(r => [
    { text: r.label, options: { fontSize: 8.5, fontFace: 'Arial', color: '555555', bold: true, fill: { color: 'EDE8E1' } as any } },
    { text: r.value, options: { fontSize: 8.5, fontFace: 'Arial', color: '333333' } },
  ])

  slide.addTable(tblData, {
    x: 0.4, y: 1.4, w: 6.2,
    colW: [2.4, 3.8],
    border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
    rowH: 0.3,
    autoPage: false,
  })

  // ── Right column: Map ──
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.9, y: 1.4, w: 5.8, h: 4.5,
    fill: { color: 'E8E3DE' },
    line: { color: 'CCCCCC', width: 1 },
    rectRadius: 0.05,
  })

  slide.addText('UBICACIÓN EN MAPA', {
    x: 6.9, y: 1.5, w: 5.8, h: 0.35,
    fontSize: 10, fontFace: 'Arial', color: '7D2447',
    bold: true, align: 'center',
  })

  // Try to capture map from DOM
  const mapContainer = document.querySelector('.leaflet-container') as HTMLElement | null
  if (mapContainer) {
    try {
      const tiles = mapContainer.querySelectorAll('.leaflet-tile-pane img')
      if (tiles.length > 0) {
        const canvas = document.createElement('canvas')
        const mapRect = mapContainer.getBoundingClientRect()
        canvas.width = mapRect.width
        canvas.height = mapRect.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          for (const tile of Array.from(tiles)) {
            const img = tile as HTMLImageElement
            const style = window.getComputedStyle(img)
            const transform = style.transform || (style as any).webkitTransform
            const match = transform?.match(/translate3d\(([^,]+)px,\s*([^,]+)px/)
            if (match) {
              ctx.drawImage(img, parseFloat(match[1]), parseFloat(match[2]))
            }
          }
          const imgData = canvas.toDataURL('image/png')
          slide.addImage({ data: imgData, x: 7.1, y: 1.9, w: 5.4, h: 3.8 })
        }
      }
    } catch { /* map capture failed */ }
  }

  // Coordinates
  slide.addText(`Lat: ${solicitud.latitud.toFixed(6)} | Lng: ${solicitud.longitud.toFixed(6)}`, {
    x: 6.9, y: 6.0, w: 5.8, h: 0.25,
    fontSize: 7.5, fontFace: 'Arial', color: '999999',
    align: 'center',
  })

  // ── Description (bottom) ──
  if (solicitud.descripcion) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.4, y: 6.3, w: 12.53, h: 0.02,
      fill: { color: '7D2447' },
    })
    slide.addText(solicitud.descripcion, {
      x: 0.4, y: 6.4, w: 12.53, h: 0.8,
      fontSize: 8, fontFace: 'Arial', color: '555555',
      valign: 'top', wrap: true,
    })
  }

  // ── Footer ──
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.42, w: 13.33, h: 0.08,
    fill: { color: '7D2447' },
  })
  slide.addText('SEMOVINFRA - Atención Ciudadana | Gobierno de la Ciudad 2024-2027', {
    x: 0.4, y: 7.15, w: 12.53, h: 0.25,
    fontSize: 7, fontFace: 'Arial', color: '999999',
    align: 'center',
  })

  // ── Return blob URL for in-browser rendering ──
  const fileName = `ficha_tecnica_${solicitud.folio_unico}.pptx`
  const blob = await pptx.write({ outputType: 'blob' }) as Blob
  return URL.createObjectURL(blob)
}
