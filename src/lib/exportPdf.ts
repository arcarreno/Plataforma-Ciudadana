import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function exportToPdf(
  elements: HTMLElement[],
  filename: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
  scale = 2
): Promise<void> {
  if (!elements || elements.length === 0) return

  const canvases = await Promise.all(
    elements.map(el =>
      html2canvas(el, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
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
    const imgData = canvas.toDataURL('image/png')
    const w = canvas.width / 2
    const h = canvas.height / 2
    if (i > 0) pdf.addPage([w, h])
    pdf.addImage(imgData, 'PNG', 0, 0, w, h)
  })

  pdf.save(`${filename}.pdf`)
}
