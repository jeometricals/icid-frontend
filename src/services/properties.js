import { apiFetch } from './apiClient'

// A project's properties. A property is {id, project_id, bbl, address, property_type, notes, created_at, updated_at,
// created_by, deleted_at, deleted_by}; property_type is one of '1_3_family', '4_plus_family', 'expedited'.
// Reading is for a user on the project, or an admin; every change is admin only (anyone else gets a 403).

/**
 * Lists a project's properties, by address. projectId is the project's text id (e.g. 'HWS0023'). Soft-deleted
 * ones are left out unless includeDeleted is true, which the backend only honours for an admin. Returns [] for a
 * project with none. The backend answers 403 for a user who isn't on the project and 404 for an unknown project.
 */
export async function listProperties(projectId, { includeDeleted = false } = {}) {
  const query = includeDeleted ? '?include_deleted=true' : ''
  const json = await apiFetch(`/v1/projects/${projectId}/properties${query}`)
  return json.data
}

/** Fetches one property, soft-deleted or not. The backend answers 404 for an unknown property. */
export async function getProperty(propertyId) {
  const json = await apiFetch(`/v1/properties/${propertyId}`)
  return json.data
}

/**
 * Admin only: adds a property to a project and returns it. Takes {bbl, address, property_type, notes}; notes may
 * be null. The backend trims the text and answers 400 for a blank or over-long value, 422 for an unknown
 * property_type and 409 when a live property of the project has the BBL (the thrown error's body then carries
 * existing_property_id).
 */
export async function createProperty(projectId, data) {
  const json = await apiFetch(`/v1/projects/${projectId}/properties`, { method: 'POST', body: data })
  return json.data
}

/**
 * Admin only: changes some of a property and returns it as it now is. A field left out keeps its value; a null
 * or blank notes clears them. The backend answers 400 when nothing is sent, and 400 / 422 / 409 as
 * createProperty does.
 */
export async function updateProperty(propertyId, data) {
  const json = await apiFetch(`/v1/properties/${propertyId}`, { method: 'PATCH', body: data })
  return json.data
}

/**
 * Admin only: soft-deletes a property and returns it. It leaves the project's list and frees its BBL. Deleting
 * one already deleted succeeds and changes nothing.
 */
export async function softDeleteProperty(propertyId) {
  const json = await apiFetch(`/v1/properties/${propertyId}/admin/soft-delete`, { method: 'POST' })
  return json.data
}

/**
 * Admin only: brings a soft-deleted property back, with its BBL, and returns it. The backend answers 404 for one
 * that isn't deleted and 409 when another live property of the project now has its BBL.
 */
export async function undeleteProperty(propertyId) {
  const json = await apiFetch(`/v1/properties/${propertyId}/admin/undelete`, { method: 'POST' })
  return json.data
}
