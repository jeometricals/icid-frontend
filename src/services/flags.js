import { apiFetch } from './apiClient'

// A PIR's flags: the sidewalk pieces its survey sheet marks, each a shape with dimensions in feet, drawn on one of
// the PIR's pages. A flag is {id, pir_id, pir_page_id, property_id, project_id, display_order, added_in_field, shape,
// dimensions, sketch_x, sketch_y, rotation, surveyed_mark, surveyed_is_assessable, surveyed_non_assessable_reason,
// surveyed_thickness, is_constructed, pay_item_id (a contract item's contract_item_id, or null), computed_quantity
// (the area in SF, from the shape), reported_quantity (an override, or null), quantity (what counts), is_overridden,
// quantity_delta_reason, created_at, updated_at, created_by, deleted_at, deleted_by}. sketch_x / sketch_y are in the
// page's native, unrotated pixels (lib/pageGeometry.js). Reading is for anyone on the project; adding, editing and
// deleting for anyone on it but a demo user.

/**
 * Lists a PIR's live flags across its live pages, by display order. The backend answers 403 for a user who isn't on
 * the project and 404 for an unknown PIR.
 */
export async function listFlags(pirId) {
  const json = await apiFetch(`/v1/pirs/${pirId}/flags`)
  return json.data
}

/** Fetches one flag, soft-deleted or not. The backend answers 404 for an unknown one. */
export async function getFlag(flagId) {
  const json = await apiFetch(`/v1/flags/${flagId}`)
  return json.data
}

/**
 * Adds a flag to a page and returns it, its area computed by the backend. Takes the page's id and {display_order,
 * shape, dimensions, sketch_x, sketch_y, rotation, surveyed_mark, surveyed_is_assessable,
 * surveyed_non_assessable_reason, surveyed_thickness, added_in_field, pay_item_id, reported_quantity,
 * quantity_delta_reason}. The backend answers 422 for dimensions or values that break a rule, 400 for a replaced
 * page, a deleted PIR or property (anyone but an admin) or a pay item of another project, and 403 for a demo user.
 */
export async function createFlagOnPage(pirPageId, data) {
  const json = await apiFetch(`/v1/pir-pages/${pirPageId}/flags`, { method: 'POST', body: data })
  return json.data
}

/**
 * Changes some of a flag and returns it as it now is, its area computed again. A field left out keeps its value;
 * a null clears sketch_x, sketch_y, surveyed_non_assessable_reason, pay_item_id or quantity_delta_reason, and on
 * reported_quantity reverts to the computed area (clearing quantity_delta_reason too). The merged flag is checked as
 * a new one is (422); a new shape needs its dimensions; 400 when nothing is sent, and as createFlagOnPage otherwise.
 */
export async function updateFlag(flagId, data) {
  const json = await apiFetch(`/v1/flags/${flagId}`, { method: 'PATCH', body: data })
  return json.data
}

/** Deletes a flag (a soft delete). Returns nothing; deleting one already deleted changes nothing. */
export async function deleteFlag(flagId) {
  await apiFetch(`/v1/flags/${flagId}`, { method: 'DELETE' })
}
