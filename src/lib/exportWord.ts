/**
 * @file exportWord.ts
 * @description
 * Exportación de contenido HTML a documento Word (.doc) compatible con Microsoft Word.
 * Genera un archivo HTML con namespaces VML/Office/Word y directivas `mso` para que
 * Word lo abra como documento nativo (formato "HTML Word" o MHTML simplificado).
 *
 * Flujo:
 * 1. `sanitizeFilename`: limpia el nombre de archivo dejando solo \w y guiones.
 * 2. `safeHtml`: sanea el HTML con DOMPurify permitiendo solo tags de formato
 *    básico (b,i,u,strong,em,br) para evitar inyección de scripts/estilos peligrosos.
 * 3. `exportToWord`: envuelve el HTML saneado en una plantilla completa con
 *    `<html xmlns:v/o/w>`, metadatos `WordDocument`/`OfficeDocumentSettings` y
 *    estilos de página carta + tablas. Crea un Blob `application/msword`, genera
 *    URL de objeto y dispara descarga vía `<a download="*.doc">`.
 */

import DOMPurify from 'dompurify'

/**
 * Sanea el nombre de archivo dejando solo letras, números, guiones y guión bajo.
 * @param name - Nombre propuesto (puede traer espacios/puntos/extensión).
 * @returns Nombre seguro o "documento" como fallback.
 */
function sanitizeFilename(name: string): string {
  return String(name || '').replace(/[^\w\-]/g, '').trim() || 'documento'
}

/**
 * Sanea HTML permitiendo solo etiquetas de formato seguro.
 * Usa DOMPurify con allowlist mínima para evitar XSS al abrir en Word/navegador.
 * @param str - HTML de entrada (puede ser parcial).
 * @returns HTML saneado con solo b,i,u,strong,em,br.
 */
function safeHtml(str: string): string {
  return DOMPurify.sanitize(str || '', { ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'br'] })
}

/**
 * Exporta contenido HTML a un archivo .doc y dispara su descarga.
 * El archivo resultante es HTML con headers de Word; Word lo interpreta como
 * documento nativo (no es OOXML .docx binario, sino "Word HTML").
 *
 * @param data - Objeto con `filename` (sin extensión) y `htmlContent` (HTML parcial a embeber en <body>).
 */
export async function exportToWord(data: {
  filename: string
  htmlContent: string
}): Promise<void> {
  const { filename, htmlContent } = data

  // Plantilla completa compatible con Word (namespaces VML/Office/Word + condicional mso).
  const fullHtml = `<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
  <meta charset="UTF-8">
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument><w:View>Print</w:View></w:WordDocument>
    <o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  <style>
    @page { size: letter; margin: 2cm 2.5cm; }
    body { font-family: 'Poppins', 'Calibri', sans-serif; color: #000; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #000; padding: 4px 6px; font-size: 9pt; text-align: center; }
    th { background: #E7E6E6; font-weight: bold; }
  </style>
</head>
<body>
  ${safeHtml(htmlContent)}
</body>
</html>`

  const blob = new Blob([fullHtml], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(filename)}.doc`
  a.click()
  // Se revoca con delay para dar tiempo a que el navegador inicie la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
