import { apiFetch } from './apiClient'

// Progress from PIR flags (R1g): per pay item a flag can fill, how much is approved (claimed by an approved IDR), in
// flight (attributed to an open IDR) and unclaimed. A rollup is {scope: {project_id, task_order_id, property_id},
// pay_items, unmapped_flag_count, unmapped_by_property, overall}:
// - pay_items: by budget code then item number, only those a flag in scope is on (includeEmpty: every one a flag can
//   fill): {pay_item_id, item_no, budget_code, description, unit (SF, SY, CY, EA), unit_price, approved, in_flight,
//   unclaimed, live_total, approved_pct}; each state {quantity (unrounded), flag_count, value (to the cent)};
//   approved_pct is null when the live total is 0.
// - unmapped_by_property: [{property_id, display_address, flag_count}], the live flags that come to nothing in a pay item.
// - overall: {approved_value, live_total_value, approved_pct (by value; null when nothing is live)}.
// Reading is for a user on the project, or an admin.

/**
 * Fetches a project's progress rollup, narrowed to a live task order's sites (taskOrderId) and to one live site
 * (propertyId) when given. The backend answers 403 for a user who isn't on the project and 404 for an unknown project
 * or a filter that isn't a live one of it; a site outside the task order is an empty rollup.
 */
export async function getProjectProgress(projectId, { taskOrderId, propertyId, includeEmpty = false } = {}) {
  const params = new URLSearchParams()
  if (taskOrderId) params.set('task_order_id', taskOrderId)
  if (propertyId) params.set('property_id', propertyId)
  if (includeEmpty) params.set('include_empty', 'true')
  const query = params.toString() ? `?${params}` : ''
  const json = await apiFetch(`/v1/projects/${encodeURIComponent(projectId)}/progress-rollup${query}`)
  return json.data
}

/**
 * Fetches a task order's progress rollup: a project's, over its live bundled sites, plus properties (each site's own
 * rollup {property_id, display_address, pay_items, unmapped_flag_count, overall}, in the task order's order),
 * site_count and sites_started (sites with an approved flag). The backend answers 403 and 404 as for the task order.
 */
export async function getTaskOrderProgress(taskOrderId, { includeEmpty = false } = {}) {
  const query = includeEmpty ? '?include_empty=true' : ''
  const json = await apiFetch(`/v1/task-orders/${taskOrderId}/progress-rollup${query}`)
  return json.data
}
