import React, { useState, useCallback, useEffect } from 'react'
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

function addDays(isoDate, n) {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function formatDateLabel(start, end) {
  if (!start || !end) return ''
  const opts = { month: 'long', day: 'numeric' }
  const optsYear = { month: 'long', day: 'numeric', year: 'numeric' }
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const sStr = s.toLocaleDateString('en-US', opts)
  const eStr = e.toLocaleDateString('en-US', optsYear)
  return `${sStr} – ${eStr}`
}

function uid() { return `id_${Date.now()}_${Math.random().toString(36).slice(2)}` }

// ── Priority badge ─────────────────────────────────────────────────────────────
function PriorityBadge({ value }) {
  const cls = value === 'High'
    ? 'bg-red-100 text-red-700 border-red-200'
    : value === 'Medium'
    ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
    : 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${cls}`}>
      {value}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ReportForm({ initialReport }) {
  const { template, latestReport, setReports, setError, clearError } = useApp()

  // ── Report state ──
  const monday = thisMonday()
  const [weekStart,      setWeekStart]      = useState(monday)
  const [weekEnd,        setWeekEnd]        = useState(addDays(monday, 6))
  const [projects,       setProjects]       = useState(template.subtitle || '')
  const [sections,       setSections]       = useState([])
  const [upcomingTasks,  setUpcomingTasks]  = useState([])
  const [targetColLabel, setTargetColLabel] = useState('Project')
  const [attachedReports,setAttachedReports]= useState([])

  // polished[sectionId] = string
  const [polished,    setPolished]    = useState({})
  // showPolished[sectionId] = bool
  const [showPol,     setShowPol]     = useState({})
  const [polishing,   setPolishing]   = useState(false)
  const [polishMsg,   setPolishMsg]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Load from passed report (history "Load" action)
  useEffect(() => {
    if (!initialReport) return
    setWeekStart(initialReport.weekStart || monday)
    setWeekEnd(initialReport.weekEnd   || addDays(initialReport.weekStart || monday, 6))
    setProjects(initialReport.projects || template.subtitle || '')
    setSections((initialReport.sections || []).map(s => ({ ...s })))
    setUpcomingTasks((initialReport.upcomingTasks || []).map(t => ({ ...t })))
    setTargetColLabel(initialReport.targetColumnLabel || 'Project')
    setAttachedReports(initialReport.attachedReports || [])
    // Restore polished state if present
    const polMap = {}
    ;(initialReport.sections || []).forEach(s => { if (s.body) polMap[s.id] = s.body })
    setPolished(polMap)
    setShowPol({})
    setSaved(false)
  }, [initialReport])

  // ── Section helpers ──
  function addSection() {
    setSections(prev => [...prev, { id: uid(), title: '', rawNotes: '', body: '' }])
    setSaved(false)
  }

  function removeSection(id) {
    setSections(prev => prev.filter(s => s.id !== id))
    setPolished(p => { const n = { ...p }; delete n[id]; return n })
    setShowPol(p => { const n = { ...p }; delete n[id]; return n })
    setSaved(false)
  }

  function moveSection(id, dir) {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === id)
      const next = [...prev]
      const swp = idx + dir
      if (swp < 0 || swp >= next.length) return prev
      ;[next[idx], next[swp]] = [next[swp], next[idx]]
      return next
    })
    setSaved(false)
  }

  function updateSection(id, field, value) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
    if (field === 'rawNotes') {
      setShowPol(p => ({ ...p, [id]: false }))
    }
    setSaved(false)
  }

  // ── Task helpers ──
  function addTask() {
    setUpcomingTasks(prev => [...prev, { id: uid(), priority: 'High', task: '', target: '' }])
    setSaved(false)
  }

  function removeTask(id) {
    setUpcomingTasks(prev => prev.filter(t => t.id !== id))
    setSaved(false)
  }

  function updateTask(id, field, value) {
    setUpcomingTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
    setSaved(false)
  }

  function moveTask(id, dir) {
    setUpcomingTasks(prev => {
      const idx = prev.findIndex(t => t.id === id)
      const next = [...prev]
      const swp = idx + dir
      if (swp < 0 || swp >= next.length) return prev
      ;[next[idx], next[swp]] = [next[swp], next[idx]]
      return next
    })
  }

  // ── Attached reports ──
  function updateAttached(idx, value) {
    setAttachedReports(prev => prev.map((r, i) => i === idx ? value : r))
    setSaved(false)
  }

  function addAttached() {
    setAttachedReports(prev => [...prev, ''])
    setSaved(false)
  }

  function removeAttached(idx) {
    setAttachedReports(prev => prev.filter((_, i) => i !== idx))
    setSaved(false)
  }

  // ── Build report object ──
  function buildReport() {
    const dateLabel = formatDateLabel(weekStart, weekEnd)
    return {
      id:               weekStart,
      weekStart,
      weekEnd,
      dateLabel,
      projects,
      sections:         sections.map(s => ({
        id:       s.id,
        title:    s.title,
        body:     showPol[s.id] && polished[s.id] ? polished[s.id] : (s.rawNotes || ''),
        rawNotes: s.rawNotes || '',
      })),
      upcomingTasks:    upcomingTasks.map(({ id, priority, task, target }) => ({ id, priority, task, target })),
      targetColumnLabel: targetColLabel,
      attachedReports:  attachedReports.filter(r => r.trim()),
      createdAt:        new Date().toISOString(),
      polishedAt:       Object.keys(polished).length ? new Date().toISOString() : null,
    }
  }

  // ── Polish ──
  async function handlePolish() {
    clearError()
    const toPolish = sections.filter(s => s.rawNotes?.trim())
    if (!toPolish.length) { setError('Enter notes in at least one section before polishing.'); return }

    setPolishing(true)
    setPolishMsg('Connecting to GPT-4o…')
    try {
      const results = await polishAllSections(
        toPolish,
        latestReport,
        title => setPolishMsg(`Polishing: ${title}…`)
      )
      setPolished(prev => ({ ...prev, ...results }))
      const modes = {}
      Object.keys(results).forEach(id => { modes[id] = true })
      setShowPol(prev => ({ ...prev, ...modes }))
      setPolishMsg('Done.')
      setSaved(false)
    } catch (e) {
      setError(`OpenAI error: ${e.message}`)
    }
    setPolishing(false)
  }

  // ── Save ──
  async function handleSave() {
    clearError()
    setSaving(true)
    try {
      const updated = await saveReport(buildReport())
      setReports(updated)
      setSaved(true)
    } catch (e) {
      setError(`GitHub save error: ${e.message}`)
    }
    setSaving(false)
  }

  // ── Download ──
  async function handleDownload() {
    clearError()
    setDownloading(true)
    try {
      await downloadPDF(buildReport(), template)
    } catch (e) {
      setError(`PDF error: ${e.message}`)
    }
    setDownloading(false)
  }

  const dateLabel = formatDateLabel(weekStart, weekEnd)

  return (
    <div className="flex flex-col gap-4">

      {/* ── Report header card ── */}
      <div className="section-card">
        <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider mb-3">Report Header</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Week Start (Monday)</label>
            <input type="date" value={weekStart}
              onChange={e => { setWeekStart(e.target.value); setWeekEnd(addDays(e.target.value, 6)); setSaved(false) }}
              className="input-field" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Week End</label>
            <input type="date" value={weekEnd}
              onChange={e => { setWeekEnd(e.target.value); setSaved(false) }}
              className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-gray-500 block mb-1">
              {template.projectsLabel || 'Projects'}
            </label>
            <input type="text" value={projects}
              onChange={e => { setProjects(e.target.value); setSaved(false) }}
              className="input-field"
              placeholder="e.g. Employ210 & SNCC" />
          </div>
        </div>
        {dateLabel && (
          <p className="mt-2 text-xs text-gray-400 font-mono">Date label: {dateLabel}</p>
        )}
      </div>

      {/* ── Action bar ── */}
      <div className="section-card flex flex-wrap gap-2 items-center">
        <button className="btn-primary text-sm" onClick={handlePolish} disabled={polishing}>
          {polishing ? polishMsg || 'Polishing…' : 'Polish with GPT-4o'}
        </button>
        <button className="btn-secondary text-sm" onClick={handleDownload} disabled={downloading}>
          {downloading ? 'Generating…' : 'Download PDF'}
        </button>
        <button className="btn-secondary text-sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save to GitHub'}
        </button>
      </div>

      {/* ── Sections ── */}
      <div className="section-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
            Sections ({sections.length})
          </h2>
          <button className="btn-secondary text-xs" onClick={addSection}>+ Add Section</button>
        </div>

        {sections.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            No sections yet. Click "Add Section" to get started.
          </p>
        )}

        <div className="space-y-4">
          {sections.map((sec, idx) => {
            const hasPolished = !!polished[sec.id]
            const isShowingPolished = showPol[sec.id] && hasPolished

            return (
              <div key={sec.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Section header row */}
                <div className="flex items-center gap-2 bg-navy-50 px-3 py-2 border-b border-gray-200">
                  <span className="text-xs font-bold text-navy-600 w-6 flex-shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={sec.title}
                    onChange={e => updateSection(sec.id, 'title', e.target.value)}
                    className="flex-1 bg-transparent text-sm font-semibold text-navy-800 focus:outline-none placeholder-gray-300"
                    placeholder="Section title…"
                  />
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hasPolished && (
                      <button
                        onClick={() => setShowPol(p => ({ ...p, [sec.id]: false }))}
                        className={`text-xs px-2 py-0.5 rounded border ${!isShowingPolished ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-gray-500 border-gray-300'}`}
                      >Raw</button>
                    )}
                    {hasPolished && (
                      <button
                        onClick={() => setShowPol(p => ({ ...p, [sec.id]: true }))}
                        className={`text-xs px-2 py-0.5 rounded border ${isShowingPolished ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-gray-500 border-gray-300'}`}
                      >Polished</button>
                    )}
                    <button onClick={() => moveSection(sec.id, -1)} disabled={idx === 0}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-25 text-xs px-1">▲</button>
                    <button onClick={() => moveSection(sec.id, 1)} disabled={idx === sections.length - 1}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-25 text-xs px-1">▼</button>
                    <button onClick={() => removeSection(sec.id)}
                      className="text-red-400 hover:text-red-600 text-xs px-1 ml-1">✕</button>
                  </div>
                </div>

                {/* Body */}
                <div className="p-3">
                  {isShowingPolished ? (
                    <>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap bg-blue-50 border border-blue-100 rounded p-3 min-h-[80px] leading-relaxed">
                        {polished[sec.id]}
                      </div>
                      <button
                        className="mt-1.5 text-xs text-navy-600 hover:underline"
                        onClick={() => {
                          updateSection(sec.id, 'rawNotes', polished[sec.id])
                          setShowPol(p => ({ ...p, [sec.id]: false }))
                        }}
                      >
                        Edit polished text
                      </button>
                    </>
                  ) : (
                    <textarea
                      className="input-field font-mono text-sm min-h-[90px] resize-y"
                      placeholder={`Casual notes for section ${idx + 1}…\n\nTip: subsection headings end with ":" (e.g. "Key Achievements:")\nBullets start with "• " or "- "`}
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

      {/* ── Upcoming Tasks ── */}
      <div className="section-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
            Upcoming Tasks ({upcomingTasks.length})
          </h2>
          <div className="flex gap-2">
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500">3rd column:</label>
              <input
                type="text"
                value={targetColLabel}
                onChange={e => setTargetColLabel(e.target.value)}
                className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-navy-400"
                placeholder="Project"
              />
            </div>
            <button className="btn-secondary text-xs" onClick={addTask}>+ Add Task</button>
          </div>
        </div>

        {upcomingTasks.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-3">
            No upcoming tasks. Click "+ Add Task" to add.
          </p>
        )}

        {/* Table header */}
        {upcomingTasks.length > 0 && (
          <div className="rounded overflow-hidden border border-gray-200">
            <div className="grid grid-cols-[90px_1fr_130px_70px] bg-navy-800 text-white text-xs font-bold px-3 py-2 gap-2">
              <span>Priority</span>
              <span>Task</span>
              <span>{targetColLabel || 'Project'}</span>
              <span></span>
            </div>

            {upcomingTasks.map((task, idx) => (
              <div key={task.id}
                className="grid grid-cols-[90px_1fr_130px_70px] items-center px-3 py-2 gap-2 border-t border-gray-100 hover:bg-gray-50">
                <select
                  value={task.priority}
                  onChange={e => updateTask(task.id, 'priority', e.target.value)}
                  className="text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-navy-400"
                >
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
                <input
                  type="text"
                  value={task.task}
                  onChange={e => updateTask(task.id, 'task', e.target.value)}
                  className="input-field text-xs"
                  placeholder="Task description…"
                />
                <input
                  type="text"
                  value={task.target}
                  onChange={e => updateTask(task.id, 'target', e.target.value)}
                  className="input-field text-xs"
                  placeholder={targetColLabel || 'Project'}
                />
                <div className="flex items-center gap-1">
                  <button onClick={() => moveTask(task.id, -1)} disabled={idx === 0}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-25 text-xs">▲</button>
                  <button onClick={() => moveTask(task.id, 1)} disabled={idx === upcomingTasks.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-25 text-xs">▼</button>
                  <button onClick={() => removeTask(task.id)}
                    className="text-red-400 hover:text-red-600 text-xs ml-1">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Attached Reports (optional) ── */}
      <div className="section-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
            Attached Reports (optional)
          </h2>
          <button className="btn-secondary text-xs" onClick={addAttached}>+ Add</button>
        </div>
        {attachedReports.length === 0 && (
          <p className="text-xs text-gray-400">None — click "+ Add" if you have attached deliverables.</p>
        )}
        <div className="space-y-2">
          {attachedReports.map((r, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={r}
                onChange={e => updateAttached(idx, e.target.value)}
                className="input-field flex-1 text-sm"
                placeholder="e.g. SNCC Evaluation — Prompt Engineering Report"
              />
              <button onClick={() => removeAttached(idx)}
                className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
