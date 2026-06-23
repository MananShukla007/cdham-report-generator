/**
 * OpenAI service — GPT-4o converts casual notes into structured, professional
 * weekly report content with tables, bold terms, and clear hierarchy.
 */

const BASE = 'https://api.openai.com/v1/chat/completions'

function key() {
  const k = import.meta.env.VITE_OPENAI_KEY
  if (!k) throw new Error('VITE_OPENAI_KEY is not set')
  return k
}

const SYSTEM = `You are a professional technical report writer for an iOS application development team. Your output is inserted directly into a PDF weekly status report.

═══ FORMATTING RULES (follow strictly) ═══

1. TABLES — Use a markdown table any time information has 2 or more attributes per item.
   Situations that REQUIRE a table:
   • Comparisons (e.g. solution vs time saved, option A vs option B)
   • Before/after metrics (metric | before | after | change)
   • Lists of features/items with properties (name | status | notes)
   • Evaluation states or categories (state | color | meaning)
   • Multi-column data of any kind

   Table format (always include the separator row):
   | Column A | Column B | Column C |
   |----------|----------|----------|
   | Value    | Value    | Value    |

2. BOLD — Wrap with **double asterisks** around:
   • All key metrics and numbers: "accuracy improved from **74%** to **90%**"
   • All proper names and tools: "coordinated with **Yassine** on **AWS Lambda**"
   • Technical terms on first use: "using **AVFoundation** framework"
   • Any result or outcome worth highlighting

3. SUBSECTION HEADINGS — For major sub-topics, write a label on its own line ending with ":"
   (This renders in bold orange in the PDF.)
   e.g.  "Key Achievements:"
   e.g.  "Issues Identified & Fixed:"
   e.g.  "Resolution Steps:"

4. BULLETS — Use "• " prefix for enumerable items that don't have tabular structure.
   Bold the item label: "• **Confusion Matrix Analysis:** description..."

5. STRUCTURE — Always open with 1–2 sentence summary, then use headings/tables/bullets for detail.

═══ CONTENT RULES ═══
• Third-person voice ("Work was completed...", "Significant progress was made...")
• Preserve ALL specific numbers, names, dates, and metrics exactly as given
• Do NOT invent information not in the notes
• Do NOT include a section title or number — body text only
• Be concise; do not pad with filler`

/**
 * Polish a single section's casual notes into structured report content.
 */
export async function polishSection(sectionTitle, rawNotes, priorBody = '', followUpContext = '') {
  const priorCtx = priorBody
    ? `\n\nTone reference — same section from last week:\n"""\n${priorBody.slice(0, 600)}\n"""`
    : ''

  const followCtx = followUpContext
    ? `\n\nStatus updates from last week's follow-up (incorporate naturally where relevant):\n${followUpContext}`
    : ''

  const user = `Section: "${sectionTitle}"${priorCtx}${followCtx}

Casual notes:
"""
${rawNotes}
"""

Write the polished section body. Use tables wherever data is comparative or multi-attribute. Use **bold** on key terms and metrics:`

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
      temperature: 0.2,
      max_tokens: 1000,
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
 * @returns {Object} map { sectionId: polishedText }
 */
export async function polishAllSections(sections, priorReport = null, onProgress, followUpContext = '') {
  const results = {}
  await Promise.all(
    sections
      .filter(s => s.rawNotes?.trim())
      .map(async section => {
        onProgress?.(section.title)
        const prior = priorReport?.sections?.find(s => s.title === section.title)?.body || ''
        results[section.id] = await polishSection(section.title, section.rawNotes, prior, followUpContext)
      })
  )
  return results
}

/**
 * Generate follow-up questions based on last week's report.
 * @returns {Array} [{ id, question, taskRef }]
 */
export async function generateFollowUpQuestions(lastReport) {
  const tasks = (lastReport.upcomingTasks || [])
    .filter(t => t.task?.trim())
    .map(t => `- [${t.priority}] ${t.task}`)
    .join('\n')

  const sectionSnippets = (lastReport.sections || [])
    .filter(s => s.body?.trim())
    .slice(0, 3)
    .map(s => `${s.title}: ${s.body.slice(0, 250)}`)
    .join('\n\n')

  const prompt = `Last week's upcoming tasks:\n${tasks || '(none listed)'}\n\nWork summary excerpts:\n${sectionSnippets || '(none)'}\n\nGenerate 3 to 6 concise follow-up questions to ask the engineer at the start of this week. Each question should check on a specific task or known issue from last week — e.g. "Did you complete X?" or "Was the Y bug resolved?"\n\nReturn JSON: {"questions": [{"id": "q1", "question": "...", "taskRef": "brief label for what this is about"}]}`

  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key()}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You generate follow-up questions for a weekly status report. Return only valid JSON with a "questions" array.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `OpenAI error ${res.status}`)
  }
  const data = await res.json()
  const parsed = JSON.parse(data.choices[0].message.content)
  return Array.isArray(parsed) ? parsed : (parsed.questions || [])
}
