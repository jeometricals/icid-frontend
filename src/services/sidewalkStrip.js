import { apiFetch } from './apiClient'

// A PIR page's sidewalk strip (Slice Y1.5): the sidewalk in front of the lot, a closed polygon of {x, y} points in the
// page's native pixels, the property line first. Read on the page's title block (getPageTitleBlock:
// sidewalk_strip_points, _source, _set_at, _set_by); drawn only here.

/**
 * Draws a page's sidewalk strip, or clears it with null. The backend marks every flag of the page wholly outside the
 * strip that is assessable and not claimed by an approved IDR non-assessable ("outside_property_line"), in the same
 * save. Returns {pir_page_id, points, source, set_at, set_by, frontage_ft, flipped: [{id, display_order}],
 * outside_claimed: [{id, display_order, claimed_by_idr_id}]}. For an OE or RE on the project, or an admin (403
 * otherwise); 400 for a strip that isn't a simple polygon or a page without a scale.
 */
export async function putSidewalkStrip(pirPageId, points) {
  const json = await apiFetch(`/v1/pir-pages/${pirPageId}/sidewalk-strip`, { method: 'PUT', body: { points } })
  return json
}
