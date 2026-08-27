/**
 * @file VistaOficioEditable.tsx
 * @description Editor visual de Oficio institucional en formato carta (21.6x27.9cm) con
 *              paginación medida, drag&drop de bloques, edición inline y exportación a PDF.
 *
 * Estructura & flujo:
 *  1. Layout: letterhead.jpg como background, constantes PX_PER_CM=37.8, OFICIO_W/H,
 *     TOP_PAD_P1/CONT, PAGE1/CONT_CONTENT_H, FOOTER_TEXT_CM. Página absoluta header (year,
 *     oficioNum, pageNum) + content con destinatario, fundamento, tabla, bloques móviles y footer.
 *  2. Datos editables en estado editData (yearTag, oficioNum, destinatario, fundamento,
 *     parrafoCompromiso/Contacto, cierre, firma*, archivo, ccp, iniciales) con contentEditable
 *     + DOMPurify.sanitize en onBlur (setEdit). escapeHtml para folio/nombre inicial.
 *  3. Bloques móviles: movableDefaults ['compromiso','contacto','contactsTable','cierre','firma'];
 *     blockOrder state permite reordenar por drag ghost (cloneNode, mousemove tracking,
 *     insertAfter logic). CCP es draggable libre con posición absoluta (ccpPosition + drag).
 *  4. Tabla: tableRows memoized con folio/tipo/fecha/estatus; colWidths state + initResize (RAF
 *     + mousemove) para redimensionar columnas con límite 590px total.
 *  5. Paginación: useLayoutEffect mide alturas de segmentos (data-segment) en contenedor oculto
 *     measureRef (visibility hidden, fixed -9999px). Algoritmo distribuye segmentos en páginas
 *     respetando PAGE1/CONT_CONTENT_H, theadH y TABLE_MARGIN_PX; mueve CCP junto a firma si se
 *     separan. Genera measuredPages [{isFirst, segmentIds, rowIds, blockTypes, paddingBottom}].
 *  6. Render: renderBlocks(blockType) genera JSX con drag-handle (⠿) y contentEditable;
 *     renderHeaderContent, renderDestinatarioContent, renderTable. Páginas visibles usan scale
 *     de useFitScale para encajar en scrollRef; pageRefs array para export.
 *  7. Export: handleExportPdf (descarga) y exportarPdf (base64 para email) usan flushSync
 *     setExporting true para añadir clase .pdf-export (quita transform/overflow), luego
 *     exportToPdf/exportToPdfBase64 (html2canvas+jsPDF). useImperativeHandle expone exportarPdf.
 *
 * Props: solicitud: Solicitud, ref: {exportarPdf:()=>Promise<string>}
 * Libs: DOMPurify, html2canvas, jsPDF via exportPdf, useFitScale.
 * Estilos: CSS-in-JS con .oficio-wrapper, .oficio-content, .tabla-oficio/contactos, .drag-handle.
 */
import { useState, useRef, useMemo, useCallback, useEffect, useLayoutEffect, useImperativeHandle } from 'react'
import { flushSync } from 'react-dom'
import DOMPurify from 'dompurify'
import letterhead from '../assets/letterhead.jpg'
import type { Solicitud } from '../types/solicitud'
import { exportToPdf, exportToPdfBase64 } from '../lib/exportPdf'

import { useFitScale } from '../lib/useFitScale'

// --- Constantes de paginación física carta: PX_PER_CM, dimensiones, paddings y alturas de contenido ---
const PX_PER_CM = 37.8
const OFICIO_W = 21.6 * PX_PER_CM
const OFICIO_H = 27.9 * PX_PER_CM
const FOOTER_TEXT_CM = 24
const TOP_PAD_P1 = 5.5
const TOP_PAD_CONT = 5.5
const PAGE1_CONTENT_H = (FOOTER_TEXT_CM - TOP_PAD_P1) * PX_PER_CM
const CONT_CONTENT_H = (FOOTER_TEXT_CM - TOP_PAD_CONT) * PX_PER_CM
const TABLE_MARGIN_PX = 28

// Tabla fija de contactos de áreas SEMOVINFRA para oficio
const CONTACTOS = [
  { area: 'Atención Ciudadana de la SEMOVINFRA', telefono: '222 309 4400 Ext. 5776 y 5744' },
  { area: 'Secretaría Particular', telefono: '222 309 4400 Ext. 5657' },
  { area: 'Subsecretaría de Infraestructura', telefono: '222 309 4400 Ext. 5678' },
  { area: 'Subsecretaría de Movilidad y Seguridad Vial', telefono: '222 309 4400 Ext. 6014' },
  { area: 'Dirección General de Planeación y Proyectos', telefono: '222 309 4400 Ext. 5787' },
  { area: 'Dirección Jurídica', telefono: '222 309 4400 Ext. 5693' },
]

/** Formatea fecha actual a 'DD DE MES DE YYYY' en español mayús. */
function formatDate(): string {
  const d = new Date()
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
  return `${String(d.getDate()).padStart(2, '0')} DE ${meses[d.getMonth()]} DE ${d.getFullYear()}`
}

