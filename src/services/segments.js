import { apiFetch } from './apiClient'

// A PIR page's segments: curb runs. A segment is {segment_id, pir_page_id, pir_id, property_id, project_id,
// segment_type, points ([{x, y}, ...], two or more, in the page's native pixels), length_ft (the backend's, from the
// page's scale; null while it has none), pay_item_id, note, created_at, updated_at, created_by, deleted_at,
// deleted_by}. Reading is for anyone on the project.

/**
 * Lists a PIR's live segments on its live pages, by page and then in the order they were drawn. The backend
 * answers 403 for a user who isn't on the project and 404 for an unknown PIR.
 */
export async function listPirSegments(pirId) {
  const json = await apiFetch(`/v1/pirs/${pirId}/segments`)
  return json.data
}
