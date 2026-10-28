import { apiFetch, apiFetchFile } from './apiClient'
import { saveFile } from './exports'

// The Assessment Summary (R1i): a project's monthly .xlsx for DOT (the accumulative report), a tab per month of
// construction ("Nov 2026") with a row per property, measured as the Construction Reports are. For anyone on the project, demo users included. A project with
// nothing approved still gets a workbook (one "No activity" tab). The polish slice: every month of the range gets a tab,
// every download can be narrowed to a task order's sites (taskOrderId) and comes as CSV too (format 'csv').

// The query string of the Assessment Summary's filters: from, to, a task order and (the tailored download's) sites
function summaryQuery({ from, to, taskOrderId, propertyIds } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (taskOrderId) params.set('task_order_id', taskOrderId)
  for (const id of propertyIds ?? []) params.append('property_id', id)
  return params.toString() ? `?${params}` : ''
}

/**
 * Downloads a project's Assessment Summary, for an optional month range ({from, to}, 'YYYY-MM', inclusive), task order
 * (taskOrderId) and format ('xlsx', the workbook; 'csv', a row per month and site). Returns the file name. Throws
 * apiFetch's error (error.status 400 for a bad range, 403, 404).
 */
export async function downloadAssessmentSummary(projectId, { from, to, taskOrderId, format = 'xlsx' } = {}) {
  return saveFile(await apiFetchFile(
    `/v1/projects/${encodeURIComponent(projectId)}/assessment-summary.${format}${summaryQuery({ from, to, taskOrderId })}`,
    `${projectId}_assessment_summary.${format}`))
}

// The As-Builts & Assessments page (Slice C): the same figures a row per site, summed over a range of days.

/**
 * Fetches a project's constructed sites for an optional range of days ({from, to}, 'YYYY-MM-DD', inclusive) and task
 * order (taskOrderId: its sites only): {range, cost_per_sf_4in, cost_per_sf_7in, sites, totals}, each site
 * {property_id, kind, display_address, block, lot, violation_no, community_board, its 4" and 7" square feet and
 * amounts, grand_total, remarks, used_approval_date}, by address. Throws apiFetch's error (error.status 400 for a bad
 * range, 403, 404).
 */
export async function getAssessmentSites(projectId, { from, to, taskOrderId } = {}) {
  const json = await apiFetch(
    `/v1/projects/${encodeURIComponent(projectId)}/assessment-summary${summaryQuery({ from, to, taskOrderId })}`)
  return json.data
}

/**
 * Downloads the page's view: the range of days ({from, to}), the task order (taskOrderId) and the sites shown
 * (propertyIds; left out, every site in the range), as a one-tab workbook (format 'xlsx') or a CSV ('csv'). Returns
 * the file name. Throws apiFetch's error.
 */
export async function downloadTailoredAssessmentSummary(projectId, { from, to, taskOrderId, propertyIds, format = 'xlsx' } = {}) {
  return saveFile(await apiFetchFile(
    `/v1/projects/${encodeURIComponent(projectId)}/assessment-summary/tailored.${format}`
      + summaryQuery({ from, to, taskOrderId, propertyIds }),
    `${projectId}_assessment_summary_tailored.${format}`))
}
