import { apiFetch } from './apiClient'

// A project's properties ("sites"), each a sidewalk or a ped ramp (kind). A property is {id, project_id, kind, boro,
// block, lot, address, property_type, violation_no (a sidewalk's), intersection_street_1, intersection_street_2,
// quadrant, facing_street, ramp_type (a ped ramp's), notes, display_address, created_at, updated_at,
// created_by, deleted_at, deleted_by, tax_map_frontage_ft, tax_map_source, tax_map_fetched_at (a sidewalk's frontage
// from MapPLUTO, Slice Y1; all null until it is fetched, and always for a ped ramp)}; property_type is one of '1_3_family', '4_plus_family', 'expedited'. The list
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
 * Adds a property to a project and returns it. Takes its kind and that kind's fields: a sidewalk's {boro, block (1-5
 * digits), lot (1-4 digits), address, property_type, violation_no} or a ped ramp's {boro, intersection_street_1,
 * intersection_street_2, quadrant, facing_street, ramp_type}. The backend trims the text, drops a block's and a lot's
 * leading zeros, and answers 400 for a blank or over-long value, 422 for an unknown value, a block or lot that isn't
 * digits, or a field of the wrong kind, and 409 when a live sidewalk of the project is at that borough, block and lot
 * (the thrown error's body then carries existing_property_id).
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
 * Admin only: soft-deletes a property and returns it. It leaves the project's list and frees a sidewalk's lot. Deleting
 * one already deleted succeeds and changes nothing.
 */
export async function softDeleteProperty(propertyId) {
  const json = await apiFetch(`/v1/properties/${propertyId}/admin/soft-delete`, { method: 'POST' })
  return json.data
}

/**
 * Admin only: brings a soft-deleted property back, at its borough, block and lot, and returns it. The backend answers
 * 404 for one that isn't deleted and 409 when another live sidewalk of the project is now there.
 */
export async function undeleteProperty(propertyId) {
  const json = await apiFetch(`/v1/properties/${propertyId}/admin/undelete`, { method: 'POST' })
  return json.data
}

/**
 * Admin only (Slice Y1): asks MapPLUTO for a sidewalk's tax-map frontage now, writes it onto the property and onto its
 * PIR's title blocks but those typed by hand, and returns {frontage_ft, source, fetched_at, pages_updated}. The backend
 * answers 400 for a ped ramp, 409 when the site moved meanwhile, 422 when MapPLUTO has no usable frontage for its lot
 * and 503 when MapPLUTO can't be reached; nothing is written for any of them.
 */
export async function refreshTaxMap(propertyId) {
  const json = await apiFetch(`/v1/properties/${propertyId}/admin/refresh-tax-map`, { method: 'POST' })
  return json.data
}
