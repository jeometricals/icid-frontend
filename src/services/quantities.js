import { apiFetch } from './apiClient'

/**
 * Fetches a project's quantities: the pay-item quantities of its approved IDRs, and what they come to against the
 * project's contract items by contract value. The quantities are those of an optional range of work dates (from
 * and to, YYYY-MM-DD, inclusive; either can be left out); cumulative: true asks for all of them, whatever the
 * dates. The budget is always every contract item of the project.
 * Returns {range, rows, totals_by_unit, row_count, truncated, pay_items, totals_by_budget_code, project_total,
 * unbudgeted_total}:
 * - pay_items: one per pay item with quantities, by budget code then ref: {pay_item_ref, description, unit,
 *   budget_code, actual_quantity, actual_value, budgeted_quantity, budgeted_value, unit_price, percent,
 *   unbudgeted}. The five from actual_value on are null for an unbudgeted item (no contract item has its ref and
 *   budget code); percent is also null for a contract item bid at nothing.
 * - totals_by_budget_code: one per budget code of the contract items, booked against or not: {budget_code,
 *   actual_value, budgeted_value, percent, has_unbudgeted}.
 * - project_total: {actual_value, budgeted_value, percent}; unbudgeted_total: {actual_value: null, row_count}.
 * - rows (newest work date first) and totals_by_unit are the quantities one by one; truncated is true when more
 *   matched than the 10,000 one response carries. The roll-ups above are never cut short.
 * Throws with error.status 403 for a user who isn't on the project and 404 for no project.
 */
export async function listQuantities({ projectId, from, to, cumulative }) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (cumulative) params.set('cumulative', 'true')
  const query = params.toString() ? `?${params}` : ''
  const json = await apiFetch(`/v1/projects/${encodeURIComponent(projectId)}/quantities${query}`)
  return json.data
}
