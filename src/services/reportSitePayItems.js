import { apiFetch } from './apiClient'

// The pay items entered by hand on an imported site (Slice V1): a contract item of the IDR's project and its quantity,
// billed when the IDR is approved. A pay item is {id, report_site_id, contract_item_id, quantity, note, added_at,
// added_by, pay_item_ref, budget_code, description, unit}. Changing them is for whoever may change the sites.

const payItemsUrl = (idrId, reportId, siteId) => `/v1/idrs/${idrId}/reports/${reportId}/sites/${siteId}/pay-items`

/** Lists the pay items entered on a report's site, oldest first. */
export async function listSitePayItems(idrId, reportId, siteId) {
  const json = await apiFetch(payItemsUrl(idrId, reportId, siteId))
  return json.data
}

/**
 * Enters a pay item on a site and returns it. Takes {contract_item_id, quantity, note}. The backend answers 400 for a
 * contract item that isn't the project's and 422 for a quantity not above 0.
 */
export async function addSitePayItem(idrId, reportId, siteId, data) {
  const json = await apiFetch(payItemsUrl(idrId, reportId, siteId), { method: 'POST', body: data })
  return json.data
}

/** Changes a site pay item's {quantity, note} (a null note clears it) and returns it. */
export async function updateSitePayItem(idrId, reportId, siteId, itemId, data) {
  const json = await apiFetch(`${payItemsUrl(idrId, reportId, siteId)}/${itemId}`, { method: 'PATCH', body: data })
  return json.data
}

/** Removes a pay item from a site. Resolves with nothing. */
export async function removeSitePayItem(idrId, reportId, siteId, itemId) {
  await apiFetch(`${payItemsUrl(idrId, reportId, siteId)}/${itemId}`, { method: 'DELETE' })
}

/**
 * An IDR's pay items by source, display only: {idr_id, report_id, frozen, pay_items: [{pay_item_ref, budget_code,
 * description, unit, total, flags, segments, sites, manual, site_lines: [{amount, report_id, site_id, property_id,
 * label}], manual_lines: [{amount, report_id}]}]}. With a reportId, hand-entered items are that report's only.
 */
export async function getPayItemSources(idrId, reportId) {
  const query = reportId ? `?report_id=${encodeURIComponent(reportId)}` : ''
  const json = await apiFetch(`/v1/idrs/${idrId}/pay-item-sources${query}`)
  return json.data
}
