import { apiFetch } from './apiClient'

// A PIR's match lines (R1h.1a): a lettered line on a page, two endpoints in the page's native pixels, pairing with the
// page that carries the same label. A line is {match_line_id, pir_page_id, page_number, pir_id, property_id,
// project_id, label, x1, y1, x2, y2, created_at, updated_at, created_by, deleted_at, deleted_by}. Reading is for anyone
// on the project.

/** Lists a PIR's live match lines on its live pages (Slice Y4b draws them in the workspace). */
export async function listPirMatchLines(pirId) {
  const json = await apiFetch(`/v1/pirs/${pirId}/match-lines`)
  return json.data
}
