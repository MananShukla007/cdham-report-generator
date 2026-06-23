/**
 * PDF Generator — reproduces the exact layout of the sample weekly reports,
 * with support for inline markdown tables and **bold** text in body content.
 */

// ── Constants ──────────────────────────────────────────────────────────────────
const PW = 215.9, PH = 279.4
const ML = 21.2, MR = 21.2
const MT = 18,   MB = 20
const CW = PW - ML - MR   // 173.5 mm

const NAVY   = [12, 35, 64]
const ORANGE = [241, 90, 34]
const DGRAY  = [51, 51, 51]
const MGRAY  = [102, 102, 102]
const LGRAY  = [153, 153, 153]
const WHITE  = [255, 255, 255]
const STRIPE = [245, 247, 250]  // alternating row tint

// Page 1 header box
const BOX_TOP   = MT
const BOX_H     = 47
const TITLE_BL  = 25.4
const SUB_BL    = 31.6
const SEP_Y     = 35.5
const LABEL_RX  = 69
const VALUE_LX  = 74
const DATE_BL   = 40.0
const PREPBY_BL = 46.4
const SUPV_BL   = 52.7
const PROJ_BL   = 59.1
const C1_START  = BOX_TOP + BOX_H + 8   // 73 mm

// Running header (pages 2+)
const RH_TITLE_BL = 21.0
const RH_DATE_BL  = 27.1
const RH_LINE_Y   = 30.0
const C2_START    = 34.0

// Body
const BODY_SZ   = 10.5
const LINE_H    = 5.2
const PARA_GAP  = 2.5
const BULL_X    = ML + 5
const BULL_W    = CW - 5

// Sections
const SEC_SZ    = 14
const SEC_GAP   = 8
const SEC_AFTER = 4

// Upcoming Tasks table
const TC1_X = ML, TC1_W = 35.8
const TC2_X = ML + TC1_W, TC2_W = 96.0
const TC3_X = TC2_X + TC2_W, TC3_W = CW - TC1_W - TC2_W
const T_HDR_H = 6.5
const T_ROW_H = 7.5
const T_SZ    = 9
const T_PAD   = 3

// Inline table (within body text)
const IT_HDR_H = 6.0
const IT_ROW_H = 6.5
const IT_SZ    = 9
const IT_PAD   = 2.5

const C_BOTTOM = PH - MB - 12   // 247.4 mm

// ── Helpers ───────────────────────────────────────────────────────────────────
function setColor(doc, rgb) { doc.setTextColor(rgb[0], rgb[1], rgb[2]) }
function setFill(doc, rgb)  { doc.setFillColor(rgb[0], rgb[1], rgb[2]) }
function setDraw(doc, rgb)  { doc.setDrawColor(rgb[0], rgb[1], rgb[2]) }

/** Remove **bold** markers for plain-text measurement / fallback. */
function stripMd(text) {
  return (text || '').replace(/\*\*([^*]+)\*\*/g, '$1')
}

/** Parse "**text**" into [{text, bold}] segments. */
function parseInline(text) {
  const parts = (text || '').split(/(\*\*[^*]*\*\*)/)
  return parts.filter(p => p).map(p => ({
    text: p.startsWith('**') && p.endsWith('**') ? p.slice(2, -2) : p,
    bold: p.startsWith('**') && p.endsWith('**'),
  }))
}

/**
 * Word-wrap text that may contain **bold** spans.
 * Returns an array of lines, each line being [{text, bold}].
 */
