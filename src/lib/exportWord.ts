import DOMPurify from 'dompurify'

function sanitizeFilename(name: string): string {
  return String(name || '').replace(/[^\w\-]/g, '').trim() || 'documento'
}

function safeHtml(str: string): string {
  return DOMPurify.sanitize(str || '', { ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'br'] })
}

export async function exportToWord(data: {
  filename: string
  htmlContent: string
}): Promise<void> {
  const { filename, htmlContent } = data

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
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