function formatYearTag(): string {
  return `${new Date().getFullYear()}, Año de Margarita Maza Parada`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Props: solicitud y ref imperativa para exportar PDF base64. */
interface Props {
  solicitud: Solicitud
  ref?: React.Ref<{ exportarPdf: () => Promise<string> }>
}

// --- Editor oficio: estados editData, colWidths, paginación medida, drag&drop y export ---
export default function VistaOficioEditable({ solicitud, ref }: Props) {
  // Alias solicitud y fecha formateada es-MX
  const s = solicitud
  const fecha = s.fecha_creacion ? new Date(s.fecha_creacion).toLocaleDateString('es-MX') : '—'

  // editData: todo el contenido editable del oficio con defaults que incluyen folio/nombre/fecha
  const [editData, setEditData] = useState({
    yearTag: formatYearTag(),
    oficioNum: `OFICIO Núm. SEMOVINFRA-${escapeHtml(s.folio_unico || '')}/2026`,
    destinatario: `<strong>CIUDADANO(A)</strong> ${escapeHtml(s.nombre_solicitante || '').toUpperCase()}`,
    fundamento: 'Con fundamento en lo dispuesto por los artículos 8 de la Constitución Política de los Estados Unidos Mexicanos; 3, 4, 5, 6 fracción I.2 y 12 fracción I, IV y X del Reglamento Interior de la Secretaría de Movilidad e Infraestructura del Honorable Ayuntamiento del Municipio de Puebla, por este medio respetuosamente me permito informarle que sus solicitudes han sido remitidas a las áreas correspondientes para su análisis, programación y en su caso atención de las mismas.',
    parrafoCompromiso: 'Reiteramos nuestro compromiso de trabajar en beneficio de la comunidad, asegurando que los recursos sean utilizados de manera óptima para la mejora de la infraestructura urbana.',
    parrafoContacto: 'Asimismo, se informa que esta Secretaría se encuentra a su disposición para contribuir en la atención a la ciudadanía, dentro de las facultades conferidas por su reglamento. En razón de lo antes expuesto, y con el objetivo de facilitar la colaboración, se proporcionan los siguientes números de contacto de la dependencia:',
    cierre: 'Sin otro particular, agradezco su atención y reitero mi distinguida consideración.',
    firmaAtentamente: 'ATENTAMENTE',
    firmaCiudad: `CUATRO VECES HEROICA PUEBLA DE ZARAGOZA, A ${formatDate()}`,
    firmaLema: '"LA CAPITAL IMPARABLE"',
    firmaNombre: 'ANA MARÍA VALENCIA PACHECO',
    firmaCargo: 'SECRETARIA TÉCNICA DE LA SECRETARÍA DE MOVILIDAD E INFRAESTRUCTURA',
    archivo: 'Archivo.',
    ccp: 'c.c.p. Julio César Gil Torres- Director Jurídico de la SEMOVINFRA-para su conocimiento-Presente.',
    iniciales: 'AAMVP/jol',
  })

    // Sanitiza HTML de contentEditable con DOMPurify al perder foco
const setEdit = (field: string, e: React.FocusEvent<HTMLElement>) => {
    const html = e.currentTarget?.innerHTML ?? ''
    setEditData(prev => ({ ...prev, [field]: DOMPurify.sanitize(html) }))
  }

  // exporting flag para clase pdf-export (sin transform) durante captura
  const [exporting, setExporting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scale = useFitScale(scrollRef, OFICIO_W)
  // colWidths: anchos custom de columnas de tabla por índice
  const [colWidths, setColWidths] = useState<Record<number, number>>({})
  // measuredPages: páginas calculadas por medición de alturas de segmentos
  const [measuredPages, setMeasuredPages] = useState<any[] | null>(null)
  const pageRefs = useRef<HTMLElement[]>([])
  const measureRef = useRef<HTMLDivElement>(null)
  const resizeCleanup = useRef<(() => void) | null>(null)
  const [ccpPosition, setCcpPosition] = useState({ x: 0, y: 0 })
  const [isDraggingCcp, setIsDraggingCcp] = useState(false)
  const ccpDragStart = useRef({ mouseX: 0, mouseY: 0, elemX: 0, elemY: 0 })

    // Memo de fila única de tabla con folio/tipo/fecha/estatus
const tableRows = useMemo(() => [{
    _key: 0,
    control: s.folio_unico || '—',
    solicitud: s.tipo_solicitud,
    oficioRecibido: fecha,
    turnadoA: s.estatus_fase || '—',
  }], [s.folio_unico, s.tipo_solicitud, fecha, s.estatus_fase])

  // Bloques reordenables por drag; blockOrder + dragState controlan ghost y drop
  const movableDefaults = ['compromiso', 'contacto', 'contactsTable', 'cierre', 'firma'] as const
  type BlockType = typeof movableDefaults[number]
  const [blockOrder, setBlockOrder] = useState<BlockType[]>([...movableDefaults])
  const [dragState, setDragState] = useState<{ dragging: string | null; over: string | null; insertAfter: boolean }>({ dragging: null, over: null, insertAfter: false })
  const dragGhostRef = useRef<HTMLElement | null>(null)
  const draggingRef = useRef<string | null>(null)
  const dragStateRef = useRef(dragState)

  const blockKeys = useMemo(() => [...blockOrder, 'ccp'], [blockOrder])

    /** Inicia drag de bloque: crea ghost clonado y registra mousemove/mouseup. */
const startDrag = (blockType: string, e: React.MouseEvent) => {
    e.preventDefault()
    const blockEl = (e.currentTarget as HTMLElement).closest('[data-block]') as HTMLElement
    if (!blockEl) return
    const rect = blockEl.getBoundingClientRect()
    const ghost = blockEl.cloneNode(true) as HTMLElement
    ghost.style.cssText = `position:fixed;pointer-events:none;z-index:9999;opacity:0.85;width:${rect.width}px;box-shadow:0 8px 32px rgba(0,0,0,0.15);border-radius:4px;overflow:hidden;background:#fff;transform:rotate(1.5deg) scale(1.02);left:${e.clientX - rect.width / 2}px;top:${e.clientY - 30}px;transition:none;`
    ;[...ghost.querySelectorAll('[contenteditable]')].forEach(el => el.removeAttribute('contenteditable'))
    ;[...ghost.querySelectorAll('.drag-handle, .resize-handle')].forEach(el => (el as HTMLElement).remove())
    document.body.appendChild(ghost)
    dragGhostRef.current = ghost
    draggingRef.current = blockType
    const next = { dragging: blockType, over: null, insertAfter: false }
    setDragState(next)
    dragStateRef.current = next
    document.addEventListener('mousemove', onDragMove)
    document.addEventListener('mouseup', onDragDrop)
  }

  const onDragMove = (e: MouseEvent) => {
    if (!dragGhostRef.current) return
    const gw = dragGhostRef.current.offsetWidth
    dragGhostRef.current.style.left = (e.clientX - gw / 2) + 'px'
    dragGhostRef.current.style.top = (e.clientY - 30) + 'px'
    const container = document.querySelector('.oficio-page-container')
    if (container) {
      const cr = container.getBoundingClientRect()
      if (e.clientY < cr.top - 40 || e.clientY > cr.bottom + 40) { cleanupDragListeners(); return }
    }
    const items = document.querySelectorAll('[data-block]')
    let targetType: string | null = null
    let insertAfter = false
    const dragging = draggingRef.current
    items.forEach(el => {
      const r = el.getBoundingClientRect()
      if (e.clientY >= r.top && e.clientY <= r.bottom) {
        const bt = (el as HTMLElement).dataset.block
        if (bt && bt !== dragging) { targetType = bt; insertAfter = e.clientY > r.top + r.height / 2 }
      }
    })
    const next = { ...dragStateRef.current, over: targetType, insertAfter }
    dragStateRef.current = next
    setDragState(next)
  }

  const onDragDrop = () => {
    cleanupDragListeners()
    if (dragGhostRef.current) { dragGhostRef.current.remove(); dragGhostRef.current = null }
    const { dragging, over, insertAfter } = dragStateRef.current
    draggingRef.current = null
    if (!dragging || !over || dragging === over) { setDragState({ dragging: null, over: null, insertAfter: false }); return }
    const idx = blockOrder.indexOf(dragging as BlockType)
    const targetIdx = blockOrder.indexOf(over as BlockType)
    if (idx === -1 || targetIdx === -1) { setDragState({ dragging: null, over: null, insertAfter: false }); return }
    const next = [...blockOrder]
    const [moved] = next.splice(idx, 1)
    const adjTarget = next.indexOf(over as BlockType)
    next.splice(insertAfter ? adjTarget + 1 : adjTarget, 0, moved as BlockType)
    setBlockOrder(next)
    setDragState({ dragging: null, over: null, insertAfter: false })
  }

  const cleanupDragListeners = () => {
    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragDrop)
  }

    /** Drag libre de bloque CCP con offset escalado por zoom. */
const startDragCcp = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingCcp(true)
    ccpDragStart.current = { mouseX: e.clientX, mouseY: e.clientY, elemX: ccpPosition.x, elemY: ccpPosition.y }
    document.addEventListener('mousemove', onDragCcpMove)
    document.addEventListener('mouseup', onDragCcpEnd)
  }

  const onDragCcpMove = (e: MouseEvent) => {
    const dx = (e.clientX - ccpDragStart.current.mouseX) / scale
    const dy = (e.clientY - ccpDragStart.current.mouseY) / scale
    setCcpPosition({ x: ccpDragStart.current.elemX + dx, y: ccpDragStart.current.elemY + dy })
  }

  const onDragCcpEnd = () => {
    setIsDraggingCcp(false)
    document.removeEventListener('mousemove', onDragCcpMove)
    document.removeEventListener('mouseup', onDragCcpEnd)
  }

    /** Resize de columnas de tabla con RAF y límite total 590px. */
const initResize = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault()
    if (resizeCleanup.current) resizeCleanup.current()
    const th = (e.currentTarget as HTMLElement).parentElement!
    const startX = e.clientX
    const startWidth = th.offsetWidth
    let rafId: number | null = null
    const onMouseMove = (me: MouseEvent) => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        setColWidths(prev => {
          const rawWidth = startWidth + (me.clientX - startX) / scale
          const newWidth = Math.max(60, rawWidth)
          const totalOther = Object.entries(prev).filter(([k]) => Number(k) !== colIdx).reduce((s, [, v]) => s + v, 0)
          return { ...prev, [colIdx]: Math.min(newWidth, Math.max(60, 590 - totalOther)) }
        })
      })
    }
    const onMouseUp = () => {
      if (rafId) cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''; document.body.style.userSelect = ''
      resizeCleanup.current = null
    }
    resizeCleanup.current = onMouseUp
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

    // Toggle <strong> en selección actual (envuelve o desenrolla)
