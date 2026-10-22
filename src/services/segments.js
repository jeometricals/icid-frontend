import { apiFetch } from './apiClient'

// A PIR page's segments: curb runs. A segment is {segment_id, pir_page_id, pir_id, property_id, project_id,
// segment_type, points ([{x, y}, ...], two or more, in the page's native pixels), length_ft (the backend's, from the
// page's scale; null while it has none), reported_length_ft and length_delta_reason (a reported length overriding it
// for billing, Slice X.2; null for none), effective_length_ft (the reported length, else the drawn one), is_overridden,
// pay_item_id, note, created_at, updated_at, created_by, deleted_at, deleted_by}. Reading is for anyone on the project;
// changing one for its members, not a demo user.

/**
 * Lists a PIR's live segments on its live pages, by page and then in the order they were drawn. The backend
 * answers 403 for a user who isn't on the project and 404 for an unknown PIR.
 */
export async function listPirSegments(pirId) {
  const json = await apiFetch(`/v1/pirs/${pirId}/segments`)
  return json.data
}

/**
 * Changes some of a segment and returns it as it now is, its length worked out again. A field left out keeps its
 * value; a null clears pay_item_id, note or length_delta_reason, and on reported_length_ft reverts to the drawn length
 * (clearing length_delta_reason too). reported_length_ft is 0 or more (422 below). The backend answers 400 when
 * nothing is sent, 403 for a demo user or a user who isn't on the project, and 404 for an unknown segment.
 */
export async function updateSegment(segmentId, data) {
  const json = await apiFetch(`/v1/segments/${segmentId}`, { method: 'PATCH', body: data })
  return json.data
}
