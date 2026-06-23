import React, { useState } from 'react'
import { useApp, DEFAULT_TEMPLATE } from '../context/AppContext'
import { extractFromFirstSample } from '../services/pdfParser'

export default function TemplateSetup() {
  const { template, setTemplate, setView } = useApp()

  const [form, setForm] = useState({ ...template })
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState('')
  const [extractError, setExtractError] = useState('')

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleExtract() {
    setExtracting(true)
    setExtractMsg('')
    setExtractError('')
    try {
      const details = await extractFromFirstSample(msg => setExtractMsg(msg))
      if (!details) {
        setExtractError(
          'No sample PDFs found. Make sure files are in public/sample-reports/ named ' +
          'sample-report-01.pdf, sample-report-02.pdf, etc., then redeploy.'
        )
      } else {
        setForm(f => ({ ...f, ...details, isDefault: false }))
        setExtractMsg(`Extracted from ${details.sourceFile}. Review and save below.`)
      }
    } catch (e) {
      setExtractError(e.message)
    }
    setExtracting(false)
  }

  function handleSave() {
    setTemplate({ ...form, isDefault: false })
    setView('form')
  }

  function handleReset() {
    setForm({ ...DEFAULT_TEMPLATE })
  }

  const fields = [
    { key: 'reportTitle',     label: 'Report Title',        hint: '"Weekly Report"' },
    { key: 'subtitle',        label: 'Subtitle',            hint: '"iOS Application Development & SNCC"' },
    { key: 'preparedByLabel', label: '"Prepared by" label', hint: '"Prepared by"' },
    { key: 'preparedBy',      label: 'Your name',           hint: '"Manan Shukla"' },
    { key: 'supervisorLabel', label: '"Supervisor" label',  hint: '"Supervisor"' },
    { key: 'supervisor',      label: 'Supervisor name',     hint: '"Dr. Adel Alaeddini"' },
    { key: 'projectsLabel',   label: '"Projects" label',    hint: '"Projects" or "Project"' },
    { key: 'footer',          label: 'Footer text',         hint: '"Employ210 & SNCC — iOS Application Development"' },
  ]

  return (
    <div className="max-w-xl mx-auto p-4">
      <div className="section-card mb-4">
        <h2 className="text-xl font-bold text-navy-900 mb-1">Template Setup</h2>
        <p className="text-sm text-gray-500 mb-4">
          These values fill the header box and footer of every generated PDF.
          Auto-extract from a sample PDF, or edit manually.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            className="btn-primary text-sm"
            onClick={handleExtract}
            disabled={extracting}
          >
            {extracting ? extractMsg || 'Extracting…' : 'Auto-extract from Sample PDF'}
          </button>
          <button className="btn-secondary text-sm" onClick={handleReset}>
            Reset to Defaults
          </button>
        </div>

        {extractMsg && !extractError && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2 mb-3">
            {extractMsg}
          </p>
        )}
        {extractError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-3">
            {extractError}
          </p>
        )}

        <div className="space-y-3">
          {fields.map(({ key, label, hint }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
              <input
                type="text"
                value={form[key] || ''}
                onChange={e => set(key, e.target.value)}
                className="input-field text-sm"
                placeholder={hint}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <button className="btn-primary" onClick={handleSave}>
            Save Template
          </button>
          {!template.isDefault && (
            <button className="btn-secondary" onClick={() => setView('form')}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="section-card bg-gray-50">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Header Preview</h3>
        <div className="border-2 border-navy-800 rounded p-4 font-mono text-xs">
          <p className="text-center font-bold text-base text-navy-900" style={{ color: '#0c2340' }}>
            {form.reportTitle || '—'}
          </p>
          <p className="text-center font-bold mt-1" style={{ color: '#f15a22' }}>
            {form.subtitle || '—'}
          </p>
          <hr className="my-2 border-gray-400" />
          <div className="space-y-0.5">
            {[
              ['Date:', 'May 12 – May 19, 2026'],
              [(form.preparedByLabel || 'Prepared by') + ':', form.preparedBy || '—'],
              [(form.supervisorLabel  || 'Supervisor')  + ':', form.supervisor || '—'],
              [(form.projectsLabel    || 'Projects')    + ':', '—'],
            ].map(([lbl, val]) => (
              <div key={lbl} className="flex gap-2 text-xs">
                <span className="font-bold text-navy-900 text-right" style={{ minWidth: 100 }}>{lbl}</span>
                <span className="text-gray-600">{val}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-gray-400">{form.footer || '(no footer)'}</p>
      </div>
    </div>
  )
}
