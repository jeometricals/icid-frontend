const BASE_URL = import.meta.env.VITE_API_URL || 'https://icid-backend.vercel.app'

/**
 * Turns a FastAPI error body into a readable message.
 * `detail` is a string for HTTPException errors and a list of {msg} objects for 422 validation errors.
 */
function errorMessage(body, status) {
  if (typeof body.detail === 'string') return body.detail
  if (Array.isArray(body.detail)) return body.detail.map(d => d.msg).join('; ')
  return `API error ${status}`
}

/**
 * Calls the ICID backend and returns the parsed JSON response.
 * Takes a path plus optional {method, body}; a body is sent as JSON. Returns null for 204 No Content.
 * Throws on non-2xx responses, with the HTTP code on `error.status` and the parsed error body on `error.body`
 * (network failures throw without either).
 */
export async function apiFetch(path, { method = 'GET', body } = {}) {
  const init = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE_URL}${path}`, init)
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    const error = new Error(errorMessage(errorBody, res.status))
    error.status = res.status
    error.body = errorBody
    throw error
  }
  if (res.status === 204) return null
  return res.json()
}
