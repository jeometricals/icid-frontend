import { apiFetch } from './apiClient'

/**
 * Reviewer edits of an IDR in review. Each call is for the reviewer who accepted the IDR at its current stage (or an
 * admin), writes the new value into the IDR, logs the old one, and returns the IDR as getIdr does: its header, its
 * reports and field_edits (every edit, oldest first). A 409 means the field changed since the page read it.
 */

/**
 * Edits one field. fieldPath is 'header.<column>' with no reportId, or a path into that report's data
 * ('description', 'workforce.foremen', 'additionalWorkforce[0].count', 'payItems[<item id>].budgetCode').
 * newValue is text, a number, true/false or null.
 */
export async function editIdrField(idrId, { reportId, fieldPath, newValue }) {
  const body = { field_path: fieldPath, new_value: newValue }
  if (reportId) body.report_id = reportId
  const json = await apiFetch(`/v1/idrs/${idrId}/field`, { method: 'PATCH', body })
  return json.data
}

/**
 * Revises one pay item's quantity. payItemId is the item's own id (payItems[i].id), never its position.
 */
export async function revisePayItem(idrId, payItemId, revisedQuantity) {
  const json = await apiFetch(`/v1/idrs/${idrId}/pay-items/${encodeURIComponent(payItemId)}/revise`, {
    method: 'POST',
    body: { revised_quantity: revisedQuantity },
  })
  return json.data
}

/**
 * Adds a pay item to one report (General, SWCB or AC) on the reviewer's behalf.
 */
export async function addPayItem(idrId, { reportId, itemNo, budgetCode, quantity, unit, description }) {
  const body = {
    report_id: reportId, item_no: itemNo, budget_code: budgetCode, quantity, unit, description,
  }
  const json = await apiFetch(`/v1/idrs/${idrId}/pay-items/add`, { method: 'POST', body })
  return json.data
}
