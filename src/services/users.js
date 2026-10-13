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
 * returns a signed-in user ({uuid, email, first_name, last_name, role, is_demo, has_signature, signature_set_at})
 * plus deleted_at and deleted_by (both null for a user who isn't deleted). Soft-deleted users are left out unless
 * include_deleted is true. Anyone else gets a 403.
 */
export async function listAdminUsers({ include_deleted = false } = {}) {
  const query = include_deleted ? '?include_deleted=true' : ''
  const json = await apiFetch(`/v1/admin/users${query}`)
  return json.data
}

/**
 * Admin only: soft-deletes a user and returns them. They can no longer sign in, and leave the lists; their IDRs,
 * roles and signature stay. The backend answers 400 for the admin's own account and 404 for an unknown user or
 * one already deleted.
 */
export async function softDeleteUser(userUuid) {
  const json = await apiFetch(`/v1/admin/users/${userUuid}/delete`, { method: 'POST' })
  return json.data
}

/**
 * Admin only: brings a soft-deleted user back, able to sign in again, and returns them. The backend answers 404
 * for a user who isn't deleted and 409 when another user now has their email (the thrown error's body then carries
 * existing_user_uuid).
 */
export async function undeleteUser(userUuid) {
  const json = await apiFetch(`/v1/admin/users/${userUuid}/undelete`, { method: 'POST' })
  return json.data
}

/**
 * Admin only: deletes a soft-deleted user for good. Returns nothing. It can't be undone. The backend answers 404
 * for a user who isn't soft-deleted first and 409 for one something still names (the thrown error's body then
 * carries references: {idrs, project_users, audit, field_edits, attachments}, the count of each).
 */
export async function permanentDeleteUser(userUuid) {
  await apiFetch(`/v1/admin/users/${userUuid}/permanent`, { method: 'DELETE' })
}

/**
 * Admin only: creates a user who signs in with the password given, and returns them. last_name is optional (blank
 * is none); is_admin makes them an admin. The backend answers 400 for a value that doesn't fit and 409 when the
 * email is taken, whatever its capitals (the thrown error's body then carries existing_user_uuid).
 */
export async function createAdminUser({ email, first_name, last_name, password, is_admin }) {
  const json = await apiFetch('/v1/admin/users', {
    method: 'POST',
    body: { email, first_name, last_name: last_name ?? '', password, is_admin: !!is_admin },
  })
  return json.data
}

/**
 * Admin only: changes any of a user's first name, last name, email, admin role (is_admin) and demo flag (is_demo:
 * false makes a demo user a real one), and returns the user as they now are. A field left out (undefined) keeps
 * its value. The backend trims the names and the email and answers 400 for a value that doesn't fit, when nothing
 * is sent, when an admin takes their own admin role away or when a real user is made a demo user; 404 for an
 * unknown user; and 409 when another user has the email, whatever its capitals (the thrown error's body then
 * carries existing_user_uuid).
 */
export async function patchAdminUser(userId, { first_name, last_name, email, is_admin, is_demo }) {
  const body = {}
  if (first_name !== undefined) body.first_name = first_name
  if (last_name !== undefined) body.last_name = last_name
  if (email !== undefined) body.email = email
  if (is_admin !== undefined) body.is_admin = is_admin
  if (is_demo !== undefined) body.is_demo = is_demo
  const json = await apiFetch(`/v1/admin/users/${userId}`, { method: 'PATCH', body })
  return json.data
}

/**
 * Changes the signed-in user's own password, both passwords as typed. Returns nothing (the backend's data is
 * null). The backend answers 400 for a wrong current password, a new one under 6 characters or over 72 bytes, or
 * one the same as the current. Tokens already issued stay valid, so the user stays signed in.
 */
export async function changeOwnPassword({ current_password, new_password }) {
  const json = await apiFetch('/v1/users/me/password', {
    method: 'POST',
    body: { current_password, new_password },
  })
  return json.data
}

/**
 * Admin only: gives a user a new password to sign in with, as typed, and returns the user. The backend answers
 * 400 for a password under 6 characters or over 72 bytes and 404 for an unknown user.
 */
export async function resetUserPassword(user_id, { new_password }) {
  const json = await apiFetch(`/v1/admin/users/${user_id}/password`, {
    method: 'POST',
    body: { new_password },
  })
  return json.data
}
