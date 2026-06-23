import React, { useState, useEffect } from 'react'
import { generateFollowUpQuestions } from '../services/openai'

const ANSWERS = [
  { value: 'done',        label: '✓ Done',         style: 'bg-green-50 border-green-400 text-green-800 hover:bg-green-100' },
  { value: 'working',     label: '⟳ Still Working', style: 'bg-amber-50 border-amber-400 text-amber-800 hover:bg-amber-100' },
  { value: 'dropped',     label: '✕ Not Anymore',  style: 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100' },
]

const ANSWER_LABELS = {
  done:    'Completed ✓',
  working: 'Still in progress',
  dropped: 'No longer relevant',
}

/**
 * Shows AI-generated follow-up questions based on last week's report.
 * onComplete(followUpContext: string) — called with a summary string for GPT context
 * onSkip() — user skips follow-up entirely
 */
export default function FollowUpModal({ lastReport, onComplete, onSkip }) {
  const [questions, setQuestions]   = useState([])
  const [answers,   setAnswers]     = useState({})  // { qId: 'done'|'working'|'dropped' }
  const [loading,   setLoading]     = useState(true)
  const [error,     setError]       = useState(null)

  useEffect(() => {
    generateFollowUpQuestions(lastReport)
      .then(qs => setQuestions(qs))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function setAnswer(id, value) {
    setAnswers(p => ({ ...p, [id]: value }))
  }

  function handleContinue() {
    // Build a plain-text context string for GPT-4o
    const lines = questions
      .filter(q => answers[q.id])
      .map(q => `- "${q.question}" → ${ANSWER_LABELS[answers[q.id]]}`)
    onComplete(lines.length ? lines.join('\n') : '')
  }

  const answeredCount = Object.keys(answers).length

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-navy-900 text-white px-6 py-4 flex-shrink-0">
          <h2 className="font-bold text-base">Last Week Follow-Up</h2>
          <p className="text-navy-400 text-xs mt-0.5">
            Based on your previous report · {lastReport.dateLabel || lastReport.weekStart}
          </p>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading && (
            <div className="text-center py-10 text-gray-400">
              <div className="animate-spin w-6 h-6 border-2 border-navy-600 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm">Generating follow-up questions…</p>
            </div>
          )}

          {error && (
            <div className="text-center py-6">
              <p className="text-sm text-red-600 mb-4">Could not generate questions: {error}</p>
              <button className="btn-secondary text-sm" onClick={onSkip}>Skip & Continue</button>
            </div>
          )}

          {!loading && !error && questions.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-sm">
              No follow-up questions generated.
            </div>
          )}

          {!loading && !error && questions.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 mb-1">Answer each question — your responses will give GPT-4o context when polishing this week's report.</p>
              {questions.map((q, i) => (
                <div key={q.id} className="border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-800 mb-3">
                    <span className="text-navy-500 font-bold mr-1.5">{i + 1}.</span>
                    {q.question}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ANSWERS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setAnswer(q.id, opt.value)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          answers[q.id] === opt.value
                            ? opt.style + ' ring-2 ring-offset-1 ring-current'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && (
          <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <button className="text-xs text-gray-400 hover:text-gray-600" onClick={onSkip}>
              Skip follow-up
            </button>
            <div className="flex items-center gap-3">
              {answeredCount > 0 && (
                <span className="text-xs text-gray-400">{answeredCount}/{questions.length} answered</span>
              )}
              <button
                className="btn-primary text-sm"
                onClick={handleContinue}
              >
                Continue to New Report →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
