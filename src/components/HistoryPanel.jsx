import React, { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { fetchReports, deleteReport } from '../services/github'

export default function HistoryPanel({ onLoad }) {
  const { reports, setReports, setView, setError, clearError } = useApp()
  const [loading,   setLoading]   = useState(false)
  const [deleting,  setDeleting]  = useState(null)
  const [expanded,  setExpanded]  = useState(null)

  async function refresh() {
    clearError()
    setLoading(true)
    try {
      const { reports: fetched } = await fetchReports()
      setReports(fetched)
    } catch (e) {
      setError(`GitHub fetch error: ${e.message}`)
    }
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  async function handleDelete(id) {
    if (!confirm(`Delete report for week of ${id}?`)) return
    clearError()
    setDeleting(id)
    try {
      const updated = await deleteReport(id)
      setReports(updated)
    } catch (e) {
      setError(`Delete error: ${e.message}`)
    }
    setDeleting(null)
  }

  function handleLoad(report) {
    onLoad?.(report)
    setView('form')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="section-card flex items-center justify-between">
        <h2 className="font-bold text-navy-900 text-lg">Report History</h2>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={refresh} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button className="btn-primary text-sm" onClick={() => setView('form')}>
            New Report
          </button>
        </div>
      </div>

      {reports.length === 0 && !loading && (
        <div className="section-card text-center text-gray-400 py-10 text-sm">
          No saved reports yet. Create and save your first report.
        </div>
      )}

      {reports.map(report => (
        <div key={report.id} className="section-card">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-navy-800">{report.dateLabel || `Week of ${report.weekStart}`}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Saved {new Date(report.createdAt).toLocaleString()}
                {report.polishedAt && ' · AI polished'}
                {report.projects && ` · ${report.projects}`}
              </p>
            </div>
            <div className="flex gap-3 flex-shrink-0 text-xs">
              <button
                className="text-navy-600 hover:underline"
                onClick={() => setExpanded(expanded === report.id ? null : report.id)}
              >
                {expanded === report.id ? 'Hide' : 'Preview'}
              </button>
              <button className="text-navy-600 hover:underline" onClick={() => handleLoad(report)}>
                Load
              </button>
              <button
                className="text-red-500 hover:underline"
                onClick={() => handleDelete(report.id)}
                disabled={!!deleting}
              >
                {deleting === report.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>

          {expanded === report.id && (
            <div className="mt-3 border-t pt-3 space-y-3">
              {(report.sections || []).map(s => s.body?.trim() && (
                <div key={s.id}>
                  <h4 className="text-xs font-bold text-navy-700 mb-1">{s.title}</h4>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{s.body}</p>
                </div>
              ))}
              {(report.upcomingTasks || []).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-navy-700 mb-1">Upcoming Tasks</h4>
                  <div className="space-y-0.5">
                    {report.upcomingTasks.map(t => (
                      <p key={t.id} className="text-xs text-gray-600">
                        [{t.priority}] {t.task} — {t.target}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
