import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function exportToPdfBase64(
  elements: HTMLElement[],
  orientation: 'portrait' | 'landscape' = 'portrait',
  scale = 1.5,
  backgroundColor = '#ffffff',
  quality = 0.8,
): Promise<string> {
  if (!elements || elements.length === 0) throw new Error('Sin elementos para exportar')

  const canvases = await Promise.all(
    elements.map(el =>
      html2canvas(el, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor,
        logging: false,
      })
    )
  )

  const first = canvases[0]
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
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

  return pdf.output('datauristring').split(',')[1] ?? ''
}

export async function exportToPdf(
  elements: HTMLElement[],
  filename: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
  scale = 1.5
): Promise<void> {
  if (!elements || elements.length === 0) return
  const base64 = await exportToPdfBase64(elements, orientation, scale)
  if (!base64) return
  const bytes = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)))
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
