import { format } from 'date-fns'
import { apiFetch } from './apiClient'

/**
 * Creates a draft IDR for the signed-in inspector on one project and day. reportDate ('yyyy-MM-dd') is required.
 * Returns the created IDR. A 409 means one already exists for that day; its id is on error.body.existing_idr_id.
 */
export async function createIdr({ projectId, reportDate }) {
  const body = { project_id: projectId, report_date: reportDate }
  const json = await apiFetch('/v1/idrs/', { method: 'POST', body })
  return json.data
}

/**
 * Opens the signed-in inspector's IDR for one day: creates the draft, or, when that day's IDR already exists (409), fetches it.
 * reportDate ('yyyy-MM-dd') defaults to today, local time.
 * Returns { idr, isNew }; idr carries status and submitted_at either way.
 */
export async function createOrGetIdr({ projectId, reportDate = format(new Date(), 'yyyy-MM-dd') }) {
  try {
    return { idr: await createIdr({ projectId, reportDate }), isNew: true }
  } catch (err) {
    if (err.status !== 409 || !err.body?.existing_idr_id) throw err
    return { idr: await getIdr(err.body.existing_idr_id), isNew: false }
  }
}

/**
 * Lists IDRs, most recently edited first. projectId, reporterUuid and status ('draft' | 'submitted' |
 * 'stage1_review' | 'stage2_review' | 'approved') are optional filters. The backend leaves out deleted IDRs and
 * other people's drafts unless an admin asks for them with includeDeleted and includeAllDrafts (a 400 for anyone
 * else); a deleted IDR has status 'deleted'.
 * Returns an array of IDR rows, each with report_count, has_general, reporter_name, stage1_reviewer_name and
 * re_reviewer_name.
 */
export async function listIdrs({ projectId, reporterUuid, status, includeDeleted, includeAllDrafts } = {}) {
  const params = new URLSearchParams()
  if (projectId) params.set('project_id', projectId)
  if (reporterUuid) params.set('reporter_uuid', reporterUuid)
  if (status) params.set('status', status)
  if (includeDeleted) params.set('include_deleted', 'true')
  if (includeAllDrafts) params.set('include_all_drafts', 'true')
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
