import React, { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import ReportForm from './components/ReportForm'
import HistoryPanel from './components/HistoryPanel'
import TemplateSetup from './components/TemplateSetup'
import FollowUpModal from './components/FollowUpModal'

function ErrorBanner() {
  const { error, clearError } = useApp()
  if (!error) return null
  return (
    <div className="bg-red-50 border-b border-red-200">
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-start justify-between gap-4">
        <p className="text-sm text-red-700">{error}</p>
        <button onClick={clearError} className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0">✕</button>
      </div>
    </div>
  )
}

function AppShell() {
  const { view, setView, template, reports } = useApp()

  const [loadedReport,    setLoadedReport]    = useState(null)
  const [followUpReport,  setFollowUpReport]  = useState(null) // triggers modal
  const [followUpContext, setFollowUpContext] = useState('')    // answers for GPT

  // Start a new blank report — show follow-up modal if a prior report exists
  function handleNewReport() {
    const latest = reports?.[0]
    if (latest) {
      setFollowUpReport(latest)
    } else {
      setFollowUpContext('')
      setLoadedReport(null)
      setView('form')
    }
  }

  // Load a historical report into the editor (no follow-up)
  function handleLoadReport(report) {
    setFollowUpContext('')
    setLoadedReport({ ...report, _loadKey: Date.now() })
    setView('form')
  }

  function handleFollowUpComplete(ctx) {
    setFollowUpContext(ctx)
    setFollowUpReport(null)
    setLoadedReport(null)
    setView('form')
  }

  function handleFollowUpSkip() {
    setFollowUpContext('')
    setFollowUpReport(null)
    setLoadedReport(null)
    setView('form')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Follow-up modal overlay */}
      {followUpReport && (
        <FollowUpModal
          lastReport={followUpReport}
          onComplete={handleFollowUpComplete}
          onSkip={handleFollowUpSkip}
        />
      )}

      {/* Nav */}
      <header className="bg-navy-900 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-wide truncate">
              {template.reportTitle || 'Weekly Report'} Generator
            </h1>
            <p className="text-xs text-navy-400 truncate">
              {template.subtitle || 'Configure in Template Setup'}
            </p>
          </div>
          <nav className="flex gap-1 flex-shrink-0">
            <button
              onClick={handleNewReport}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === 'form' ? 'bg-navy-600 text-white' : 'text-navy-300 hover:bg-navy-800 hover:text-white'
              }`}
            >
              New Report
            </button>
            <button
              onClick={() => setView('history')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === 'history' ? 'bg-navy-600 text-white' : 'text-navy-300 hover:bg-navy-800 hover:text-white'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setView('setup')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === 'setup' ? 'bg-navy-600 text-white' : 'text-navy-300 hover:bg-navy-800 hover:text-white'
              }`}
            >
              Template
            </button>
          </nav>
        </div>
      </header>

      <ErrorBanner />

      <main className="max-w-4xl mx-auto px-4 py-6 w-full">
        {view === 'form' && (
          <ReportForm
            key={loadedReport?._loadKey ?? 'new'}
            initialReport={loadedReport}
            followUpContext={followUpContext}
          />
        )}
        {view === 'history' && (
          <HistoryPanel onLoad={handleLoadReport} onNewReport={handleNewReport} />
        )}
        {view === 'setup' && <TemplateSetup />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
