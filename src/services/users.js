import { apiFetch } from './apiClient'

/**
 * Lists every ICID user ({user_id, email, first_name, last_name, ...}); user_id is the same uuid as an IDR's reporter_uuid.
 */
export async function listUsers() {
  const json = await apiFetch('/v1/users/')
  return json.data
}
