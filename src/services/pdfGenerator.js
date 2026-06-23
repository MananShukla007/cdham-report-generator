/**
 * PDF Generator — reproduces the exact layout of the sample weekly reports.
 *
 * Measurements derived from pdftohtml XML analysis of the three sample PDFs:
 *   • Page: Letter 215.9 × 279.4 mm
 *   • Margins: 21.2 mm left/right, 18 mm top, 20 mm bottom
 *   • Header box: y 18–65 mm (47 mm tall)
 *   • Running header on pages 2+: title + date centered, separator at 30 mm
 *   • Section headings: 14 pt bold #0c2340
 *   • Subsection headings (line ending in ":"): 10.5 pt bold #f15a22
 *   • Body text: 10.5 pt #333333, line height 5.2 mm
 *   • Bullet indent: 5 mm
 *   • Upcoming Tasks table: 3 cols 35.8 / 96 / 41.7 mm, dark navy header band
 *   • Footer: 8 pt #999999, centered, ~17 mm after last content
 */

// ── Constants ──────────────────────────────────────────────────────────────────
const PW = 215.9, PH = 279.4         // page mm
const ML = 21.2, MR = 21.2           // margins mm
const MT = 18,   MB = 20             // margins mm
const CW = PW - ML - MR              // content width 173.5 mm

const NAVY   = [12, 35, 64]
const ORANGE = [241, 90, 34]
const DGRAY  = [51, 51, 51]
const MGRAY  = [102, 102, 102]
const LGRAY  = [153, 153, 153]
const WHITE  = [255, 255, 255]

// Page 1 header box
const BOX_TOP   = MT               // 18 mm
const BOX_H     = 47               // mm → bottom 65 mm
const TITLE_BL  = 25.4             // "Weekly Report" baseline mm
const SUB_BL    = 31.6             // subtitle baseline mm
const SEP_Y     = 35.5             // separator line mm
const LABEL_RX  = 69               // labels right-align x
const VALUE_LX  = 74               // values left-align x
const DATE_BL   = 40.0
const PREPBY_BL = 46.4
const SUPV_BL   = 52.7
const PROJ_BL   = 59.1
const C1_START  = BOX_TOP + BOX_H + 8  // content y after box = 73 mm

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
const SEC_GAP   = 8     // space above section
const SEC_AFTER = 4     // space below heading

// Table
const TC1_X = ML, TC1_W = 35.8
const TC2_X = ML + TC1_W, TC2_W = 96.0
const TC3_X = TC2_X + TC2_W, TC3_W = CW - TC1_W - TC2_W   // 41.7 mm
const T_HDR_H  = 6.5
const T_ROW_H  = 7.5
const T_SZ     = 9
const T_PAD    = 3      // horizontal cell padding

// Content bottom (leave space for footer)
const C_BOTTOM = PH - MB - 12   // 247.4 mm

// ── Colour helpers ─────────────────────────────────────────────────────────────
function setColor(doc, rgb)  { doc.setTextColor(rgb[0], rgb[1], rgb[2]) }
function setFill(doc, rgb)   { doc.setFillColor(rgb[0], rgb[1], rgb[2]) }
function setDraw(doc, rgb)   { doc.setDrawColor(rgb[0], rgb[1], rgb[2]) }

