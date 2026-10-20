import { apiFetch } from './apiClient'

// An IDR's curb segments (curb billing), as its flags (services/idrFlags.js): the PIR curb segments it covers and the
// length they come to per pay item. An IDR covers by default the live segments on the sites its reports imported,
// changed by per-IDR overrides. Each call answers with the same shape, {idr_id, status, task_order_id, frozen, counts:
// {attributed, excluded, claimed_elsewhere, total}, segments: [...], pay_items: [...], unmapped}:
// - a segment is {segment_id, pir_id, pir_page_id, page_number, segment_type, length_ft (null while its page has no
//   scale), note, property_id, property_kind, boro, block, lot, address, ..., display_address, pay_item_id,
//   pay_item_ref, budget_code, pay_item_description, unit, amount (its length for a pay item in LF; else null), state,
//   override, on_imported_site, claimed_by_idr_id, claimed_by_idr_number, constructed_on, deleted_at};
// - a pay item is {pay_item_id, pay_item_ref, budget_code, description, unit, amount, segment_count} (the id and count
//   are null once the IDR is approved);
// - unmapped counts the attributed (or claimed) segments that add nothing: no pay item in LF, or no length.
// Who may change them, and the refusals, are the flags'.

/** Reads an IDR's curb segments, for anyone who can read the IDR. The backend answers 404 for an unknown IDR. */
export async function getIdrSegments(idrId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/attributed-segments`)
  return json.data
}

/** Leaves a curb segment out of an IDR and returns its segments as they now stand. Refusals as excludeIdrFlag's. */
export async function excludeIdrSegment(idrId, segmentId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/attributed-segments/${segmentId}/exclude`, { method: 'POST' })
  return json.data
}

/** Puts a curb segment back into an IDR (or brings one in) and returns its segments. Refusals as includeIdrFlag's. */
export async function includeIdrSegment(idrId, segmentId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/attributed-segments/${segmentId}/include`, { method: 'POST' })
  return json.data
}
