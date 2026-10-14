import { apiFetch } from './apiClient'

// A project's task orders, each a bundle of its properties. A task order is {id, project_id, task_order_number,
// issued_date ('YYYY-MM-DD' or null), estimate_notes, created_at, updated_at, created_by, deleted_at, deleted_by};
// in a list it also has property_count, and on its own its properties (the bundled ones that aren't deleted, by
// address, each as listProperties gives it). Reading is for a user on the project, or an admin; every change is
// admin only (anyone else gets a 403).

/**
 * Lists a project's task orders, by number, each with property_count. Soft-deleted ones are left out unless
 * includeDeleted is true, which the backend only honours for an admin. The backend answers 403 for a user who
 * isn't on the project and 404 for an unknown project.
 */
export async function listTaskOrders(projectId, { includeDeleted = false } = {}) {
  const query = includeDeleted ? '?include_deleted=true' : ''
  const json = await apiFetch(`/v1/projects/${projectId}/task-orders${query}`)
  return json.data
}

/** Fetches one task order, soft-deleted or not, with its properties. The backend answers 404 for an unknown one. */
export async function getTaskOrder(id) {
  const json = await apiFetch(`/v1/task-orders/${id}`)
  return json.data
}

/**
 * Admin only: adds a task order, with no properties, to a project and returns it. Takes {task_order_number,
 * issued_date, estimate_notes}; the last two may be null. The backend trims the text and answers 400 for a blank
 * or over-long value, 422 for a malformed date and 409 when a live task order of the project has the number (the
 * thrown error's body then carries existing_task_order_id).
 */
export async function createTaskOrder(projectId, data) {
  const json = await apiFetch(`/v1/projects/${projectId}/task-orders`, { method: 'POST', body: data })
  return json.data
}

/**
 * Admin only: changes some of a task order and returns it, with its properties, as it now is. A field left out
 * keeps its value; a null issued_date or estimate_notes clears it. The backend answers 400 when nothing is sent,
 * and 400 / 422 / 409 as createTaskOrder does.
 */
export async function updateTaskOrder(id, data) {
  const json = await apiFetch(`/v1/task-orders/${id}`, { method: 'PATCH', body: data })
  return json.data
}

/**
 * Admin only: soft-deletes a task order and returns it. It leaves the project's list and frees its number; its
 * bundle is kept. Deleting one already deleted succeeds and changes nothing.
 */
export async function softDeleteTaskOrder(id) {
  const json = await apiFetch(`/v1/task-orders/${id}/admin/soft-delete`, { method: 'POST' })
  return json.data
}

/**
 * Admin only: brings a soft-deleted task order back, with its number and its bundle, and returns it. The backend
 * answers 404 for one that isn't deleted and 409 when another live task order of the project now has its number.
 */
export async function undeleteTaskOrder(id) {
  const json = await apiFetch(`/v1/task-orders/${id}/admin/undelete`, { method: 'POST' })
  return json.data
}

/**
 * Admin only: puts a property into a task order and returns the task order with its properties. The backend
 * answers 400 for a deleted task order or property or one of another project, 404 for an unknown property and
 * 409 when the property is already in it.
 */
export async function bundleProperty(taskOrderId, propertyId) {
  const json = await apiFetch(`/v1/task-orders/${taskOrderId}/properties/${propertyId}`, { method: 'POST' })
  return json.data
}

/**
 * Admin only: takes a property out of a task order. Returns nothing. The backend answers 404 for a property that
 * isn't in it.
 */
export async function unbundleProperty(taskOrderId, propertyId) {
  await apiFetch(`/v1/task-orders/${taskOrderId}/properties/${propertyId}`, { method: 'DELETE' })
}
