import { apiFetch } from './apiClient'

/**
 * Fetches a project's quantities: the pay-item quantities of its approved IDRs, newest work date first, over an
 * optional range of work dates (from and to, YYYY-MM-DD, inclusive; either can be left out).
 * Returns {rows, totals_by_unit, row_count, truncated}. Each row has pay_item_ref, budget_code, description,
 * amount (a number) and unit, any of the first three and the unit possibly null; totals_by_unit sums the rows'
 * amounts per unit ('(unknown)' for rows without one); truncated is true when more rows matched than the 10,000
 * one response carries. Throws with error.status 403 for a user who isn't on the project and 404 for no project.
 */
export async function listQuantities({ projectId, from, to }) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString() ? `?${params}` : ''
  const json = await apiFetch(`/v1/projects/${encodeURIComponent(projectId)}/quantities${query}`)
  return json.data
}
