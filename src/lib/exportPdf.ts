/**
 * @file exportPdf.ts
 * @description
 * Utilidades genéricas para exportar elementos del DOM a PDF.
 * Envuelven `html2canvas` (rasterización del DOM a canvas) + `jspdf` (composición
 * del PDF), desacopladas de cualquier plantilla específica (ficha/oficio).
 *
 * Flujo común:
 * 1. Cada `HTMLElement` se rasteriza con `html2canvas` (scale configurable,
 *    `useCORS`/`allowTaint` para tiles/imágenes externas, `backgroundColor`).
 * 2. El primer canvas define el tamaño de página del `jsPDF` (`format: [w/2,h/2]`
 *    con `px_scaling`); cada canvas adicional se añade como nueva página con
 *    `addPage`.
 * 3. Cada canvas se serializa a JPEG (`toDataURL('image/jpeg', quality)`) y se
 *    embebe con `pdf.addImage`.
 * 4. `exportToPdfBase64` retorna el contenido como base64 (útil para envío por API
 *    o `data:` URIs); `exportToPdf` dispara descarga directa vía `<a download>`.
 */

import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/**
 * Exporta uno o varios elementos del DOM a un PDF y retorna su contenido en base64.
 * Cada elemento se convierte en una página del PDF, preservando su tamaño visual.
 *
 * @param elements - HTMLElements a exportar (cada uno será una página).
 * @param orientation - Orientación del PDF ('portrait' | 'landscape', default 'portrait').
 * @param scale - Factor de resolución para html2canvas (default 1.5; mayor = más nítido pero más pesado).
 * @param backgroundColor - Color de fondo del canvas (default '#ffffff').
 * @param quality - Calidad JPEG 0-1 para la imagen embebida (default 0.8).
 * @returns Base64 del PDF (sin prefijo `data:application/pdf;base64,`).
 * @throws Si `elements` está vacío o nulo.
 */
export async function exportToPdfBase64(
  elements: HTMLElement[],
  orientation: 'portrait' | 'landscape' = 'portrait',
  scale = 1.5,
  backgroundColor = '#ffffff',
  quality = 0.8,
): Promise<string> {
  if (!elements || elements.length === 0) throw new Error('Sin elementos para exportar')

  // Rasteriza cada elemento en paralelo; cada uno produce un <canvas>.
  const canvases = await Promise.all(
    elements.map(el =>
      html2canvas(el, {
        scale,
        useCORS: true,      // permite cargar imágenes/tildes de otros orígenes si tienen CORS
        allowTaint: true,   // no bloquea canvas aunque alguna imagen sea "tainted"
        backgroundColor,
        logging: false,
      })
    )
  )

  // El primer canvas define el tamaño de página del documento PDF.
  const first = canvases[0]
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    // Se divide entre 2 por el hotfix px_scaling (jsPDF interpreta px como pt* factor).
    format: [first.width / 2, first.height / 2],
    hotfixes: ['px_scaling'],
  })

  canvases.forEach((canvas, i) => {
    const imgData = canvas.toDataURL('image/jpeg', quality)
    const w = canvas.width / 2
    const h = canvas.height / 2
    if (i > 0) pdf.addPage([w, h])
    pdf.addImage(imgData, 'JPEG', 0, 0, w, h)
  })

  // `datauristring` = "data:application/pdf;base64,JVBER..."; se extrae solo el base64.
  return pdf.output('datauristring').split(',')[1] ?? ''
}

/**
 * Exporta elementos del DOM a PDF y dispara la descarga en el navegador.
 * Wrapper de conveniencia sobre `exportToPdfBase64` que crea un Blob y un `<a download>`.
 *
 * @param elements - HTMLElements a exportar (cada uno una página).
 * @param filename - Nombre del archivo sin extensión (se añade ".pdf").
 * @param orientation - Orientación del PDF (default 'portrait').
 * @param scale - Resolución de captura (default 1.5).
 */
export async function exportToPdf(
  elements: HTMLElement[],
  filename: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
  scale = 1.5
): Promise<void> {
  if (!elements || elements.length === 0) return
  const base64 = await exportToPdfBase64(elements, orientation, scale)
  if (!base64) return
  // Decodifica base64 a bytes binarios para construir el Blob PDF.
  const bytes = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)))
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