function wrapBold(doc, rawText, maxWidth, fontSize) {
  doc.setFontSize(fontSize)
  const segments = parseInline(rawText)
  const lines = []
  let curLine = []
  let curW = 0

  function segW(txt, bold) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    return doc.getTextWidth(txt)
  }

  function pushWord(word, bold) {
    if (!word) return
    const spW  = segW(' ', false)
    const wrdW = segW(word, bold)
    const need = (curLine.length > 0 ? spW : 0) + wrdW

    if (curW + need > maxWidth && curLine.length > 0) {
      lines.push(curLine)
      curLine = []
      curW = 0
    }

    if (curLine.length > 0) {
      // Append space to last segment or add a new space segment
      const last = curLine[curLine.length - 1]
      if (!last.bold) {
        last.text += ' '
      } else {
        curLine.push({ text: ' ', bold: false })
      }
      curW += spW
    }

    // Merge with last segment if same boldness
    const last = curLine[curLine.length - 1]
    if (last && last.bold === bold) {
      last.text += word
    } else {
      curLine.push({ text: word, bold })
    }
    curW += wrdW
  }

  for (const seg of segments) {
    for (const word of seg.text.split(' ')) {
      pushWord(word, seg.bold)
    }
  }
  if (curLine.length > 0) lines.push(curLine)
  return lines
}

/** Render a single line of [{text, bold}] segments at (x, y). */
function renderBoldLine(doc, segments, x, y, color) {
  let cx = x
  setColor(doc, color || DGRAY)
  for (const seg of segments) {
    if (!seg.text) continue
    doc.setFont('helvetica', seg.bold ? 'bold' : 'normal')
    doc.text(seg.text, cx, y)
    cx += doc.getTextWidth(seg.text)
  }
}

// ── Inline table (markdown | col | col |) ─────────────────────────────────────
function isTableRow(line)  { return line.startsWith('|') && line.endsWith('|') }
function isSepRow(line)    { return /^\|[-|\s:]+\|$/.test(line) }

function parseTableLines(lines) {
  return lines
    .filter(l => !isSepRow(l))
    .map(l => l.split('|').slice(1, -1).map(c => c.trim()))
    .filter(row => row.length > 0)
}

/** Distribute column widths proportionally from content, with a min floor. */
function calcColWidths(doc, rows, totalW) {
  const n = Math.max(...rows.map(r => r.length))
  const maxW = Array(n).fill(0)
  doc.setFontSize(IT_SZ)
  rows.forEach(row =>
    row.forEach((cell, i) => {
      doc.setFont('helvetica', 'normal')
      const w = doc.getTextWidth(stripMd(cell)) + IT_PAD * 2
      if (w > maxW[i]) maxW[i] = w
    })
  )
  // Header cells may be wider
  if (rows[0]) {
    rows[0].forEach((cell, i) => {
      doc.setFont('helvetica', 'bold')
      const w = doc.getTextWidth(stripMd(cell)) + IT_PAD * 2
      if (w > maxW[i]) maxW[i] = w
    })
  }
  const sum = maxW.reduce((a, v) => a + v, 0)
  const MIN = 20
  const raw = maxW.map(v => Math.max((v / sum) * totalW, MIN))
  const rawSum = raw.reduce((a, v) => a + v, 0)
  return raw.map(v => (v / rawSum) * totalW)   // normalise to exact totalW
}

