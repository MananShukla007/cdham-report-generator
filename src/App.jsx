import React, { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import ReportForm from './components/ReportForm'
import HistoryPanel from './components/HistoryPanel'
import TemplateSetup from './components/TemplateSetup'

function Nav() {
  const { view, setView, template } = useApp()

  return (
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
          {[
            ['form',    'New Report'],
            ['history', 'History'],
            ['setup',   'Template'],
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === v
                  ? 'bg-navy-600 text-white'
                  : 'text-navy-300 hover:bg-navy-800 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}

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

function Inner() {
  const { view } = useApp()
  const [loadedReport, setLoadedReport] = useState(null)

  // When user clicks "Load" in history, switch to form with that report
  function handleLoadReport(report) {
    setLoadedReport({ ...report, _loadKey: Date.now() })
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      {view === 'form'    && <ReportForm key={loadedReport?._loadKey} initialReport={loadedReport} />}
      {view === 'history' && <HistoryPanel onLoad={handleLoadReport} />}
      {view === 'setup'   && <TemplateSetup />}
    </main>
  )
}

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen flex flex-col bg-gray-100">
        <Nav />
        <ErrorBanner />
        <Inner />
      </div>
    </AppProvider>
  )
}