// ── Page 1 header box ──────────────────────────────────────────────────────────
function drawHeaderBox(doc, tmpl, dateLabel, projects) {
  // Border rect
  setDraw(doc, NAVY)
  doc.setLineWidth(0.4)
  doc.rect(ML, BOX_TOP, CW, BOX_H)

  // Title
  setColor(doc, NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(tmpl.reportTitle || 'Weekly Report', PW / 2, TITLE_BL, { align: 'center' })

  // Subtitle
  setColor(doc, ORANGE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(tmpl.subtitle || '', PW / 2, SUB_BL, { align: 'center' })

  // Separator line
  setDraw(doc, MGRAY)
  doc.setLineWidth(0.3)
  doc.line(ML + 4, SEP_Y, PW - MR - 4, SEP_Y)

  // Label/value pairs
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setColor(doc, NAVY)

  const labels = [
    ['Date:', dateLabel, DATE_BL],
    [tmpl.preparedByLabel + ':', tmpl.preparedBy, PREPBY_BL],
    [tmpl.supervisorLabel + ':', tmpl.supervisor, SUPV_BL],
    [(tmpl.projectsLabel || 'Projects') + ':', projects, PROJ_BL],
  ]

  labels.forEach(([label, value, y]) => {
    doc.setFont('helvetica', 'bold')
    setColor(doc, NAVY)
    doc.text(label, LABEL_RX, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    setColor(doc, DGRAY)
    doc.text(value || '', VALUE_LX, y)
  })
}

// ── Running header (pages 2+) ──────────────────────────────────────────────────
function drawRunningHeader(doc, tmpl, dateLabel) {
  setColor(doc, MGRAY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const title = `${tmpl.reportTitle || 'Weekly Report'} – ${tmpl.subtitle || ''}`
  doc.text(title, PW / 2, RH_TITLE_BL, { align: 'center' })
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
 * Renders body text with:
 *   - Lines ending in ":" (≤80 chars, not bullets) → subsection heading (bold orange)
 *   - Lines starting with "- " or "• " → bullets
 *   - Everything else → normal body paragraph
 *
 * Returns final y position after all text.
 * Mutates `pageRef` so the caller knows the current page.
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

  const rawParagraphs = text.split(/\n\n+/)

  for (const para of rawParagraphs) {
    const lines = para.split('\n').filter(l => l.trim())
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const isSubheading = trimmed.endsWith(':') && trimmed.length <= 80 &&
                           !trimmed.startsWith('•') && !trimmed.startsWith('-') &&
                           !trimmed.startsWith('*')
      const isBullet = /^[•\-\*]\s/.test(trimmed)

      if (isSubheading) {
        checkBreak(LINE_H + 2)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(BODY_SZ)
        setColor(doc, ORANGE)
        doc.text(trimmed, ML, y)
        y += LINE_H + 1
      } else if (isBullet) {
        const bulletText = trimmed.replace(/^[•\-\*]\s+/, '')
        doc.setFontSize(BODY_SZ)
        const wrapped = doc.splitTextToSize(bulletText, BULL_W)
        checkBreak(wrapped.length * LINE_H + PARA_GAP)
        wrapped.forEach((wl, wi) => {
          doc.setFont('helvetica', 'normal')
          setColor(doc, DGRAY)
          if (wi === 0) {
            doc.text('•', ML + 1, y)
          }
          doc.text(wl, BULL_X, y)
          y += LINE_H
        })
        y += 0.5
      } else {
        doc.setFontSize(BODY_SZ)
        const wrapped = doc.splitTextToSize(trimmed, CW)
        checkBreak(wrapped.length * LINE_H)
        doc.setFont('helvetica', 'normal')
        setColor(doc, DGRAY)
        wrapped.forEach(wl => {
          doc.text(wl, ML, y)
          y += LINE_H
        })
        y += 0.5
      }
    }
    y += PARA_GAP
  }

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

  // Header band
  setFill(doc, NAVY)
  doc.rect(ML, y, CW, T_HDR_H, 'F')
  setColor(doc, WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(T_SZ)
  const hBL = y + T_HDR_H * 0.68
  doc.text('Priority',              TC1_X + TC1_W / 2, hBL, { align: 'center' })
  doc.text(targetLabel || 'Project', TC3_X + T_PAD,    hBL)
  doc.text('Task',                   TC2_X + T_PAD,    hBL)
  y += T_HDR_H

  // Data rows
  tasks.forEach(task => {
    const taskLines = doc.splitTextToSize(task.task || '', TC2_W - T_PAD * 2)
    const rowH = Math.max(T_ROW_H, taskLines.length * (LINE_H * 0.85) + 3)
    checkBreak(rowH)

    const rBL = y + rowH * 0.62
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(T_SZ)

    // Priority — colored by level
    const priorityColor =
      task.priority === 'High'   ? [180, 30, 30] :
      task.priority === 'Medium' ? [180, 100, 0] :
      DGRAY
    setColor(doc, priorityColor)
    doc.setFont('helvetica', 'bold')
    doc.text(task.priority || '', TC1_X + TC1_W / 2, rBL, { align: 'center' })

    // Task (may wrap)
    setColor(doc, DGRAY)
    doc.setFont('helvetica', 'normal')
    taskLines.forEach((tl, ti) => {
      const lineY = y + 2.5 + (LINE_H * 0.85) * ti + (rowH - taskLines.length * (LINE_H * 0.85) - 3) / 2
      doc.text(tl, TC2_X + T_PAD, lineY + LINE_H * 0.55)
    })

    // Target
    doc.text(task.target || '', TC3_X + T_PAD, rBL)

    // Row separator
    setDraw(doc, [200, 200, 200])
    doc.setLineWidth(0.2)
    doc.line(ML, y + rowH, ML + CW, y + rowH)

    y += rowH
  })

  return y
}

// ── Main export ────────────────────────────────────────────────────────────────
/**
 * Generate a PDF matching the sample weekly report format.
 *
 * @param {Object} report   { weekStart, weekEnd, dateLabel, projects,
 *                            sections:[{id,title,body}],
 *                            upcomingTasks:[{priority,task,target}],
 *                            targetColumnLabel, attachedReports:[string] }
 * @param {Object} template { reportTitle, subtitle, preparedBy, supervisor,
 *                            preparedByLabel, supervisorLabel, projectsLabel, footer }
 * @returns jsPDF instance
 */
export async function generatePDF(report, template) {
  const { default: jsPDF } = await import('jspdf')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageRef = { page: 1 }
  const tmpl = template || {}
  const dateLabel = report.dateLabel || `${report.weekStart} – ${report.weekEnd}`

  // ── Page 1 ──
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

  // ── Numbered sections ──
  const sections = report.sections || []
  sections.forEach((section, idx) => {
    if (!section.body?.trim()) return

    ensureSpace(SEC_GAP + SEC_SZ * 0.352778 + SEC_AFTER + LINE_H * 2)
    y += idx === 0 ? 0 : SEC_GAP

    // Section heading
    setColor(doc, NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(SEC_SZ)
    const headText = `${idx + 1}. ${section.title || 'Untitled'}`
    const headLines = doc.splitTextToSize(headText, CW)
    headLines.forEach(hl => {
      doc.text(hl, ML, y)
      y += SEC_SZ * 0.352778 + 1
    })
    y += SEC_AFTER

    // Body
    y = drawBody(doc, section.body, y, tmpl, dateLabel, pageRef)
  })

  // ── Upcoming Tasks ──
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

  // ── Attached Reports ──
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
    attached.forEach(r => {
      doc.text('• ' + r, ML, y)
      y += LINE_H
    })
    y += PARA_GAP
  }

  // ── Footer on last page ──
  const footerY = Math.min(y + 17, PH - MB - 2)
  drawFooter(doc, tmpl, footerY)

  return doc
}

/** Trigger browser download. */
export async function downloadPDF(report, template) {
  const doc = await generatePDF(report, template)
  const label = (report.dateLabel || report.weekStart || 'report').replace(/\s*[–—]\s*/g, '_to_').replace(/[^a-zA-Z0-9_]/g, '')
  doc.save(`Weekly_Report_${label}.pdf`)
}
