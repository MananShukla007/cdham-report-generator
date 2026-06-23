/**
 * PDF Parser — extracts org details from a sample weekly report PDF.
 * Uses pdfjs-dist to read the first and last pages and pull:
 *   reportTitle, subtitle, preparedBy, supervisor, projectsLabel, footer
 */

let _lib = null
async function lib() {
  if (_lib) return _lib
  _lib = await import('pdfjs-dist')
  _lib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${_lib.version}/pdf.worker.min.mjs`
  return _lib
}

/** Extract all text items from a page, sorted top→bottom, left→right. */
async function pageItems(page) {
  const vp = page.getViewport({ scale: 1 })
  const tc = await page.getTextContent()
  return tc.items
    .filter(i => i.str?.trim())
    .map(i => {
      const [sx, , , sy, tx, ty] = i.transform
      return {
        text: i.str.trim(),
        x: tx,
        // Convert from PDF bottom-up coords to top-down
        y: vp.height - ty,
        fontSize: Math.abs(sy) || Math.abs(sx),
      }
    })
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

/**
 * Merge items that are on the same line (within 3pt of each other) into
 * logical lines, left to right.
 */
function mergeToLines(items) {
  const lines = []
  for (const item of items) {
    const existing = lines.find(l => Math.abs(l.y - item.y) < 3)
    if (existing) {
      existing.text += ' ' + item.text
      existing.maxSize = Math.max(existing.maxSize, item.fontSize)
      existing.minX = Math.min(existing.minX, item.x)
    } else {
      lines.push({ text: item.text, y: item.y, maxSize: item.fontSize, minX: item.x })
    }
  }
  return lines
}

/**
 * Extract org details from a single sample PDF URL.
 * Returns null if the file doesn't exist or can't be parsed.
 */
export async function extractOrgDetails(url) {
  const pdfjs = await lib()

  let pdf
  try {
    pdf = await pdfjs.getDocument({ url, verbosity: 0 }).promise
  } catch {
    return null
  }

  // ── First page ──
  const page1 = await pdf.getPage(1)
  const items1 = await pageItems(page1)
  const lines1 = mergeToLines(items1)

  const details = {
    reportTitle:     '',
    subtitle:        '',
    preparedBy:      '',
    supervisor:      '',
    preparedByLabel: 'Prepared by',
    supervisorLabel: 'Supervisor',
    projectsLabel:   'Projects',
    footer:          '',
  }

  if (lines1.length === 0) return details

  // Title = first (largest-font or topmost) line
  details.reportTitle = lines1[0].text

  // Subtitle = second line
  if (lines1[1]) details.subtitle = lines1[1].text

  // Scan remaining lines for "Label: Value" pairs
  for (const line of lines1.slice(2)) {
    const m = line.text.match(/^([^:]+):\s*(.+)$/)
    if (!m) continue
    const label = m[1].trim()
    const value = m[2].trim()
    const labelLc = label.toLowerCase()
    if (labelLc.includes('prepared') || labelLc.includes('author')) {
      details.preparedByLabel = label
      details.preparedBy = value
    } else if (labelLc.includes('supervisor') || labelLc.includes('advisor')) {
      details.supervisorLabel = label
      details.supervisor = value
    } else if (labelLc.includes('project')) {
      details.projectsLabel = label
    }
  }

  // ── Last page footer ──
  const lastPage = await pdf.getPage(pdf.numPages)
  const itemsLast = await pageItems(lastPage)
  const linesLast = mergeToLines(itemsLast)

  if (linesLast.length > 0) {
    const lastLine = linesLast[linesLast.length - 1]
    // Footer: last line, small font, not a section heading
    if (lastLine.maxSize < 12 && lastLine.text.length > 5) {
      details.footer = lastLine.text
    }
  }

  return details
}

/**
 * Try to load the first available sample PDF from /sample-reports/.
 * Filenames: sample-report-01.pdf … sample-report-10.pdf
 */
export async function extractFromFirstSample(onProgress) {
  for (let i = 1; i <= 10; i++) {
    const name = `sample-report-${String(i).padStart(2, '0')}.pdf`
    const url  = `/sample-reports/${name}`
    try {
      const head = await fetch(url, { method: 'HEAD' })
      if (!head.ok) continue
      onProgress?.(`Parsing ${name}…`)
      const details = await extractOrgDetails(url)
      if (details) return { ...details, sourceFile: name }
    } catch {
      // continue
    }
  }
  return null
}
