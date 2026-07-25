import PptxGenJS from 'pptxgenjs'
import type { Solicitud } from '../types/solicitud'

export async function generarFichaTecnica(solicitud: Solicitud): Promise<void> {
  const pptx = new PptxGenJS()

  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'SEMOVINFRA'
  pptx.title = `Ficha Técnica ${solicitud.folio_unico}`

  const slide = pptx.addSlide()

  // Background image
  try {
    const resp = await fetch('/src/assets/ficha-bg.png')
    const blob = await resp.blob()
    const reader = new FileReader()
    const dataUrl = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
    slide.background = { data: dataUrl }
  } catch {
    slide.background = { color: 'F5F0EB' }
  }

  // Title
  slide.addText('FICHA TÉCNICA DE SEGUIMIENTO', {
    x: 0.5, y: 0.2, w: 9, h: 0.5,
    fontSize: 18, fontFace: 'Arial', color: '7D2447',
    bold: true, align: 'left',
  })

  // Folio
  slide.addText(`Folio: ${solicitud.folio_unico}`, {
    x: 0.5, y: 0.7, w: 4, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: '333333',
    bold: true,
  })

  // Date
  const fecha = solicitud.fecha_creacion
    ? new Date(solicitud.fecha_creacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'
  slide.addText(`Fecha: ${fecha}`, {
    x: 5, y: 0.7, w: 4, h: 0.35,
    fontSize: 12, fontFace: 'Arial', color: '333333',
  })

  // Separator line
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 1.1, w: 9, h: 0.02,
    fill: { color: '7D2447' },
  })

  // Data table
  const tableRows: { label: string; value: string }[] = [
    { label: 'Nombre del solicitante', value: solicitud.nombre_solicitante },
    { label: 'CURP', value: solicitud.curp },
    { label: 'Teléfono', value: solicitud.telefono || '—' },
    { label: 'Correo electrónico', value: solicitud.correo || '—' },
    { label: 'Tipo de obra', value: solicitud.tipo_solicitud },
    { label: 'Colonia', value: solicitud.colonia },
    { label: 'Junta auxiliar', value: solicitud.junta_auxiliar },
    { label: 'Estatus', value: solicitud.estatus_fase || '—' },
    { label: 'Peso ranking', value: solicitud.peso_ranking?.toString() || '—' },
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
    tableRows.push({ label: 'Transporte público cercano', value: solicitud.transportes_cercanos.join(', ') })
  }

  const tblData = tableRows.map(r => [
    { text: r.label, options: { fontSize: 9, fontFace: 'Arial', color: '666666', bold: true, fill: { color: 'F0EBE5' } as any } },
    { text: r.value, options: { fontSize: 9, fontFace: 'Arial', color: '333333' } },
  ])

  slide.addTable(tblData, {
    x: 0.5, y: 1.3, w: 5.5,
    colW: [2.2, 3.3],
    border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
    rowH: 0.28,
    autoPage: false,
  })

  // Map image placeholder (right side)
  slide.addText('UBICACIÓN EN MAPA', {
    x: 6.3, y: 1.3, w: 3.5, h: 0.35,
    fontSize: 10, fontFace: 'Arial', color: '7D2447',
    bold: true, align: 'center',
  })

  // Try to capture map via canvas (Leaflet)
  const mapContainer = document.querySelector('.leaflet-container') as HTMLElement | null
  if (mapContainer) {
    try {
      const { default: L } = await import('leaflet')
      const mapInstance = (mapContainer as any)._leaflet_map as L.Map | undefined
      if (mapInstance) {
        // Use leaflet-image approach via canvas
        const canvas = document.createElement('canvas')
        const size = mapInstance.getSize()
        canvas.width = size.x
        canvas.height = size.y
        const ctx = canvas.getContext('2d')
        if (ctx) {
          // Capture tiles
        const tiles = mapContainer.querySelectorAll('.leaflet-tile-pane img')
        for (const tile of Array.from(tiles)) {
          const img = tile as HTMLImageElement
          const style = window.getComputedStyle(img)
          const transform = style.transform || (style as any).webkitTransform
          const match = transform?.match(/translate3d\(([^,]+)px,\s*([^,]+)px/)
          if (match) {
            const tx = parseFloat(match[1])
            const ty = parseFloat(match[2])
            ctx.drawImage(img, tx, ty)
          }
        }
          // Draw marker
          const center = mapInstance.getCenter()
          const point = mapInstance.latLngToContainerPoint(center)
          ctx.beginPath()
          ctx.arc(point.x, point.y, 8, 0, Math.PI * 2)
          ctx.fillStyle = '#7D2447'
          ctx.fill()
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 2
          ctx.stroke()

          const imgData = canvas.toDataURL('image/png')
          slide.addImage({
            data: imgData,
            x: 6.3, y: 1.7, w: 3.5, h: 2.8,
          })
        }
      }
    } catch {
      // Map capture failed, add placeholder
      slide.addShape(pptx.ShapeType.rect, {
        x: 6.3, y: 1.7, w: 3.5, h: 2.8,
        fill: { color: 'E8E3DE' },
        line: { color: 'CCCCCC', width: 1 },
      })
      slide.addText('Mapa no disponible', {
        x: 6.3, y: 2.8, w: 3.5, h: 0.4,
        fontSize: 10, fontFace: 'Arial', color: '999999',
        align: 'center', valign: 'middle',
      })
    }
  } else {
    slide.addShape(pptx.ShapeType.rect, {
      x: 6.3, y: 1.7, w: 3.5, h: 2.8,
      fill: { color: 'E8E3DE' },
      line: { color: 'CCCCCC', width: 1 },
    })
    slide.addText('Mapa no disponible', {
      x: 6.3, y: 2.8, w: 3.5, h: 0.4,
      fontSize: 10, fontFace: 'Arial', color: '999999',
      align: 'center', valign: 'middle',
    })
  }

  // Coordinates
  slide.addText(`Lat: ${solicitud.latitud.toFixed(6)} | Lng: ${solicitud.longitud.toFixed(6)}`, {
    x: 6.3, y: 4.6, w: 3.5, h: 0.3,
    fontSize: 8, fontFace: 'Arial', color: '999999',
    align: 'center',
  })

  // Description (bottom)
  if (solicitud.descripcion) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 5.1, w: 9, h: 0.02,
      fill: { color: '7D2447' },
    })
    slide.addText('DESCRIPCIÓN', {
      x: 0.5, y: 5.2, w: 9, h: 0.3,
      fontSize: 10, fontFace: 'Arial', color: '7D2447',
      bold: true,
    })
    slide.addText(solicitud.descripcion, {
      x: 0.5, y: 5.5, w: 9, h: 1.5,
      fontSize: 9, fontFace: 'Arial', color: '333333',
      valign: 'top', wrap: true,
    })
  }

  // Footer
  slide.addText('SEMOVINFRA - Atención Ciudadana | Gobierno de la Ciudad 2024-2027', {
    x: 0.5, y: 7.0, w: 9, h: 0.3,
    fontSize: 7, fontFace: 'Arial', color: '999999',
    align: 'center',
  })

  // Download
  const fileName = `ficha_tecnica_${solicitud.folio_unico}.pptx`
  await pptx.writeFile({ fileName })
}