const handleBold = (e: React.MouseEvent) => {
    e.preventDefault()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    let node = range.commonAncestorContainer
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode!
    const existingBold = (node as HTMLElement).closest?.('strong, b')
    if (existingBold) {
      const outer = existingBold.parentNode!
      while (existingBold.firstChild) outer.insertBefore(existingBold.firstChild, existingBold)
      outer.removeChild(existingBold)
    } else {
      const strong = document.createElement('strong')
      try { range.surroundContents(strong) } catch { const c = range.extractContents(); strong.appendChild(c); range.insertNode(strong) }
    }
  }


    // Export descarga PDF a tamaño natural usando flushSync y clase pdf-export
const handleExportPdf = async () => {
    // Forzar flush síncrono: html2canvas clona el DOM al instante y debe ver
    // la clase .pdf-export (sin transform/overflow) para capturar a tamaño natural.
    flushSync(() => setExporting(true))
    try {
      const elements = pageRefs.current.filter(Boolean)
      if (elements.length > 0) await exportToPdf(elements, `Oficio_${s.folio_unico}`, 'portrait', 1.5)
    } catch (err) {
      console.error('Error al exportar PDF:', err)
    }
    setExporting(false)
  }

  const exportarPdf = async (): Promise<string> => {
    flushSync(() => setExporting(true))
    try {
      const elements = pageRefs.current.filter(Boolean)
      if (elements.length === 0) throw new Error('Oficio sin páginas para exportar')
      return await exportToPdfBase64(elements, 'portrait', 1.5)
    } finally {
      setExporting(false)
    }
  }

  useImperativeHandle(ref, () => ({ exportarPdf }))

  useEffect(() => {
    pageRefs.current = pageRefs.current.slice(0, measuredPages ? measuredPages.length : 0)
  }, [measuredPages])

  useEffect(() => {
    return () => {
      if (resizeCleanup.current) resizeCleanup.current()
      document.removeEventListener('mousemove', onDragCcpMove)
      document.removeEventListener('mouseup', onDragCcpEnd)
      document.body.style.cursor = ''; document.body.style.userSelect = ''
    }
  }, [])

    // --- Medición de alturas para paginación: distribuye segmentos en páginas respetando límites ---
