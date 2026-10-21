import { apiFetch } from './apiClient'

// A property's work across IDRs (Slice V). The backend answers 403 for anyone not on the project and 404 for an
// unknown property.

/**
 * Lists every import of a property into a report (V2), newest work date first: {id, idr_id, report_id, report_type,
 * work_type, work_type_other, added_at, idr_number (null before acceptance), report_date ('YYYY-MM-DD'), status,
 * deleted_at, return_reason, reporter_uuid, reporter_name}. Deleted and returned IDRs are included.
 */
export async function getPropertyWorkHistory(propertyId) {
  const json = await apiFetch(`/v1/properties/${propertyId}/work-history`)
  return json.data
}

/**
 * Lists the pay items IDRs report on a property (V5), read-only: [{contract_item_id, pay_item_ref, budget_code,
 * description, unit, total, idrs: [{idr_id, idr_number, report_date, status, inspector, quantity}]}], each IDR newest
 * first; from approved and open IDRs' flags and curb segments and the pay items entered on the site.
 */
export async function getPropertyPayItemSummary(propertyId) {
  const json = await apiFetch(`/v1/properties/${propertyId}/pay-item-summary`)
  return json.data
}
