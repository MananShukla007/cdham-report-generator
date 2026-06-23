/**
 * OpenAI service — uses GPT-4o to convert casual notes into professional
 * weekly report language matching the tone of the sample reports.
 */

const BASE = 'https://api.openai.com/v1/chat/completions'

function key() {
  const k = import.meta.env.VITE_OPENAI_KEY
  if (!k) throw new Error('VITE_OPENAI_KEY is not set')
  return k
}

const SYSTEM = `You are a professional technical report writer for an iOS application development team. You write concise, formal weekly status reports. Your output will be inserted directly into a PDF with no further processing.

Style rules:
- Write in third-person ("Work was completed..." or "Significant progress was made...")
- Use complete sentences and professional vocabulary
- Technical terms, framework names, and proper nouns are welcome — include them exactly as given
- Structure content naturally: opening summary sentence, then detail
- Use bullet points for lists of distinct items (start each with "• ")
- Use subsection headings for major sub-topics: write the heading on its own line ending with ":"
  e.g.  "Key Achievements:"
- Do NOT output any section title or number — output body text only
- Do NOT pad with filler phrases like "This week, the team..." unless genuinely appropriate
- If notes are sparse, write concisely rather than inventing details
- Preserve all specific numbers, names, dates, and metrics exactly as given`

/**
 * Polish a single section's casual notes.
 *
 * @param {string} sectionTitle - e.g. "SNCC Project — Prompt Engineering"
 * @param {string} rawNotes     - user's casual notes
 * @param {string} [priorBody]  - same section from last week's report (tone reference)
 */
export async function polishSection(sectionTitle, rawNotes, priorBody = '') {
  const priorCtx = priorBody
    ? `\n\nFor tone reference — last week's "${sectionTitle}" section:\n"""\n${priorBody.slice(0, 500)}\n"""`
    : ''

  const user = `Section: "${sectionTitle}"${priorCtx}

Casual notes to convert:
"""
${rawNotes}
"""

Write the polished section body:`

  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key()}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user',   content: user },
      ],
      temperature: 0.25,
      max_tokens:  700,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `OpenAI error ${res.status}`)
  }
  const data = await res.json()
  return data.choices[0].message.content.trim()
}

/**
 * Polish all sections in parallel.
 *
 * @param {Array}  sections     - report.sections array [{id, title, rawNotes}]
 * @param {Object} [priorReport] - previous saved report for tone reference
 * @param {Function} [onProgress] - callback(sectionTitle)
 * @returns {Object} map { sectionId: polishedText }
 */
export async function polishAllSections(sections, priorReport = null, onProgress) {
  const results = {}

  await Promise.all(
    sections
      .filter(s => s.rawNotes?.trim())
      .map(async section => {
        onProgress?.(section.title)
        const prior = priorReport?.sections?.find(s => s.title === section.title)?.body || ''
        results[section.id] = await polishSection(section.title, section.rawNotes, prior)
      })
  )

  return results
}
