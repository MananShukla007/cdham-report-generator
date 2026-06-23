/**
 * GitHub service — reads and writes the reports JSON file via the GitHub
 * Contents REST API.
 *
 * Env vars:
 *   VITE_GITHUB_TOKEN  — PAT with repo:contents read + write
 *   VITE_GITHUB_REPO   — "owner/repo"
 *   VITE_GITHUB_FILE   — path inside repo, e.g. "data/weekly-reports.json"
 */

function cfg() {
  const token = import.meta.env.VITE_GITHUB_TOKEN
  const repo  = import.meta.env.VITE_GITHUB_REPO
  const file  = import.meta.env.VITE_GITHUB_FILE
  if (!token || !repo || !file) {
    throw new Error(
      'GitHub env vars missing. Set VITE_GITHUB_TOKEN, VITE_GITHUB_REPO, VITE_GITHUB_FILE.'
    )
  }
  return {
    token,
    url: `https://api.github.com/repos/${repo}/contents/${file}`,
  }
}

async function ghFetch(url, options = {}) {
  const { token } = cfg()
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || `GitHub API error: ${res.status}`)
  }
  return res.json()
}

/**
 * Fetch all reports. Returns { reports: [...], sha: string|null }.
 * Returns empty array if file doesn't exist yet.
 */
export async function fetchReports() {
  const { url } = cfg()
  try {
    const data = await ghFetch(url)
    const decoded = atob(data.content.replace(/\n/g, ''))
    const json = JSON.parse(decoded)
    return { reports: json.reports || [], sha: data.sha }
  } catch (err) {
    if (err.message.includes('404') || err.message.includes('Not Found')) {
      return { reports: [], sha: null }
    }
    throw err
  }
}

/**
 * Save (upsert) a report by its id (weekStart date).
 * Fetches current file, upserts, pushes back.
 *
 * @param {Object} report - full report object
 * @returns {Array} updated reports list (newest first)
 */
export async function saveReport(report) {
  const { url } = cfg()
  const { reports, sha } = await fetchReports()

  const now = new Date().toISOString()
  const idx = reports.findIndex(r => r.id === report.id)
  if (idx >= 0) {
    reports[idx] = { ...reports[idx], ...report, updatedAt: now }
  } else {
    reports.push({ ...report, createdAt: report.createdAt || now })
  }

  reports.sort((a, b) => new Date(b.weekStart || b.id) - new Date(a.weekStart || a.id))

  const content = btoa(
    unescape(encodeURIComponent(JSON.stringify({ version: 2, reports }, null, 2)))
  )

  await ghFetch(url, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Weekly report — ${report.dateLabel || report.weekStart}`,
      content,
      ...(sha ? { sha } : {}),
    }),
  })

  return reports
}

/**
 * Delete a report by id.
 * @returns {Array} updated reports list
 */
export async function deleteReport(reportId) {
  const { url } = cfg()
  const { reports, sha } = await fetchReports()
  const filtered = reports.filter(r => r.id !== reportId)
  if (filtered.length === reports.length) return reports

  const content = btoa(
    unescape(encodeURIComponent(JSON.stringify({ version: 2, reports: filtered }, null, 2)))
  )
  await ghFetch(url, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Delete weekly report ${reportId}`,
      content,
      sha,
    }),
  })
  return filtered
}
