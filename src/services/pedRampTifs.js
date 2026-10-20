import { apiFetch } from './apiClient'
import { downloadFile } from './exports'

// A ped ramp's Technical Infeasibility Form (Pedramp Phase 3, S3): DOT's TIF v1.9 for one ramp of an inspection that
// doesn't meet the ADA standards. An inspector or the RE drafts and edits it; only the RE signs and approves it (their
// name and New York licence number); an admin deletes one. A TIF is its sections 1-7's fields with {id, property_id,
// inspection_id, project_id, corner_id, inspection_status, ramp_type, quadrant, ramp_id_label, status ('draft' |
// 'approved'), signer_name, signer_ny_license_no, signed_at, signed_by_name, signed}. Refusals read as the backend
// words them ("TIF is approved — no further edits").

/** Lists an inspection's TIFs, oldest first. */
export async function listInspectionTifs(inspectionId) {
  const json = await apiFetch(`/v1/ped-ramp-inspections/${inspectionId}/tifs`)
  return json.data
}

/** Drafts a TIF for one ramp of an inspection, prefilled from the corner and the ramp, and returns it. */
export async function draftTif(inspectionId, propertyId) {
  const json = await apiFetch(`/v1/ped-ramp-inspections/${inspectionId}/ramps/${propertyId}/tif`, { method: 'POST' })
  return json.data
}

/** Fetches one TIF. */
export async function getTif(tifId) {
  const json = await apiFetch(`/v1/ped-ramp-tifs/${tifId}`)
  return json.data
}

/** Changes some of a draft TIF and returns it; a null clears a text or a choice and unticks a box. */
export async function updateTif(tifId, data) {
  const json = await apiFetch(`/v1/ped-ramp-tifs/${tifId}`, { method: 'PATCH', body: data })
  return json.data
}

/** Signs and approves a TIF as the RE ({signer_name, signer_ny_license_no}) and returns it. */
export async function approveTif(tifId, signer) {
  const json = await apiFetch(`/v1/ped-ramp-tifs/${tifId}/approve`, { method: 'POST', body: signer })
  return json.data
}

/** Admin only: deletes a TIF for good. */
export async function deleteTif(tifId) {
  await apiFetch(`/v1/ped-ramp-tifs/${tifId}`, { method: 'DELETE' })
}

/** Fills the TIF's DOT form as it stands and downloads it through its signed URL. Returns the file name. */
export async function downloadTifForm(tifId) {
  const json = await apiFetch(`/v1/ped-ramp-tifs/${tifId}/dot-pdf`)
  downloadFile(json.data.url, json.data.file_name)
  return json.data.file_name
}
