import { apiFetch } from './apiClient'

/**
 * Lists every ICID user ({user_id, email, first_name, last_name, ...}); user_id is the same uuid as an IDR's reporter_uuid.
 */
export async function listUsers() {
  const json = await apiFetch('/v1/users/')
  return json.data
}

/**
 * Admin only: lists every user, demo users included, by last name, first name and email, each as the backend
 * returns a signed-in user ({uuid, email, first_name, last_name, role, is_demo, has_signature, signature_set_at}).
 * Anyone else gets a 403.
 */
export async function listAdminUsers() {
  const json = await apiFetch('/v1/admin/users')
  return json.data
}

/**
 * Admin only: changes a user's first name, last name or both, and returns the user as they now are. A name left
 * out (undefined) keeps its value. The backend trims the names and answers 400 for a blank or over-long one, or
 * when neither is sent, and 404 for an unknown user.
 */
export async function patchAdminUser(userId, { first_name, last_name }) {
  const body = {}
  if (first_name !== undefined) body.first_name = first_name
  if (last_name !== undefined) body.last_name = last_name
  const json = await apiFetch(`/v1/admin/users/${userId}`, { method: 'PATCH', body })
  return json.data
}
