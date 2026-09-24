const BASE_URL = import.meta.env.VITE_API_URL || 'https://icid-backend.vercel.app'

/**
 * Turns a FastAPI error body into a readable message.
 * `detail` is a string for HTTPException errors and a list of {msg} objects for 422 validation errors.
 */
function errorMessage(body, status) {
  if (typeof body.detail === 'string') return body.detail
  if (Array.isArray(body.detail)) return body.detail.map(d => d.msg).join('; ')
  return `API error ${status}`
}

/**
 * Calls the ICID backend and returns the parsed JSON response.
 * Takes a path plus optional {method, body}; a body is sent as JSON. Throws on non-2xx responses,
 * with the HTTP code on `error.status` (network failures throw without one).
 */
async function apiFetch(path, { method = 'GET', body } = {}) {
  const init = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE_URL}${path}`, init)
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    const error = new Error(errorMessage(errorBody, res.status))
    error.status = res.status
    throw error
  }
  return res.json()
}

export async function getProjectsForUser(userId) {
  const json = await apiFetch(`/v1/projects/?user_id=${userId}`)
  return json.data
}

export async function getProjectById(projectId) {
  const json = await apiFetch(`/v1/projects/${projectId}`)
  return json.data
}

/**
 * Creates a new draft report. reportDate ('yyyy-MM-dd') is optional; the backend defaults it to today.
 * Returns the created report row ({report_id, status, ...}).
 */
export async function createReport({ projectId, reporterUuid, reportDate }) {
  const body = { project_id: projectId, reporter_uuid: reporterUuid }
  if (reportDate) body.report_date = reportDate
  const json = await apiFetch('/v1/reports/', { method: 'POST', body })
  return json.data
}

/**
 * Saves the whole General Form (camelCase JSON) onto a draft report.
 * Returns {report_id, completed_form_id, saved_at}.
 */
export async function saveGeneralForm(reportId, formData) {
  const json = await apiFetch(`/v1/reports/${reportId}/general`, { method: 'PUT', body: formData })
  return json.data
}

/**
 * Fetches a report with its saved General Form (general_form is null if never saved).
 */
export async function getReport(reportId) {
  const json = await apiFetch(`/v1/reports/${reportId}`)
  return json.data
}

/**
 * Lists a project's reports, most recently edited first. reporterUuid and status ('draft' | 'submitted') are optional filters.
 * Returns an array of report rows, each with a description_preview (null if the form was never saved).
 */
export async function listReports({ projectId, reporterUuid, status }) {
  const params = new URLSearchParams({ project_id: projectId })
  if (reporterUuid) params.set('reporter_uuid', reporterUuid)
  if (status) params.set('status', status)
  const json = await apiFetch(`/v1/reports/?${params}`)
  return json.data
}

/**
 * Submits a draft report, locking it from further edits.
 * Returns the updated report row ({report_id, status: 'submitted', submitted_at, ...}).
 */
export async function submitReport(reportId) {
  const json = await apiFetch(`/v1/reports/${reportId}/submit`, { method: 'POST' })
  return json.data
}
