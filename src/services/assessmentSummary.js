import { apiFetchFile } from './apiClient'
import { saveFile } from './exports'

// The Assessment Summary (R1i): a project's monthly .xlsx for DOT, a tab per month of construction with a row per
// property, measured as the Construction Reports are. For anyone on the project, demo users included. A project with
// nothing approved still gets a workbook (one "No activity" tab).

/**
 * Downloads a project's Assessment Summary, for an optional month range ({from, to}, 'YYYY-MM', inclusive). Returns
 * the file name. Throws apiFetch's error (error.status 400 for a bad range, 403, 404).
 */
export async function downloadAssessmentSummary(projectId, { from, to } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString() ? `?${params}` : ''
  return saveFile(await apiFetchFile(`/v1/projects/${encodeURIComponent(projectId)}/assessment-summary.xlsx${query}`,
    `${projectId}_assessment_summary.xlsx`))
}
