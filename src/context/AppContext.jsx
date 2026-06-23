import React, { createContext, useContext, useEffect, useReducer } from 'react'

// ── Defaults drawn from the three sample PDFs ─────────────────────────────────
export const DEFAULT_TEMPLATE = {
  reportTitle:    'Weekly Report',
  subtitle:       'iOS Application Development & SNCC',
  preparedBy:     'Manan Shukla',
  supervisor:     'Dr. Adel Alaeddini',
  preparedByLabel: 'Prepared by',
  supervisorLabel: 'Supervisor',
  projectsLabel:  'Projects',      // "Projects" or "Project"
  footer:         'Employ210 & SNCC — iOS Application Development',
  isDefault:      true,
}

/** Build a blank report scaffolded from the template. */
export function blankReport(template) {
  return {
    id:               '',
    weekStart:        '',
    weekEnd:          '',
    dateLabel:        '',
    projects:         template.subtitle || '',
    sections:         [],         // [{ id, title, body, rawNotes }]
    upcomingTasks:    [],         // [{ id, priority, task, target }]
    targetColumnLabel: 'Project',
    attachedReports:  [],         // [string]
    createdAt:        null,
    polishedAt:       null,
  }
}

const STORAGE_KEY       = 'cdham_template_v2'
const REPORTS_CACHE_KEY = 'cdham_reports_cache_v2'

function loadTemplate() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null } catch { return null }
}
function loadCachedReports() {
  try { return JSON.parse(localStorage.getItem(REPORTS_CACHE_KEY)) || [] } catch { return [] }
}

// ── Reducer ───────────────────────────────────────────────────────────────────
const init = {
  template:   loadTemplate() || DEFAULT_TEMPLATE,
  reports:    loadCachedReports(),
  view:       'form',
  loading:    false,
  loadingMsg: '',
  error:      null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TEMPLATE':  return { ...state, template: action.payload }
    case 'SET_REPORTS':   return { ...state, reports:  action.payload }
    case 'SET_VIEW':      return { ...state, view: action.payload, error: null }
    case 'SET_LOADING':   return { ...state, loading: action.payload, loadingMsg: action.msg || '' }
    case 'SET_ERROR':     return { ...state, error: action.payload, loading: false }
    case 'CLEAR_ERROR':   return { ...state, error: null }
    default:              return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, init)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.template))
  }, [state.template])

  useEffect(() => {
    localStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(state.reports))
  }, [state.reports])

  return (
    <AppContext.Provider value={{
      ...state,
      latestReport: state.reports[0] || null,
      setTemplate: t  => dispatch({ type: 'SET_TEMPLATE', payload: t }),
      setReports:  r  => dispatch({ type: 'SET_REPORTS',  payload: r }),
      setView:     v  => dispatch({ type: 'SET_VIEW',     payload: v }),
      setLoading:  (v, m) => dispatch({ type: 'SET_LOADING', payload: v, msg: m }),
      setError:    m  => dispatch({ type: 'SET_ERROR',    payload: m }),
      clearError:  () => dispatch({ type: 'CLEAR_ERROR' }),
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
