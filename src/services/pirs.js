import { apiFetch } from './apiClient'

// A property's PIR: the DOT survey sheet its inspector signed, digitized by an admin. One live PIR per property.
// A PIR is {id, property_id, project_id, source_image_url, source_image_scale, inspector_initials,
// inspector_sign_date ('YYYY-MM-DD'), digitized_by, digitized_at, as_built_signed_by, as_built_signed_at,
// created_at, updated_at, deleted_at, deleted_by}. Reading is for a user on the property's project, or an admin;
// every change is admin only (anyone else gets a 403).

/**
 * Fetches a property's live PIR, or null when it has none. The backend's 404 is the same for an unknown property,
 * so that reads as null too; any other refusal is thrown.
 */
export async function getPirByProperty(propertyId) {
  try {
    const json = await apiFetch(`/v1/properties/${propertyId}/pir`)
    return json.data
  } catch (err) {
    if (err.status === 404) return null
    throw err
  }
}

/**
 * Lists a property's PIRs, most recently digitized first: the live one and, when includeDeleted is true (honoured
 * for an admin only), the soft-deleted ones. The backend answers 404 for an unknown property.
 */
export async function listPirs(propertyId, { includeDeleted = false } = {}) {
  const query = includeDeleted ? '?include_deleted=true' : ''
  const json = await apiFetch(`/v1/properties/${propertyId}/pirs${query}`)
  return json.data
}

/** Fetches one PIR, soft-deleted or not. The backend answers 404 for an unknown one. */
export async function getPir(pirId) {
  const json = await apiFetch(`/v1/pirs/${pirId}`)
  return json.data
}

/**
 * Admin only: digitizes a PIR for a property, by the signed-in admin, now, and returns it. Takes
 * {inspector_initials, inspector_sign_date}. The backend trims the initials and answers 400 for blank or
 * over-long initials or a deleted property, 422 for a malformed date and 409 when the property already has a
 * live PIR (the thrown error's body then carries existing_pir_id).
 */
export async function createPir(propertyId, data) {
  const json = await apiFetch(`/v1/properties/${propertyId}/pir`, { method: 'POST', body: data })
  return json.data
}

/**
 * Admin only: changes a PIR's inspector initials or sign date and returns it as it now is. A field left out
 * keeps its value. The backend answers 400 when nothing is sent or the initials don't fit, and 422 for a
 * malformed date.
 */
export async function updatePir(pirId, data) {
  const json = await apiFetch(`/v1/pirs/${pirId}`, { method: 'PATCH', body: data })
  return json.data
}

/**
 * Admin only: soft-deletes a PIR and returns it. Its property can then take a new one. Deleting one already
 * deleted succeeds and changes nothing.
 */
export async function softDeletePir(pirId) {
  const json = await apiFetch(`/v1/pirs/${pirId}/admin/soft-delete`, { method: 'POST' })
  return json.data
}

/**
 * Admin only: brings a soft-deleted PIR back and returns it. The backend answers 404 for one that isn't deleted
 * and 409 when its property now has another live PIR.
 */
export async function undeletePir(pirId) {
  const json = await apiFetch(`/v1/pirs/${pirId}/admin/undelete`, { method: 'POST' })
  return json.data
}
