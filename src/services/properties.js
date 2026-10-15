import { apiFetch } from './apiClient'

// A project's properties ("sites"), each a sidewalk or a ped ramp (kind). A property is {id, project_id, kind, boro,
// bbl, address, property_type, violation_no (a sidewalk's), intersection_street_1, intersection_street_2, quadrant,
// facing_street, ramp_type (a ped ramp's), notes, display_address, block_display, lot_display, created_at, updated_at,
// created_by, deleted_at, deleted_by}; property_type is one of '1_3_family', '4_plus_family', 'expedited'. The list
// adds pir_status, status ({state: 'none' | 'task_ordered' | 'constructed_on', date}) and task_order_no. Reading is for
// a user on the project, or an admin; adding and editing for a member but a demo user (the UI keeps them to an
// admin); deleting and un-deleting for an admin.

/**
 * Lists a project's properties of both kinds, by address (a ped ramp's intersection). projectId is the project's text id (e.g. 'HWS0023'). Soft-deleted
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
 * Adds a property to a project and returns it. Takes its kind and that kind's fields: a sidewalk's {bbl (10 digits),
 * address, property_type, violation_no, boro} or a ped ramp's {boro, intersection_street_1, intersection_street_2,
 * quadrant, facing_street, ramp_type}. The backend trims the text and answers 400 for a blank or over-long value, a
 * malformed BBL or a borough that isn't the BBL's, 422 for an unknown value or a field of the wrong kind, and 409 when
 * a live property of the project has the BBL (the thrown error's body then carries existing_property_id).
 */
export async function createProperty(projectId, data) {
  const json = await apiFetch(`/v1/projects/${projectId}/properties`, { method: 'POST', body: data })
  return json.data
}

/**
 * Changes some of a property and returns it as it now is. A field left out keeps its value; a null or blank notes
 * or violation_no clears it. The backend answers 400 when nothing is sent or the kind would change ("Property kind
 * cannot be changed. Delete and recreate."), and 400 / 422 / 409 as createProperty does.
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
