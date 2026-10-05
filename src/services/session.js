// The signed-in session's bearer token. It lives in localStorage so the session survives a reload or a closed tab;
// AuthContext restores the user from it on startup, and apiFetch sends it with every request.
export const TOKEN_KEY = 'icid_token'

// Fired on window when the backend answers 401 to a signed-in request; AuthContext signs the user out on it
export const UNAUTHORIZED_EVENT = 'icid:unauthorized'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}
