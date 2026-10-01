import { apiFetch } from './apiClient'

/**
 * Lists a project's contract items (its Schedule of Bid Items), each with its spec item's details inline:
 * {contract_item_id, project_id, spec_item_id, budget_code, bid_quantity, bid_unit_price, item_no, description,
 * spec_section, pay_unit, created_at, updated_at}. projectId is the project's text id (e.g. 'HWS0023').
 * Returns [] for a project with no contract items.
 */
export async function getContractItems(projectId) {
  const json = await apiFetch(`/v1/contract_items/?project_id=${encodeURIComponent(projectId)}`)
  return json.data
}
