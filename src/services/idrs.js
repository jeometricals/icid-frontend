import { apiFetch } from './apiClient'

/**
 * Creates a draft IDR for one inspector, project and day. reportDate ('yyyy-MM-dd') is required.
 * Returns the created IDR. A 409 means one already exists for that day; its id is on error.body.existing_idr_id.
 */
export async function createIdr({ projectId, reporterUuid, reportDate }) {
  const body = { project_id: projectId, reporter_uuid: reporterUuid, report_date: reportDate }
  const json = await apiFetch('/v1/idrs/', { method: 'POST', body })
  return json.data
}

/**
 * Lists IDRs, most recently edited first. projectId, reporterUuid and status ('draft' | 'submitted') are optional filters.
 * Returns an array of IDR rows, each with report_count and has_general.
 */
export async function listIdrs({ projectId, reporterUuid, status } = {}) {
  const params = new URLSearchParams()
  if (projectId) params.set('project_id', projectId)
  if (reporterUuid) params.set('reporter_uuid', reporterUuid)
  if (status) params.set('status', status)
  const json = await apiFetch(`/v1/idrs/?${params}`)
  return json.data
}

/**
 * Fetches an IDR with its header fields and all its reports (in page order).
 */
export async function getIdr(idrId) {
  const json = await apiFetch(`/v1/idrs/${idrId}`)
  return json.data
}

/**
 * Saves shared header fields on a draft IDR. Pass ONLY the fields that changed: the backend leaves omitted
 * fields untouched and clears fields sent as null, so sending all eight overwrites values edited elsewhere.
 * Returns the updated IDR without its reports.
 */
export async function saveIdrHeader(idrId, header) {
  const json = await apiFetch(`/v1/idrs/${idrId}/header`, { method: 'PUT', body: header })
  return json.data
}

/**
 * Submits a draft IDR, assigning page numbers and locking it. Fails with 400 if the IDR has no reports.
 * Returns the submitted IDR with its reports.
 */
export async function submitIdr(idrId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/submit`, { method: 'POST' })
  return json.data
}
