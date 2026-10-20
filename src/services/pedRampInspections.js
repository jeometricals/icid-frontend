import { apiFetch } from './apiClient'
import { downloadFile } from './exports'

// A ped ramp corner's inspection (Pedramp Phase 3): the review and signature wrapper around the corner and its ramps'
// attributes, which keep their own routes (pedRamps.js). draft -> submitted (an inspector signs) -> approved (an RE
// signs); a return (an RE, with a comment) sends it back to draft. An inspection is {id, corner_id, project_id, status,
// requirements_met, inspector_name, submitted_at, re_name, re_signed_at, return_comment, returned_at,
// returned_by_name, tif_count, draft_tif_count, has_dot_pdf, ...}. The backend checks every role; a refusal's detail
// says why ("Signature required before signing an inspection", "Approve or delete this inspection's draft TIFs first").

/** Fetches a corner's inspection (its live one, else its latest approved one), or null when none was started. */
export async function getCornerInspection(cornerId) {
  const json = await apiFetch(`/v1/ped-ramp-corners/${cornerId}/inspection`)
  return json.data
}

/** Starts a corner's inspection as a draft and returns it (an inspector or an RE; 409 when the corner has one). */
export async function startInspection(cornerId) {
  const json = await apiFetch(`/v1/ped-ramp-corners/${cornerId}/inspection/start`, { method: 'POST' })
  return json.data
}

/** Records the answer to "are all ADA requirements met?" (true, false or null) and returns the inspection. */
export async function updateInspection(inspectionId, requirementsMet) {
  const json = await apiFetch(`/v1/ped-ramp-inspections/${inspectionId}`, {
    method: 'PATCH', body: { requirements_met: requirementsMet },
  })
  return json.data
}

/** Submits a draft inspection, signed with the user's signature, and returns it. */
export async function submitInspection(inspectionId) {
  const json = await apiFetch(`/v1/ped-ramp-inspections/${inspectionId}/submit`, { method: 'POST' })
  return json.data
}

/** Returns a submitted inspection to its inspector as a draft, with a comment (required), and returns it. */
export async function returnInspection(inspectionId, comment) {
  const json = await apiFetch(`/v1/ped-ramp-inspections/${inspectionId}/return`, { method: 'POST', body: { comment } })
  return json.data
}

/** Approves a submitted inspection, signed with the RE's signature, and returns it. */
export async function approveInspection(inspectionId) {
  const json = await apiFetch(`/v1/ped-ramp-inspections/${inspectionId}/approve`, { method: 'POST' })
  return json.data
}

/**
 * Admin only: unlocks an approved inspection, back to draft with its approval undone and its approved TIFs back to
 * draft, and returns it (with last_unlocked_at / last_unlocked_by_name). 409 for one that isn't approved.
 */
export async function unlockInspection(inspectionId) {
  const json = await apiFetch(`/v1/ped-ramp-inspections/${inspectionId}/admin/unlock`, { method: 'POST' })
  return json.data
}

/**
 * Downloads an approved inspection's DOT forms as filed at approval, through their signed URL: one PDF, or a ZIP of the
 * form's copies (a corner of more ramps than one DOT form holds) and its approved TIFs. Returns the file name.
 */
export async function downloadInspectionDotForms(inspectionId) {
  const json = await apiFetch(`/v1/ped-ramp-inspections/${inspectionId}/dot-pdf`)
  downloadFile(json.data.url, json.data.file_name)
  return json.data.file_name
}
