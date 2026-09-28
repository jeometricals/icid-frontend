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

// Parses a response body as JSON; returns undefined when it isn't (e.g. an HTML error page from a proxy)
function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/**
 * Calls the ICID backend and returns the parsed JSON response.
 * Takes a path plus optional {method, body}; a body is sent as JSON. Returns null for 204 No Content.
 * Throws on non-2xx responses, with the HTTP code on `error.status` and the parsed error body on `error.body`
 * (network failures throw without either). A 2xx response that isn't JSON throws with the status and a
 * preview of the body instead of a bare SyntaxError.
 */
export async function apiFetch(path, { method = 'GET', body } = {}) {
  const init = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE_URL}${path}`, init)
  if (!res.ok) {
    const errorBody = parseJson(await res.text()) ?? {}
    const error = new Error(errorMessage(errorBody, res.status))
    error.status = res.status
    error.body = errorBody
    throw error
  }
  if (res.status === 204) return null
  const text = await res.text()
  const json = parseJson(text)
  if (json === undefined) {
    const error = new Error(`API error ${res.status}: expected JSON but got "${text.slice(0, 100)}"`)
    error.status = res.status
    throw error
  }
  return json
}