function drawInlineTable(doc, rows, startY, tmpl, dateLabel, pageRef) {
  if (!rows.length || !rows[0].length) return startY

  const colW = calcColWidths(doc, rows, CW)
  let y = startY

  function checkBreak(needed) {
    if (y + needed > C_BOTTOM) {
      doc.addPage()
      pageRef.page++
      drawRunningHeader(doc, tmpl, dateLabel)
      y = C2_START
    }
  }

  checkBreak(IT_HDR_H + IT_ROW_H * Math.min(rows.length - 1, 2))

  // ── Header band ──
  setFill(doc, NAVY)
  doc.rect(ML, y, CW, IT_HDR_H, 'F')
  setColor(doc, WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(IT_SZ)
  let xp = ML
  ;(rows[0] || []).forEach((cell, ci) => {
    doc.text(stripMd(cell), xp + IT_PAD, y + IT_HDR_H * 0.7)
    xp += colW[ci]
  })
  y += IT_HDR_H

  // ── Data rows ──
  rows.slice(1).forEach((row, ri) => {
    // Calculate row height (wrapped cell content)
    doc.setFontSize(IT_SZ)
    doc.setFont('helvetica', 'normal')
    let maxLines = 1
    row.forEach((cell, ci) => {
      const wrapped = doc.splitTextToSize(stripMd(cell), colW[ci] - IT_PAD * 2)
      if (wrapped.length > maxLines) maxLines = wrapped.length
    })
    const rowH = Math.max(IT_ROW_H, maxLines * 4.4 + 3)
    checkBreak(rowH)

    // Alternating stripe
    if (ri % 2 === 0) {
      setFill(doc, STRIPE)
      doc.rect(ML, y, CW, rowH, 'F')
    }

    // Vertical col dividers
    setDraw(doc, [210, 215, 220])
    doc.setLineWidth(0.15)
    xp = ML
    colW.forEach((cw, ci) => {
      xp += cw
      if (ci < colW.length - 1) doc.line(xp, y, xp, y + rowH)
    })

    // Cell content with bold support
    setColor(doc, DGRAY)
    xp = ML
    row.forEach((cell, ci) => {
      const boldLines = wrapBold(doc, cell, colW[ci] - IT_PAD * 2, IT_SZ)
      boldLines.forEach((segs, li) => {
        renderBoldLine(doc, segs, xp + IT_PAD, y + 3.5 + li * 4.4)
      })
      xp += colW[ci]
    })

    // Row bottom border
    setDraw(doc, [200, 205, 210])
    doc.setLineWidth(0.2)
    doc.line(ML, y + rowH, ML + CW, y + rowH)
    y += rowH
  })

  // Outer border
  setDraw(doc, [170, 180, 190])
  doc.setLineWidth(0.3)
  doc.rect(ML, startY, CW, y - startY)

  return y
}

// ── Page 1 header box ──────────────────────────────────────────────────────────
function drawHeaderBox(doc, tmpl, dateLabel, projects) {
  setDraw(doc, NAVY)
  doc.setLineWidth(0.4)
  doc.rect(ML, BOX_TOP, CW, BOX_H)

  setColor(doc, NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(tmpl.reportTitle || 'Weekly Report', PW / 2, TITLE_BL, { align: 'center' })

  setColor(doc, ORANGE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(tmpl.subtitle || '', PW / 2, SUB_BL, { align: 'center' })

  setDraw(doc, MGRAY)
  doc.setLineWidth(0.3)
  doc.line(ML + 4, SEP_Y, PW - MR - 4, SEP_Y)

  const pairs = [
    ['Date:', dateLabel, DATE_BL],
    [tmpl.preparedByLabel + ':', tmpl.preparedBy, PREPBY_BL],
    [tmpl.supervisorLabel + ':', tmpl.supervisor, SUPV_BL],
    [(tmpl.projectsLabel || 'Projects') + ':', projects, PROJ_BL],
  ]
  pairs.forEach(([label, value, y]) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setColor(doc, NAVY)
    doc.text(label, LABEL_RX, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    setColor(doc, DGRAY)
    doc.text(value || '', VALUE_LX, y)
  })
}

// ── Running header ─────────────────────────────────────────────────────────────
function drawRunningHeader(doc, tmpl, dateLabel) {
  setColor(doc, MGRAY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${tmpl.reportTitle || 'Weekly Report'} – ${tmpl.subtitle || ''}`, PW / 2, RH_TITLE_BL, { align: 'center' })
  doc.text(dateLabel, PW / 2, RH_DATE_BL, { align: 'center' })
  setDraw(doc, MGRAY)
  doc.setLineWidth(0.3)
  doc.line(ML, RH_LINE_Y, PW - MR, RH_LINE_Y)
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function drawFooter(doc, tmpl, footerY) {
  setColor(doc, LGRAY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(tmpl.footer || '', PW / 2, footerY, { align: 'center' })
}

// ── Body text renderer ─────────────────────────────────────────────────────────
/**
 * Renders body text supporting:
 *   - | table | rows       → inline table with navy header band
 *   - Lines ending in ":"  → subsection heading (bold orange)
 *   - Bullet lines         → indented bullets
 *   - **bold** markers     → inline bold rendering
 *   - Normal paragraphs    → wrapped body text
 */
function drawBody(doc, text, startY, tmpl, dateLabel, pageRef) {
  let y = startY

  function checkBreak(needed) {
    if (y + needed > C_BOTTOM) {
      doc.addPage()
      pageRef.page++
      drawRunningHeader(doc, tmpl, dateLabel)
      y = C2_START
    }
  }

  const allLines = text.split('\n')
  let i = 0
  let tableBuf = []

  function flushTable() {
    if (tableBuf.length === 0) return
    const rows = parseTableLines(tableBuf)
    tableBuf = []
    if (rows.length >= 2) {
      checkBreak(IT_HDR_H + IT_ROW_H * 2)
      y += 2
      y = drawInlineTable(doc, rows, y, tmpl, dateLabel, pageRef)
      y += PARA_GAP + 1
    }
  }

  while (i < allLines.length) {
    const raw = allLines[i]
    const trimmed = raw.trim()
    i++

    if (!trimmed) {
      flushTable()
      y += PARA_GAP * 0.5
      continue
    }

    // ── Table row ──
    if (isTableRow(trimmed)) {
      tableBuf.push(trimmed)
      continue
    }

    flushTable()

    // ── Subsection heading ──
    const isSubhead = trimmed.endsWith(':') && trimmed.length <= 90 &&
                      !/^[•\-\*]/.test(trimmed) && !/^\|/.test(trimmed)
    if (isSubhead) {
      checkBreak(LINE_H + 3)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(BODY_SZ)
      setColor(doc, ORANGE)
      doc.text(stripMd(trimmed), ML, y)
      y += LINE_H + 1
      continue
    }

    // ── Bullet ──
    const isBullet = /^[•\-\*]\s/.test(trimmed)
    if (isBullet) {
      const bulletText = trimmed.replace(/^[•\-\*]\s+/, '')
      doc.setFontSize(BODY_SZ)
      const boldLines = wrapBold(doc, bulletText, BULL_W, BODY_SZ)
      checkBreak(boldLines.length * LINE_H + 1)
      boldLines.forEach((segs, li) => {
        if (li === 0) {
          setColor(doc, DGRAY)
          doc.setFont('helvetica', 'normal')
          doc.text('•', ML + 1, y)
        }
        renderBoldLine(doc, segs, BULL_X, y)
        y += LINE_H
      })
      y += 0.5
      continue
    }

    // ── Normal paragraph ──
    doc.setFontSize(BODY_SZ)
    const boldLines = wrapBold(doc, trimmed, CW, BODY_SZ)
    checkBreak(boldLines.length * LINE_H)
    boldLines.forEach(segs => {
      renderBoldLine(doc, segs, ML, y)
      y += LINE_H
    })
    y += 0.5
  }

  flushTable()
  y += PARA_GAP
  return y
}

// ── Upcoming Tasks table ───────────────────────────────────────────────────────
function drawTasksTable(doc, tasks, targetLabel, startY, tmpl, dateLabel, pageRef) {
  let y = startY

  function checkBreak(needed) {
    if (y + needed > C_BOTTOM) {
      doc.addPage()
      pageRef.page++
      drawRunningHeader(doc, tmpl, dateLabel)
      y = C2_START
    }
  }

  checkBreak(T_HDR_H + T_ROW_H)

  setFill(doc, NAVY)
  doc.rect(ML, y, CW, T_HDR_H, 'F')
  setColor(doc, WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(T_SZ)
  const hBL = y + T_HDR_H * 0.68
  doc.text('Priority',               TC1_X + TC1_W / 2, hBL, { align: 'center' })
  doc.text('Task',                   TC2_X + T_PAD,     hBL)
  doc.text(targetLabel || 'Project', TC3_X + T_PAD,     hBL)
  y += T_HDR_H

  tasks.forEach((task, ti) => {
    const taskLines = doc.splitTextToSize(task.task || '', TC2_W - T_PAD * 2)
    const rowH = Math.max(T_ROW_H, taskLines.length * (LINE_H * 0.85) + 3)
    checkBreak(rowH)

    if (ti % 2 === 0) {
      setFill(doc, STRIPE)
      doc.rect(ML, y, CW, rowH, 'F')
    }

    const rBL = y + rowH * 0.62
    doc.setFontSize(T_SZ)

    const pColor = task.priority === 'High' ? [180, 30, 30] : task.priority === 'Medium' ? [160, 90, 0] : DGRAY
    setColor(doc, pColor)
    doc.setFont('helvetica', 'bold')
    doc.text(task.priority || '', TC1_X + TC1_W / 2, rBL, { align: 'center' })

    setColor(doc, DGRAY)
    doc.setFont('helvetica', 'normal')
    taskLines.forEach((tl, tli) => {
      doc.text(tl, TC2_X + T_PAD, y + 2.5 + (LINE_H * 0.85) * tli + (rowH - taskLines.length * (LINE_H * 0.85) - 3) / 2 + LINE_H * 0.55)
    })
    doc.text(task.target || '', TC3_X + T_PAD, rBL)

    setDraw(doc, [200, 205, 210])
    doc.setLineWidth(0.2)
    doc.line(ML, y + rowH, ML + CW, y + rowH)
    y += rowH
  })

  return y
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function generatePDF(report, template) {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageRef = { page: 1 }
  const tmpl = template || {}
  const dateLabel = report.dateLabel || `${report.weekStart} – ${report.weekEnd}`

  drawHeaderBox(doc, tmpl, dateLabel, report.projects || tmpl.subtitle || '')

  let y = C1_START

  function ensureSpace(needed) {
    if (y + needed > C_BOTTOM) {
      doc.addPage()
      pageRef.page++
      drawRunningHeader(doc, tmpl, dateLabel)
      y = C2_START
    }
  }

  // Numbered sections
  ;(report.sections || []).forEach((section, idx) => {
    if (!section.body?.trim()) return
    ensureSpace(SEC_GAP + SEC_SZ * 0.352778 + SEC_AFTER + LINE_H * 2)
    y += idx === 0 ? 0 : SEC_GAP

    setColor(doc, NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(SEC_SZ)
    const headLines = doc.splitTextToSize(`${idx + 1}. ${section.title || 'Untitled'}`, CW)
    headLines.forEach(hl => { doc.text(hl, ML, y); y += SEC_SZ * 0.352778 + 1 })
    y += SEC_AFTER
    y = drawBody(doc, section.body, y, tmpl, dateLabel, pageRef)
  })

  // Upcoming Tasks
  const tasks = report.upcomingTasks || []
  if (tasks.length > 0) {
    ensureSpace(SEC_GAP + SEC_SZ * 0.352778 + T_HDR_H + T_ROW_H)
    y += SEC_GAP
    setColor(doc, NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(SEC_SZ)
    doc.text('Upcoming Tasks', ML, y)
    y += SEC_SZ * 0.352778 + SEC_AFTER + 2
    y = drawTasksTable(doc, tasks, report.targetColumnLabel, y, tmpl, dateLabel, pageRef)
  }

  // Attached Reports
  const attached = (report.attachedReports || []).filter(r => r.trim())
  if (attached.length > 0) {
    ensureSpace(SEC_GAP + LINE_H * (attached.length + 1) + 4)
    y += SEC_GAP * 0.7
    setColor(doc, NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(BODY_SZ)
    doc.text('Attached Reports:', ML, y)
    y += LINE_H
    doc.setFont('helvetica', 'normal')
    setColor(doc, DGRAY)
    attached.forEach(r => { doc.text('• ' + r, ML, y); y += LINE_H })
    y += PARA_GAP
  }

  drawFooter(doc, tmpl, Math.min(y + 17, PH - MB - 2))
  return doc
}

export async function downloadPDF(report, template) {
  const doc = await generatePDF(report, template)
  const label = (report.dateLabel || report.weekStart || 'report')
    .replace(/\s*[–—]\s*/g, '_to_').replace(/[^a-zA-Z0-9_]/g, '')
  doc.save(`Weekly_Report_${label}.pdf`)
}
