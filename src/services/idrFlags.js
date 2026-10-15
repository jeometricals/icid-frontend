import { apiFetch } from './apiClient'

// An IDR's flags (R1f): the PIR flags it covers and what they come to per pay item. An IDR covers by default the live
// flags on its task order's properties (its task_order_id; none without one), changed by per-IDR overrides. Each
// call answers with the same shape, {idr_id, status, task_order_id, frozen, counts: {attributed, excluded,
// claimed_elsewhere, total}, flags: [...], pay_items: [...], unmapped}:
// - a flag is {flag_id, pir_id, pir_page_id, page_number, display_order, shape, surveyed_thickness, property_id,
//   property_kind, boro, block, lot, address, intersection_street_1, intersection_street_2, quadrant, facing_street,
//   display_address, pay_item_id, pay_item_ref, budget_code, pay_item_description, unit, quantity_sf, amount (in the
//   unit; null without a pay item or in a unit a flag can't measure), state ('attributed' | 'excluded' | 'claimed' |
//   'claimed_elsewhere'), override ('exclude' | 'include' | null), in_task_order, claimed_by_idr_id,
//   claimed_by_idr_number, is_constructed, constructed_on, deleted_at};
// - a pay item is {pay_item_id, pay_item_ref, budget_code, description, unit, amount, flag_count} (the id and count
//   are null once the IDR is approved: the line is then the quantity row frozen at approval);
// - unmapped counts the attributed (or claimed) flags that add nothing: no pay item, or a unit a flag can't measure.
// Before approval it is live; once approved (frozen) it is what the approval claimed and wrote.

/** Reads an IDR's flags, for anyone who can read the IDR. The backend answers 404 for an unknown IDR. */
export async function getIdrFlags(idrId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/attributed-flags`)
  return json.data
}

/**
 * Leaves a flag out of an IDR and returns the IDR's flags as they now stand. For its inspector while it is a draft,
 * the reviewer who accepted it at its stage, or an admin; never a demo user (403). 409 for an approved, deleted or
 * submitted (not yet accepted) IDR, or a flag another IDR claimed; 404 for a flag not of its project.
 */
export async function excludeIdrFlag(idrId, flagId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/attributed-flags/${flagId}/exclude`, { method: 'POST' })
  return json.data
}

/**
 * Puts a flag back into an IDR (or brings one in from elsewhere in its project) and returns the IDR's flags. Who may,
 * and the refusals, as excludeIdrFlag; also 400 for a deleted flag.
 */
export async function includeIdrFlag(idrId, flagId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/attributed-flags/${flagId}/include`, { method: 'POST' })
  return json.data
}
