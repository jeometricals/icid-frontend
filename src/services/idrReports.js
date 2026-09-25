import { apiFetch } from './apiClient'

/**
 * Adds an empty report of reportType (e.g. 'GEN') to a draft IDR; isAddendum and parentReportId are optional.
 * Returns the created report. A 409 for a second General carries error.body.existing_report_id.
 */
export async function addReport(idrId, { reportType, isAddendum, parentReportId }) {
  const body = { report_type: reportType }
  if (isAddendum !== undefined) body.is_addendum = isAddendum
  if (parentReportId) body.parent_report_id = parentReportId
  const json = await apiFetch(`/v1/idrs/${idrId}/reports`, { method: 'POST', body })
  return json.data
}

/**
 * Replaces a report's report_data with reportData (the whole form state, as a JSON object).
 * Returns the saved report; its updated_at is the save time.
 */
export async function saveReport(idrId, reportId, reportData) {
  const json = await apiFetch(`/v1/idrs/${idrId}/reports/${reportId}`, { method: 'PUT', body: reportData })
  return json.data
}

/**
 * Deletes a report (and any addendums attached to it) from a draft IDR. Resolves with nothing.
 */
export async function deleteReport(idrId, reportId) {
  await apiFetch(`/v1/idrs/${idrId}/reports/${reportId}`, { method: 'DELETE' })
}
