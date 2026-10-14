import { apiFetch } from './apiClient'

// A PIR's flags: the sidewalk pieces its survey sheet marks, each a shape with dimensions in feet. A flag is {id,
// pir_id, property_id, project_id, display_order, added_in_field, shape, dimensions, sketch_x, sketch_y, rotation,
// surveyed_mark, surveyed_is_assessable, surveyed_non_assessable_reason, surveyed_thickness, is_constructed,
// pay_item_id (a contract item's contract_item_id, or null), computed_quantity (the area in SF, from the shape),
// reported_quantity (an override, or null), quantity (what counts), is_overridden, quantity_delta_reason,
// created_at, updated_at, created_by, deleted_at, deleted_by}. Reading, adding and editing are for anyone on the
// project (not a demo user, who only reads); deleting and un-deleting for an admin.

/**
 * Lists a PIR's flags by display order. Soft-deleted ones are left out unless includeDeleted is true, which the
 * backend only honours for an admin. The backend answers 403 for a user who isn't on the project and 404 for an
 * unknown PIR.
 */
export async function listFlags(pirId, { includeDeleted = false } = {}) {
  const query = includeDeleted ? '?include_deleted=true' : ''
  const json = await apiFetch(`/v1/pirs/${pirId}/flags${query}`)
  return json.data
}

/** Fetches one flag, soft-deleted or not. The backend answers 404 for an unknown one. */
export async function getFlag(flagId) {
  const json = await apiFetch(`/v1/flags/${flagId}`)
  return json.data
}

/**
 * Adds a flag to a PIR and returns it, its area computed by the backend. Takes {display_order, shape, dimensions,
 * surveyed_mark, surveyed_is_assessable, surveyed_non_assessable_reason, surveyed_thickness, added_in_field,
 * pay_item_id, reported_quantity, quantity_delta_reason}. The backend answers 422 for dimensions or values that
 * break a rule, 400 for a deleted PIR or property (anyone but an admin) or a pay item of another project, and 403
 * for a demo user.
 */
export async function createFlag(pirId, data) {
  const json = await apiFetch(`/v1/pirs/${pirId}/flags`, { method: 'POST', body: data })
  return json.data
}

/**
 * Changes some of a flag and returns it as it now is, its area computed again. A field left out keeps its value;
 * a null clears surveyed_non_assessable_reason, pay_item_id or quantity_delta_reason, and on reported_quantity
 * reverts to the computed area. The merged flag is checked as a new one is (422); 400 when nothing is sent, and
 * as createFlag otherwise.
 */
export async function updateFlag(flagId, data) {
  const json = await apiFetch(`/v1/flags/${flagId}`, { method: 'PATCH', body: data })
  return json.data
}

/** Admin only: soft-deletes a flag and returns it. Deleting one already deleted succeeds and changes nothing. */
export async function softDeleteFlag(flagId) {
  const json = await apiFetch(`/v1/flags/${flagId}/admin/soft-delete`, { method: 'POST' })
  return json.data
}

/** Admin only: brings a soft-deleted flag back and returns it. The backend answers 404 for one that isn't deleted. */
export async function undeleteFlag(flagId) {
  const json = await apiFetch(`/v1/flags/${flagId}/admin/undelete`, { method: 'POST' })
  return json.data
}