useLayoutEffect(() => {
    const el = measureRef.current
    if (!el) return
    const content = el.querySelector('.oficio-content') as HTMLElement
    if (!content) return
    const segEls = content.querySelectorAll('[data-segment]')
    const measured: { id: string; height: number }[] = []
    segEls.forEach(el => {
      measured.push({ id: el.getAttribute('data-segment') || '', height: el.getBoundingClientRect().height })
    })
    if (measured.length === 0) {
      setMeasuredPages(prev => (prev && prev.length === 1 && prev[0].segmentIds.length === 0) ? prev : [{ isFirst: true, segmentIds: [], rowIds: [], blockTypes: [], paddingBottom: 0.5 }])
      return
    }
    let theadH = 0
    const theadEl = content.querySelector('.tabla-oficio thead') as HTMLElement
    if (theadEl) theadH = theadEl.getBoundingClientRect().height

    const result: any[] = []
    let cur: any = { isFirst: true, segmentIds: [], rowIds: [], blockTypes: [] }
    let accumulated = 0
    let limit = PAGE1_CONTENT_H

    for (const seg of measured) {
      const id = seg.id
      if (id === 'header') continue
      let effectiveH = seg.height
      const isRow = id.startsWith('row-')
      const isBlock = id.startsWith('block-')
      if (isRow && cur.rowIds.length === 0) {
        if (theadH > 0) effectiveH += theadH
        effectiveH += TABLE_MARGIN_PX
      }
      if (accumulated + effectiveH > limit) {
        cur.accumulated = accumulated
        result.push(cur)
        cur = { isFirst: false, segmentIds: [], rowIds: [], blockTypes: [] }
        accumulated = 0
        limit = CONT_CONTENT_H
        if (isRow) effectiveH = seg.height + theadH + TABLE_MARGIN_PX
      }
      cur.segmentIds.push(id)
      if (isRow) cur.rowIds.push(id)
      if (isBlock) cur.blockTypes.push(id.replace('block-', ''))
      accumulated += effectiveH
    }
    if (cur.segmentIds.length > 0) {
      const topPad = cur.isFirst ? TOP_PAD_P1 : TOP_PAD_CONT
      const remainingPx = (FOOTER_TEXT_CM - topPad) * PX_PER_CM - accumulated
      cur.paddingBottom = Math.max(0.5, remainingPx / PX_PER_CM)
      cur.accumulated = accumulated
      result.push(cur)
    }

    let firmaIdx = -1, ccpIdx = -1
    result.forEach((p, i) => {
      if (p.blockTypes.includes('firma')) firmaIdx = i
      if (p.blockTypes.includes('ccp')) ccpIdx = i
    })
    if (firmaIdx >= 0 && ccpIdx > firmaIdx) {
      const ccpPage = result[ccpIdx]
      ccpPage.blockTypes = ccpPage.blockTypes.filter((b: string) => b !== 'ccp')
      ccpPage.segmentIds = ccpPage.segmentIds.filter((s: string) => s !== 'block-ccp')
      result[firmaIdx].blockTypes.push('ccp')
      result[firmaIdx].segmentIds.push('block-ccp')
      const firmaTopPad = result[firmaIdx].isFirst ? TOP_PAD_P1 : TOP_PAD_CONT
      result[firmaIdx].accumulated = (result[firmaIdx].accumulated || 0)
      const newRemainingPx = (FOOTER_TEXT_CM - firmaTopPad) * PX_PER_CM - result[firmaIdx].accumulated
      result[firmaIdx].paddingBottom = Math.max(0.5, newRemainingPx / PX_PER_CM)
      if (ccpPage.blockTypes.length === 0 && ccpPage.rowIds.length === 0 && ccpPage.segmentIds.length === 0) {
        result.splice(ccpIdx, 1)
      } else {
        const ccpPageTopPad = ccpPage.isFirst ? TOP_PAD_P1 : TOP_PAD_CONT
        ccpPage.accumulated = (ccpPage.accumulated || 0)
        const ccpRemainingPx = (FOOTER_TEXT_CM - ccpPageTopPad) * PX_PER_CM - ccpPage.accumulated
        ccpPage.paddingBottom = Math.max(0.5, ccpRemainingPx / PX_PER_CM)
      }
    }

    setMeasuredPages(prev => {
      const prevJson = JSON.stringify(prev)
      const newJson = JSON.stringify(result)
      return prevJson === newJson ? prev : result
    })
  }, [editData, blockOrder, colWidths])

  // Estilo de página con letterhead como background carta
  const pageStyle: React.CSSProperties = {
    backgroundImage: `url(${letterhead})`,
    backgroundSize: '21.6cm 27.9cm',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'top center',
  }

  const colStyle = (colIdx: number): React.CSSProperties | undefined => {
    const w = colWidths[colIdx]
    return w ? { width: w } : undefined
  }

  /** Renderiza bloques reordenables con drag-handle y contentEditable según tipo. */
  const renderBlocks = (blocks: string[]) => blocks.map(blockType => {
    const isOver = dragState.over === blockType && !dragState.insertAfter
    const isBefore = dragState.over === blockType && dragState.insertAfter
    const isDragging = dragState.dragging === blockType
    const blockClass = `block-item${isOver ? ' drag-over' : ''}${isBefore ? ' drag-before' : ''}${isDragging ? ' dragging' : ''}`

    if (blockType === 'compromiso') {
      return (
        <div key="b-compromiso" data-block="compromiso" className={blockClass}>
          <div className="drag-handle" onMouseDown={e => startDrag('compromiso', e)}>⠿</div>
          <div className="texto-cuerpo">
            <p contentEditable suppressContentEditableWarning onBlur={e => setEdit('parrafoCompromiso', e)} dangerouslySetInnerHTML={{ __html: editData.parrafoCompromiso }} />
          </div>
        </div>
      )
    }
    if (blockType === 'contacto') {
      return (
        <div key="b-contacto" data-block="contacto" className={blockClass}>
          <div className="drag-handle" onMouseDown={e => startDrag('contacto', e)}>⠿</div>
          <div className="texto-cuerpo">
            <p contentEditable suppressContentEditableWarning onBlur={e => setEdit('parrafoContacto', e)} dangerouslySetInnerHTML={{ __html: editData.parrafoContacto }} />
          </div>
        </div>
      )
    }
    if (blockType === 'contactsTable') {
      return (
        <div key="b-contactsTable" data-block="contactsTable" className={blockClass}>
          <div className="drag-handle" onMouseDown={e => startDrag('contactsTable', e)}>⠿</div>
          <table className="tabla-contactos">
            <thead><tr><th>ÁREA</th><th>Número de contacto</th></tr></thead>
            <tbody>{CONTACTOS.map((c, j) => <tr key={j}><td>{c.area}</td><td>{c.telefono}</td></tr>)}</tbody>
          </table>
        </div>
      )
    }
    if (blockType === 'cierre') {
      return (
        <div key="b-cierre" data-block="cierre" className={blockClass}>
          <div className="drag-handle" onMouseDown={e => startDrag('cierre', e)}>⠿</div>
          <div className="texto-cuerpo">
            <p contentEditable suppressContentEditableWarning onBlur={e => setEdit('cierre', e)} dangerouslySetInnerHTML={{ __html: editData.cierre }} />
          </div>
        </div>
      )
    }
    if (blockType === 'firma') {
      return (
        <div key="b-firma" data-block="firma" className={blockClass}>
          <div className="drag-handle" onMouseDown={e => startDrag('firma', e)}>⠿</div>
          <div className="oficio-firma">
            <div className="firma-atentamente" contentEditable suppressContentEditableWarning onBlur={e => setEdit('firmaAtentamente', e)} dangerouslySetInnerHTML={{ __html: editData.firmaAtentamente }} />
            <div className="firma-ciudad" contentEditable suppressContentEditableWarning onBlur={e => setEdit('firmaCiudad', e)} dangerouslySetInnerHTML={{ __html: editData.firmaCiudad }} />
            <div className="firma-lema" contentEditable suppressContentEditableWarning onBlur={e => setEdit('firmaLema', e)} dangerouslySetInnerHTML={{ __html: editData.firmaLema }} />
            <div style={{ lineHeight: '1.2' }}>&nbsp;</div>
            <div style={{ lineHeight: '1.2' }}>&nbsp;</div>
            <div className="firma-nombre" contentEditable suppressContentEditableWarning onBlur={e => setEdit('firmaNombre', e)} dangerouslySetInnerHTML={{ __html: editData.firmaNombre }} />
            <div className="firma-cargo" contentEditable suppressContentEditableWarning onBlur={e => setEdit('firmaCargo', e)} dangerouslySetInnerHTML={{ __html: editData.firmaCargo }} />
          </div>
        </div>
      )
    }
    if (blockType === 'ccp') {
      return (
        <div key="b-ccp" className="block-item ccp-draggable-oficio"
          style={{
            position: 'absolute',
            left: `${ccpPosition.x}px`,
            top: `${ccpPosition.y}px`,
            cursor: isDraggingCcp ? 'grabbing' : 'grab',
            zIndex: 100,
            background: 'transparent',
            border: isDraggingCcp ? '1px dashed #7D2447' : '1px solid transparent',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: isDraggingCcp ? 'none' : 'border-color 0.15s',
          }}
          onMouseDown={startDragCcp}
        >
          <div className="oficio-ccp">
            <div contentEditable suppressContentEditableWarning
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onBlur={e => setEdit('archivo', e)} dangerouslySetInnerHTML={{ __html: editData.archivo }} />
            <div contentEditable suppressContentEditableWarning
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onBlur={e => setEdit('ccp', e)} dangerouslySetInnerHTML={{ __html: editData.ccp }} />
            <div contentEditable suppressContentEditableWarning
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onBlur={e => setEdit('iniciales', e)} dangerouslySetInnerHTML={{ __html: editData.iniciales }} />
          </div>
        </div>
      )
    }
    return null
  })

  const renderHeaderContent = (pageNum?: number, totalPages?: number) => (
    <>
      <div className="header-year" contentEditable suppressContentEditableWarning onBlur={e => setEdit('yearTag', e)} dangerouslySetInnerHTML={{ __html: editData.yearTag }} />
      <div className="header-oficio-num" contentEditable suppressContentEditableWarning onBlur={e => setEdit('oficioNum', e)} dangerouslySetInnerHTML={{ __html: editData.oficioNum }} />
      {pageNum != null && totalPages != null && (
        <div className="header-page-num">HOJA {pageNum}/{totalPages}</div>
      )}
    </>
  )

  const renderDestinatarioContent = () => (
    <>
      <div className="destinatario-line" contentEditable suppressContentEditableWarning onBlur={e => setEdit('destinatario', e)} dangerouslySetInnerHTML={{ __html: editData.destinatario }} />
      <div className="destinatario-line presente-line">P R E S E N T E</div>
      <div className="texto-cuerpo">
        <p contentEditable suppressContentEditableWarning onBlur={e => setEdit('fundamento', e)} dangerouslySetInnerHTML={{ __html: editData.fundamento }} />
      </div>
    </>
  )

  const renderTable = (rows: typeof tableRows, inMeasure = false) => (
    <div data-block="mainTable" className="block-item">
      <table className="tabla-oficio">
        <thead>
          <tr>
            {['N° Control', 'Solicitud/Petición', 'Oficio Recibido', 'Turnado A:'].map((label, j) => (
              <th key={j} style={inMeasure ? undefined : colStyle(j)}>
                {label}
                {!inMeasure && <div className="resize-handle" onMouseDown={e => initResize(e, j)} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._key} data-segment={`row-${r._key}`}>
              <td style={colStyle(0)}>{r.control}</td>
              <td style={colStyle(1)}>{r.solicitud}</td>
              <td style={colStyle(2)}>{r.oficioRecibido}</td>
              <td style={{ fontWeight: 700, ...colStyle(3) }}>{r.turnadoA}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // --- JSX: contenedor oculto de medición + toolbar flotante B/PDF + páginas visibles paginadas ---
  return (
    <div className={`${exporting ? 'pdf-export ' : ''}flex h-full flex-col bg-[#eaeaea]`}>
      {/* Measurement container — hidden, continuous flow */}
      <div ref={measureRef} className="oficio-wrapper" style={{ ...pageStyle, visibility: 'hidden', position: 'fixed', top: 0, left: '-9999px', zIndex: -1 }}>
        <div data-segment="header" className="oficio-header-abs">{renderHeaderContent()}</div>
        <div className="oficio-content" style={{ paddingTop: `${TOP_PAD_P1}cm`, paddingBottom: '0.5cm' }}>
          <div data-segment="destinatario-block">{renderDestinatarioContent()}</div>
          {tableRows.length > 0 && renderTable(tableRows, true)}
          {blockKeys.map(b => <div key={b} data-segment={`block-${b}`}>{renderBlocks([b])}</div>)}
        </div>
      </div>

      {/* Floating toolbar pill */}
      <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full border border-white/25 bg-white/80 px-4 py-2 shadow-lg backdrop-blur-md">
          <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50" onMouseDown={handleBold} disabled={exporting} title="Negritas"><strong>B</strong></button>
          <div className="mx-1 h-6 w-px bg-black/10" />
          <button className="rounded-full bg-guinda px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-guinda/90 disabled:opacity-50" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? 'PDF...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Visible pages */}
      <div ref={scrollRef} className="oficio-scroll flex-1 overflow-y-auto pt-16 pb-8">
        {measuredPages && measuredPages.length > 0 ? (
          <div className="oficio-page-container">
            {measuredPages.map((page, i) => {
              const topPad = page.isFirst ? TOP_PAD_P1 : TOP_PAD_CONT
              return (
                <div key={`page-${i}`} className="fit-wrap" style={{ width: OFICIO_W * scale, height: OFICIO_H * scale }}>
                  <div className={`oficio-wrapper fit-inner${!page.isFirst ? ' page-continuation' : ''}`}
                    ref={el => { if (el) pageRefs.current[i] = el }}
                    style={{ ...pageStyle, transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: 'top left' }}>
                  <div className="oficio-header-abs">{renderHeaderContent(i + 1, measuredPages.length)}</div>
                  <div className="oficio-content" style={{ paddingTop: `${topPad}cm`, paddingBottom: `${page.paddingBottom}cm` }}>
                    {page.isFirst && <div data-segment="destinatario-block">{renderDestinatarioContent()}</div>}
                    {page.rowIds.length > 0 && renderTable(tableRows.filter(r => page.rowIds.includes(`row-${r._key}`)))}
                    {renderBlocks(page.blockTypes.filter((b: string) => b !== 'ccp'))}
                  </div>
                  {page.blockTypes.includes('ccp') && i === measuredPages.length - 1 && (
                    <div style={{ position: 'absolute', bottom: '5.5cm', left: '3.0cm', zIndex: 100 }}>
                      {renderBlocks(['ccp'])}
                    </div>
                  )}
                  <div className="oficio-footer">
                    <div className="footer-text">
                      GOBIERNO DE LA CIUDAD 2024 - 2027<br />
                      TEL +52 (222) 309 46 00 EXT. 5748<br />
                      PROL. REFORMA #3308, COL. AMOR, C.P. 72140<br />
                      PUEBLA, PUE., MÉXICO
                    </div>
                  </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center py-16 text-sm text-gray-500">Preparando documento...</div>
        )}
      </div>

      <style>{`
        .oficio-header-abs { position:absolute; top:3.0cm; right:3.0cm; text-align:right; z-index:2; }
        .header-year { font-size:9pt; font-style:italic; color:#000; opacity:0.75; }
        .header-oficio-num { font-size:10.5pt; font-weight:700; margin-top:2px; opacity:0.75; }
        .header-page-num { font-size:10.5pt; font-weight:700; opacity:0.75; margin-top:4px; }
        .header-year[contenteditable]:hover,.header-year[contenteditable]:focus,
        .header-oficio-num[contenteditable]:hover,.header-oficio-num[contenteditable]:focus { outline:1px dashed #7d2447; background:#f5eef2; }
        .oficio-wrapper { width:21.6cm; height:27.9cm; margin:0 auto; background:#fff; box-shadow:0 4px 20px rgba(0,0,0,0.12); position:relative; overflow:hidden; font-family:'Poppins','Calibri',sans-serif; }
        .oficio-wrapper::after { content:''; position:absolute; inset:0; background:rgba(255,255,255,0.18); z-index:0; pointer-events:none; }
        .oficio-content { position:relative; z-index:1; padding:1.5cm 3.0cm 6.5cm; }
        .destinatario-line { font-size:10.5pt; margin-bottom:2px; line-height:1.3; }
        .destinatario-line[contenteditable]:hover,.destinatario-line[contenteditable]:focus { outline:1px dashed #7d2447; background:#f5eef2; }
        .presente-line { font-weight:700; margin-bottom:18px; }
        .texto-cuerpo { font-size:10.5pt; text-align:justify; line-height:1.45; }
        .texto-cuerpo p { margin-bottom:10px; text-indent:0.5in; }
        .texto-cuerpo p[contenteditable]:hover,.texto-cuerpo p[contenteditable]:focus { outline:1px dashed #7d2447; background:#f5eef2; }
        .tabla-oficio { width:100%; border-collapse:collapse; margin:14px 0; font-size:9pt; }
        .tabla-oficio th { background:#E7E6E6; border:1px solid #000; padding:6px 8px; text-align:center; font-weight:700; font-size:9pt; position:relative; }
        .tabla-oficio td { border:1px solid #000; padding:4px 8px; text-align:center; font-size:9pt; }
        .tabla-oficio td[contenteditable]:hover,.tabla-oficio td[contenteditable]:focus { outline:1px dashed #7d2447; background:#f5eef2; }
        .resize-handle { position:absolute; top:0; right:-3px; width:6px; height:100%; cursor:col-resize; z-index:5; background:transparent; }
        .resize-handle:hover { background:rgba(0,0,0,0.15); }
        .tabla-contactos { width:100%; border-collapse:collapse; margin:0.5cm 0 14px; }
        .tabla-contactos th { background:#E7E6E6; border:1px solid #000; padding:6px 8px; text-align:center; font-weight:700; font-size:10pt; }
        .tabla-contactos td { border:1px solid #000; padding:4px 8px; text-align:center; font-size:10pt; }
        .oficio-firma { text-align:center; margin-top:30px; }
        .firma-atentamente { font-size:11pt; font-weight:700; }
        .firma-ciudad { font-size:11pt; font-weight:700; margin-top:2px; }
        .firma-lema { font-size:11pt; font-weight:700; font-style:italic; margin-top:2px; }
        .firma-nombre { font-size:11pt; font-weight:700; margin-top:28px; }
        .firma-cargo { font-size:11pt; font-weight:700; }
        .firma-atentamente[contenteditable]:hover,.firma-atentamente[contenteditable]:focus,
        .firma-ciudad[contenteditable]:hover,.firma-ciudad[contenteditable]:focus,
        .firma-lema[contenteditable]:hover,.firma-lema[contenteditable]:focus,
        .firma-nombre[contenteditable]:hover,.firma-nombre[contenteditable]:focus,
        .firma-cargo[contenteditable]:hover,.firma-cargo[contenteditable]:focus { outline:1px dashed #7d2447; background:#f5eef2; }
        .oficio-ccp { font-size:7pt; margin-top:24px; line-height:1.4; }
        .oficio-ccp div[contenteditable]:hover,.oficio-ccp div[contenteditable]:focus { outline:1px dashed #7d2447; background:#f5eef2; }
        .oficio-footer { position:absolute; top:22cm; left:0; width:100%; text-align:left; z-index:1; padding:2.75cm 0 0 12.99cm; pointer-events:none; opacity:0.75; }
        .footer-text { font-family:'Poppins','Calibri',sans-serif; font-size:8.5pt; font-weight:700; color:#ADA37E; line-height:1.5; }
        .block-item { position:relative; }
        .drag-handle { position:absolute; left:-24px; top:50%; transform:translateY(-50%); cursor:grab; font-size:18px; color:#ccc; user-select:none; opacity:0; transition:opacity 0.15s; padding:4px; }
        .block-item:hover .drag-handle { opacity:1; }
        .drag-handle:hover { color:#7d2447; }
        .dragging { opacity:0.4; }
        .drag-over { border-top:2px solid #7d2447 !important; }
        .drag-before { border-bottom:2px solid #7d2447 !important; }
        .oficio-page-container { max-width:21.6cm; margin:0 auto; display:flex; flex-direction:column; gap:32px; padding:20px 0; }
        .fit-wrap { overflow:hidden; margin:0 auto; }
        .fit-wrap .oficio-wrapper { margin:0; }
        .pdf-export .fit-wrap { overflow:visible !important; }
        .pdf-export .fit-inner { transform:none !important; }
        .pdf-export .oficio-scroll { overflow:visible !important; }
        .ccp-draggable-oficio:hover { border-color:rgba(125,36,71,0.3) !important; }
        .ccp-draggable-oficio .oficio-ccp { white-space:nowrap; min-width:16.6cm; }
        @media print { body { background:#fff; } .oficio-wrapper { box-shadow:none; break-inside:avoid; } }
      `}</style>
    </div>
  )
}
