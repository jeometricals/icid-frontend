import { apiFetch } from './apiClient'

// These calls answer 401 for their own reasons (wrong password, stale token), so the caller handles it:
// apiFetch must not treat it as "the session ended" and redirect.
const OWN_401 = { redirectOn401: false }

/**
 * Signs in with an email and password.
 * Returns {access_token, token_type, expires_in, user}. Throws with error.status 401 for wrong credentials.
 */
export async function signIn(email, password) {
  return apiFetch('/v1/auth/login', { method: 'POST', body: { email, password }, ...OWN_401 })
}

/**
 * Starts a demo: the backend makes a throwaway demo user and signs them in.
 * Returns what signIn returns; the user has is_demo true. Throws with error.status 503 when demo mode is unavailable.
 */
export async function startDemo() {
  return apiFetch('/v1/auth/demo', { method: 'POST', ...OWN_401 })
}

/**
 * Fetches the user the stored token belongs to ({uuid, email, first_name, last_name, role, is_demo}).
 * Throws with error.status 401 when the token is expired or invalid.
 */
export async function fetchCurrentUser() {
  return apiFetch('/v1/auth/me', OWN_401)
}

/**
 * Tells the backend the user is signing out. For a demo user this deletes them and everything they made.
 * Returns null (204).
 */
export async function signOutOnServer() {
  return apiFetch('/v1/auth/logout', { method: 'POST', ...OWN_401 })
}
