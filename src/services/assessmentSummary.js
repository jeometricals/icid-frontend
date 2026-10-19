import { apiFetch, apiFetchFile } from './apiClient'
import { saveFile } from './exports'

// The Assessment Summary (R1i): a project's monthly .xlsx for DOT (the accumulative report), a tab per month of
// construction ("Nov 2026") with a row per property, measured as the Construction Reports are. For anyone on the project, demo users included. A project with
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

// The As-Builts & Assessments page (Slice C): the same figures a row per site, summed over a range of days.

/**
 * Fetches a project's constructed sites for an optional range of days ({from, to}, 'YYYY-MM-DD', inclusive): {range,
 * cost_per_sf_4in, cost_per_sf_7in, sites, totals}, each site {property_id, kind, display_address, block, lot,
 * violation_no, community_board, its 4" and 7" square feet and amounts, grand_total, remarks, used_approval_date}, by
 * address. Throws apiFetch's error (error.status 400 for a bad range, 403, 404).
 */
export async function getAssessmentSites(projectId, { from, to } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString() ? `?${params}` : ''
  const json = await apiFetch(`/v1/projects/${encodeURIComponent(projectId)}/assessment-summary${query}`)
  return json.data
}

/**
 * Downloads the page's view as a one-tab workbook: the range of days ({from, to}) and the sites shown (propertyIds;
 * left out, every site in the range). Returns the file name. Throws apiFetch's error.
 */
export async function downloadTailoredAssessmentSummary(projectId, { from, to, propertyIds } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  for (const id of propertyIds ?? []) params.append('property_id', id)
  const query = params.toString() ? `?${params}` : ''
  return saveFile(await apiFetchFile(
    `/v1/projects/${encodeURIComponent(projectId)}/assessment-summary/tailored.xlsx${query}`,
    `${projectId}_assessment_summary_tailored.xlsx`))
}
