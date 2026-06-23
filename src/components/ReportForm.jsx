import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { polishAllSections } from '../services/openai'
import { saveReport } from '../services/github'
import { downloadPDF } from '../services/pdfGenerator'

// ── Date helpers ───────────────────────────────────────────────────────────────
function thisMonday() {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().split('T')[0]
}
function addDays(iso, n) {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]
}
function formatDateLabel(start, end) {
  if (!start || !end) return ''
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end   + 'T12:00:00')
  return `${s.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
}
function uid() { return `id_${Date.now()}_${Math.random().toString(36).slice(2)}` }

// ── Markdown preview ───────────────────────────────────────────────────────────
/** Render **bold** markers as <strong> inline. */
function Inline({ text }) {
  if (!text || !text.includes('**')) return text
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  )
}

/** Render a block of GPT-4o markdown output as structured HTML. */
function MarkdownPreview({ text }) {
  if (!text?.trim()) return null

  const lines = text.split('\n')
  const elements = []
  let tableLines = []
  let keyIdx = 0

  function flushTable() {
    if (!tableLines.length) return
    const rows = tableLines
      .filter(l => !/^\|[-|\s:]+\|$/.test(l))
      .map(l => l.split('|').slice(1, -1).map(c => c.trim()))
      .filter(r => r.length)

    if (rows.length >= 2) {
      elements.push(
        <div key={`tbl-${keyIdx++}`} className="my-3 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-navy-800 text-white">
                {rows[0].map((h, ci) => (
                  <th key={ci} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                    <Inline text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-blue-50/50' : 'bg-white'}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5 border-b border-gray-100 leading-snug">
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    tableLines = []
  }

  lines.forEach((line, li) => {
    const t = line.trim()

    // Table row
    if (t.startsWith('|') && t.endsWith('|')) {
      tableLines.push(t); return
    }
    flushTable()

    if (!t) { elements.push(<div key={`sp-${li}`} className="h-1.5" />); return }

    // Subsection heading (ends with ":", ≤90 chars, not a bullet)
    if (t.endsWith(':') && t.length <= 90 && !/^[•\-\*]/.test(t)) {
      elements.push(
        <p key={li} className="font-bold text-orange-600 mt-3 mb-0.5 text-sm">
          <Inline text={t} />
        </p>
      ); return
    }

    // Bullet
    if (/^[•\-\*]\s/.test(t)) {
      const bt = t.replace(/^[•\-\*]\s+/, '')
      elements.push(
        <div key={li} className="flex gap-2 my-0.5 pl-1">
          <span className="text-gray-400 flex-shrink-0 text-sm select-none mt-px">•</span>
          <span className="text-sm text-gray-700 leading-relaxed"><Inline text={bt} /></span>
        </div>
      ); return
    }

    // Normal text
    elements.push(
      <p key={li} className="text-sm text-gray-700 leading-relaxed my-0.5">
        <Inline text={t} />
      </p>
    )
  })

  flushTable()
  return <div className="space-y-0">{elements}</div>
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ReportForm({ initialReport, followUpContext = '' }) {
  const { template, latestReport, setReports, setError, clearError } = useApp()

  const monday = thisMonday()
  const [weekStart,       setWeekStart]       = useState(monday)
  const [weekEnd,         setWeekEnd]         = useState(addDays(monday, 6))
  const [projects,        setProjects]        = useState(template.subtitle || '')
  const [sections,        setSections]        = useState([])
  const [upcomingTasks,   setUpcomingTasks]   = useState([])
  const [targetColLabel,  setTargetColLabel]  = useState('Project')
  const [attachedReports, setAttachedReports] = useState([])

  const [polished,    setPolished]    = useState({})
  const [showPol,     setShowPol]     = useState({})
  const [polishing,   setPolishing]   = useState(false)
  const [polishMsg,   setPolishMsg]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!initialReport) return
    setWeekStart(initialReport.weekStart || monday)
    setWeekEnd(initialReport.weekEnd || addDays(initialReport.weekStart || monday, 6))
    setProjects(initialReport.projects || template.subtitle || '')
    setSections((initialReport.sections || []).map(s => ({ ...s })))
    setUpcomingTasks((initialReport.upcomingTasks || []).map(t => ({ ...t })))
    setTargetColLabel(initialReport.targetColumnLabel || 'Project')
    setAttachedReports(initialReport.attachedReports || [])
    const pm = {}
    ;(initialReport.sections || []).forEach(s => { if (s.body) pm[s.id] = s.body })
    setPolished(pm)
    setShowPol({})
    setSaved(false)
  }, [initialReport])

  // Section helpers
  const addSection    = () => { setSections(p => [...p, { id: uid(), title: '', rawNotes: '', body: '' }]); setSaved(false) }
  const removeSection = id => { setSections(p => p.filter(s => s.id !== id)); setPolished(p => { const n={...p}; delete n[id]; return n }); setShowPol(p => { const n={...p}; delete n[id]; return n }); setSaved(false) }
  const moveSection   = (id, dir) => setSections(p => { const a=[...p], i=a.findIndex(s=>s.id===id), j=i+dir; if(j<0||j>=a.length)return p; [a[i],a[j]]=[a[j],a[i]]; return a })
  const updateSection = (id, field, val) => { setSections(p => p.map(s => s.id===id ? {...s,[field]:val} : s)); if(field==='rawNotes') setShowPol(p=>({...p,[id]:false})); setSaved(false) }

  // Task helpers
  const addTask    = () => { setUpcomingTasks(p => [...p, { id: uid(), priority: 'High', task: '', target: '' }]); setSaved(false) }
  const removeTask = id => { setUpcomingTasks(p => p.filter(t => t.id !== id)); setSaved(false) }
  const updateTask = (id, field, val) => { setUpcomingTasks(p => p.map(t => t.id===id ? {...t,[field]:val} : t)); setSaved(false) }
  const moveTask   = (id, dir) => setUpcomingTasks(p => { const a=[...p], i=a.findIndex(t=>t.id===id), j=i+dir; if(j<0||j>=a.length)return p; [a[i],a[j]]=[a[j],a[i]]; return a })

  const updateAttached = (idx, val) => { setAttachedReports(p => p.map((r,i) => i===idx ? val : r)); setSaved(false) }
  const addAttached    = () => { setAttachedReports(p => [...p, '']); setSaved(false) }
  const removeAttached = idx => { setAttachedReports(p => p.filter((_,i) => i!==idx)); setSaved(false) }

  function buildReport() {
    return {
      id: weekStart, weekStart, weekEnd,
      dateLabel: formatDateLabel(weekStart, weekEnd),
      projects,
      sections: sections.map(s => ({
        id: s.id, title: s.title,
        body: showPol[s.id] && polished[s.id] ? polished[s.id] : (s.rawNotes || ''),
        rawNotes: s.rawNotes || '',
      })),
      upcomingTasks: upcomingTasks.map(({ id, priority, task, target }) => ({ id, priority, task, target })),
      targetColumnLabel: targetColLabel,
      attachedReports: attachedReports.filter(r => r.trim()),
      createdAt: new Date().toISOString(),
      polishedAt: Object.keys(polished).length ? new Date().toISOString() : null,
    }
  }

  async function handlePolish() {
    clearError()
    const toPolish = sections.filter(s => s.rawNotes?.trim())
    if (!toPolish.length) { setError('Enter notes in at least one section first.'); return }
    setPolishing(true); setPolishMsg('Connecting to GPT-4o…')
    try {
      const results = await polishAllSections(toPolish, latestReport, t => setPolishMsg(`Polishing: ${t}…`), followUpContext)
      setPolished(p => ({ ...p, ...results }))
      setShowPol(p => { const m={...p}; Object.keys(results).forEach(id => { m[id]=true }); return m })
      setPolishMsg('Done.'); setSaved(false)
    } catch (e) { setError(`OpenAI error: ${e.message}`) }
    setPolishing(false)
  }

  async function handleSave() {
    clearError(); setSaving(true)
    try { const updated = await saveReport(buildReport()); setReports(updated); setSaved(true) }
    catch (e) { setError(`GitHub save error: ${e.message}`) }
    setSaving(false)
  }

  async function handleDownload() {
    clearError(); setDownloading(true)
    try { await downloadPDF(buildReport(), template) }
    catch (e) { setError(`PDF error: ${e.message}`) }
    setDownloading(false)
  }

  const dateLabel = formatDateLabel(weekStart, weekEnd)

  return (
    <div className="flex flex-col gap-4">

      {/* Follow-up context banner */}
      {followUpContext && (
        <div className="section-card border-l-4 border-amber-400 bg-amber-50/50">
          <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
            Last Week's Follow-Up Context
          </h3>
          <div className="space-y-1">
            {followUpContext.split('\n').map((line, i) => (
              <p key={i} className="text-xs text-amber-800 leading-relaxed">{line}</p>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-2 italic">
            GPT-4o will incorporate these status updates when polishing your sections.
          </p>
        </div>
      )}

      {/* Header card */}
      <div className="section-card">
        <h2 className="text-xs font-bold text-navy-700 uppercase tracking-wider mb-3">Report Header</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Week Start</label>
            <input type="date" value={weekStart}
              onChange={e => { setWeekStart(e.target.value); setWeekEnd(addDays(e.target.value, 6)); setSaved(false) }}
              className="input-field" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Week End</label>
            <input type="date" value={weekEnd}
              onChange={e => { setWeekEnd(e.target.value); setSaved(false) }}
              className="input-field" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">{template.projectsLabel || 'Projects'}</label>
            <input type="text" value={projects}
              onChange={e => { setProjects(e.target.value); setSaved(false) }}
              className="input-field" placeholder="e.g. Employ210 & SNCC" />
          </div>
        </div>
        {dateLabel && <p className="mt-2 text-xs text-gray-400 font-mono">{dateLabel}</p>}
      </div>

      {/* Action bar */}
      <div className="section-card flex flex-wrap gap-2 items-center">
        <button className="btn-primary text-sm" onClick={handlePolish} disabled={polishing}>
          {polishing ? polishMsg || 'Polishing…' : '✦ Polish with GPT-4o'}
        </button>
        <button className="btn-secondary text-sm" onClick={handleDownload} disabled={downloading}>
          {downloading ? 'Generating…' : '↓ Download PDF'}
        </button>
        <button className="btn-secondary text-sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : '↑ Save to GitHub'}
        </button>
        <p className="text-xs text-gray-400 ml-auto hidden sm:block">
          GPT-4o uses tables for comparisons + <strong>bold</strong> for key terms
        </p>
      </div>

      {/* Sections */}
      <div className="section-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-navy-700 uppercase tracking-wider">
            Sections ({sections.length})
          </h2>
          <button className="btn-secondary text-xs" onClick={addSection}>+ Add Section</button>
        </div>

        {sections.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            No sections yet — click "+ Add Section" to start.
          </p>
        )}

        <div className="space-y-4">
          {sections.map((sec, idx) => {
            const hasPol = !!polished[sec.id]
            const isPol  = showPol[sec.id] && hasPol

            return (
              <div key={sec.id} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                {/* Title bar */}
                <div className="flex items-center gap-2 bg-navy-50 px-3 py-2 border-b border-gray-200">
                  <span className="text-xs font-bold text-navy-500 w-6 flex-shrink-0">{idx + 1}.</span>
                  <input
                    type="text" value={sec.title}
                    onChange={e => updateSection(sec.id, 'title', e.target.value)}
                    className="flex-1 bg-transparent text-sm font-semibold text-navy-800 focus:outline-none placeholder-gray-300"
                    placeholder="Section title…"
                  />
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hasPol && (
                      <>
                        <button onClick={() => setShowPol(p=>({...p,[sec.id]:false}))}
                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${!isPol ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}>
                          Raw
                        </button>
                        <button onClick={() => setShowPol(p=>({...p,[sec.id]:true}))}
                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${isPol ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}>
                          Polished
                        </button>
                      </>
                    )}
                    <button onClick={() => moveSection(sec.id, -1)} disabled={idx === 0}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs px-1">▲</button>
                    <button onClick={() => moveSection(sec.id, 1)} disabled={idx === sections.length - 1}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs px-1">▼</button>
                    <button onClick={() => removeSection(sec.id)}
                      className="text-red-400 hover:text-red-600 text-xs px-1 ml-1">✕</button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-3 bg-white">
                  {isPol ? (
                    <div>
                      <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-3 min-h-[80px]">
                        <MarkdownPreview text={polished[sec.id]} />
                      </div>
                      <button
                        className="mt-2 text-xs text-navy-600 hover:underline"
                        onClick={() => { updateSection(sec.id, 'rawNotes', polished[sec.id]); setShowPol(p=>({...p,[sec.id]:false})) }}
                      >
                        Edit polished text
                      </button>
                    </div>
                  ) : (
                    <textarea
                      className="input-field font-mono text-sm min-h-[90px] resize-y"
                      placeholder={`Casual notes for section ${idx + 1}…\n\nHints for richer AI output:\n• List items with 2+ attributes → AI creates a table\n• Comparisons / before-after → AI creates a table\n• Sub-topics → use "Key Findings:" style headings`}
                      value={sec.rawNotes || ''}
                      onChange={e => updateSection(sec.id, 'rawNotes', e.target.value)}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming Tasks */}
      <div className="section-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-navy-700 uppercase tracking-wider">
            Upcoming Tasks ({upcomingTasks.length})
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">3rd col:</span>
              <input type="text" value={targetColLabel}
                onChange={e => setTargetColLabel(e.target.value)}
                className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-navy-400"
                placeholder="Project" />
            </div>
            <button className="btn-secondary text-xs" onClick={addTask}>+ Add Task</button>
          </div>
        </div>

        {upcomingTasks.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-3">No tasks yet.</p>
        )}

        {upcomingTasks.length > 0 && (
          <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            <div className="grid grid-cols-[90px_1fr_120px_64px] bg-navy-800 text-white text-xs font-bold px-3 py-2 gap-2">
              <span>Priority</span><span>Task</span><span>{targetColLabel || 'Project'}</span><span/>
            </div>
            {upcomingTasks.map((task, idx) => (
              <div key={task.id}
                className={`grid grid-cols-[90px_1fr_120px_64px] items-center px-3 py-2 gap-2 border-t border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                <select value={task.priority} onChange={e => updateTask(task.id, 'priority', e.target.value)}
                  className="text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none">
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
                <input type="text" value={task.task} onChange={e => updateTask(task.id, 'task', e.target.value)}
                  className="input-field text-xs" placeholder="Task…" />
                <input type="text" value={task.target} onChange={e => updateTask(task.id, 'target', e.target.value)}
                  className="input-field text-xs" placeholder={targetColLabel || 'Project'} />
                <div className="flex items-center gap-1">
                  <button onClick={() => moveTask(task.id, -1)} disabled={idx === 0}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs">▲</button>
                  <button onClick={() => moveTask(task.id, 1)} disabled={idx === upcomingTasks.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs">▼</button>
                  <button onClick={() => removeTask(task.id)}
                    className="text-red-400 hover:text-red-600 text-xs ml-1">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attached Reports */}
      <div className="section-card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-navy-700 uppercase tracking-wider">Attached Reports</h2>
          <button className="btn-secondary text-xs" onClick={addAttached}>+ Add</button>
        </div>
        {attachedReports.length === 0 && (
          <p className="text-xs text-gray-400">Optional — add any deliverables attached to this report.</p>
        )}
        <div className="space-y-2">
          {attachedReports.map((r, idx) => (
            <div key={idx} className="flex gap-2">
              <input type="text" value={r} onChange={e => updateAttached(idx, e.target.value)}
                className="input-field flex-1 text-sm" placeholder="e.g. SNCC Evaluation — Prompt Engineering Report" />
              <button onClick={() => removeAttached(idx)} className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
