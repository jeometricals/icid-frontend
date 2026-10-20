import { apiFetch, apiFetchFile } from './apiClient'
import { saveFile } from './exports'
import { rampKeys } from '../data/pedRampForm'

// Ped ramp inspection (pedramp 2a): NYC DOT's Pedestrian Ramp Inspection Form as data. A corner is the form's sections
// 1-3 ({corner_id, project_id, boro, north_south_street, east_west_street, ... , ramps}); its ramps are the ped ramp
// sites placed at it (a property's corner_id), each {property_id, display_address, ramp_type, quadrant, ramp_id_label,
// has_attributes}. A ramp's attributes are its section 5, with the ADA warnings their values raise ({field, value,
// limit, message}), which never stop a save. Reading is for anyone on the project; writing for a member but a demo
// user; deleting a corner for an admin.

/** Lists a project's live corners (and, for an admin who asks, its deleted ones), each with its ramps. */
export async function listCorners(projectId, { includeDeleted = false } = {}) {
  const query = includeDeleted ? '?include_deleted=true' : ''
  const json = await apiFetch(`/v1/projects/${projectId}/ped-ramp-corners${query}`)
  return json.data
}

/**
 * Adds a ped ramp site (Slice R): a corner and a ramp at it, in one statement. A live corner of the project at the same
 * borough, streets (any case) and corner_direction is reused as it stands (the corner fields sent are then ignored).
 * boro, north_south_street, east_west_street, corner_direction, quadrant, facing_street and ramp_type are required;
 * ramp_id_label and notes are optional. Returns {corner_id, property_id, corner_reused}.
 */
export async function createPedrampSite(projectId, data) {
  const json = await apiFetch(`/v1/projects/${projectId}/pedramp-sites`, { method: 'POST', body: data })
  return json.data
}

/** Fetches one corner, deleted or not, with its ramps. */
export async function getCorner(cornerId) {
  const json = await apiFetch(`/v1/ped-ramp-corners/${cornerId}`)
  return json.data
}

/**
 * Adds a corner to a project and returns it. boro, north_south_street and east_west_street are required; the backend
 * trims the text and answers 422 for one missing or blank, an unknown choice or text too long.
 */
export async function createCorner(projectId, data) {
  const json = await apiFetch(`/v1/projects/${projectId}/ped-ramp-corners`, { method: 'POST', body: data })
  return json.data
}

/** Changes some of a corner and returns it; a null clears an optional field. 400 when nothing is sent. */
export async function updateCorner(cornerId, data) {
  const json = await apiFetch(`/v1/ped-ramp-corners/${cornerId}`, { method: 'PATCH', body: data })
  return json.data
}

/** Admin only: soft-deletes a corner and returns it. Its ramps keep it as their corner. */
export async function deleteCorner(cornerId) {
  const json = await apiFetch(`/v1/ped-ramp-corners/${cornerId}`, { method: 'DELETE' })
  return json.data
}

/** Fetches a ped ramp's attributes with their warnings; null when none have been entered (the backend's 404). */
export async function getRampAttributes(propertyId) {
  try {
    const json = await apiFetch(`/v1/properties/${propertyId}/ped-ramp-attributes`)
    return json.data
  } catch (err) {
    if (err.status === 404 && err.message === 'Ramp attributes not entered') return null
    throw err
  }
}

/**
 * Saves a ped ramp's attributes whole (a field left out is cleared) and returns them with their warnings. The backend
 * answers 422 for a field of another ramp type, a negative length or an unknown choice.
 */
export async function saveRampAttributes(propertyId, data) {
  const json = await apiFetch(`/v1/properties/${propertyId}/ped-ramp-attributes`, { method: 'PUT', body: data })
  return json.data
}

/**
 * Sets a ramp's Ramp ID (ramp_id_label), keeping its other attributes: reads them, then saves them whole with the new
 * label, sending only the keys of its ramp type (rampType, as it now is). Returns the saved attributes.
 */
export async function saveRampLabel(propertyId, rampType, label) {
  const current = await getRampAttributes(propertyId)
  const kept = Object.fromEntries(rampKeys(rampType).map(key => [key, current?.[key] ?? null]))
  return saveRampAttributes(propertyId, { ...kept, ramp_id_label: label })
}

/** Downloads a corner's inspection report as a PDF. Returns the file name. Throws apiFetch's error. */
export async function downloadInspectionReport(cornerId) {
  return saveFile(await apiFetchFile(`/v1/ped-ramp-corners/${cornerId}/inspection-report.pdf`,
    'ped_ramp_inspection.pdf'))
}
