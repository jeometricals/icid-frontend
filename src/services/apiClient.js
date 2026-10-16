import { clearToken, getToken, UNAUTHORIZED_EVENT } from './session'

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
 * Sends a request to the ICID backend and returns the Response once it is a success, for apiFetch and apiFetchFile.
 * Takes the path and {method, body, redirectOn401}, as apiFetch describes them. On a 401 (with redirectOn401) the
 * session ends and the promise never settles; any other non-2xx throws with error.status and error.body.
 */
async function send(path, { method = 'GET', body, redirectOn401 = true }) {
  const init = { method }
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body instanceof FormData) {
    // A file upload: the browser writes the multipart Content-Type itself, boundary included
    init.body = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  if (Object.keys(headers).length > 0) init.headers = headers
  const res = await fetch(`${BASE_URL}${path}`, init)
  if (res.status === 401 && redirectOn401) {
    clearToken()
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    return new Promise(() => {})
  }
  if (!res.ok) {
    const errorBody = parseJson(await res.text()) ?? {}
    const error = new Error(errorMessage(errorBody, res.status))
    error.status = res.status
    error.body = errorBody
    throw error
  }
  return res
}

// The file name in a Content-Disposition header (attachment; filename="x.pdf"), or null without one
function dispositionFilename(header) {
  const match = /filename="?([^";]+)"?/i.exec(header ?? '')
  return match ? match[1] : null
}

/**
 * Calls the ICID backend for a file (a GET) and returns it as {blob, filename}: the file name from the response's
 * Content-Disposition, else the fallback given. Errors and a 401 go as for apiFetch: a failure throws with
 * error.status and error.body (the JSON error body), and a 401 ends the session.
 */
export async function apiFetchFile(path, fallbackFilename) {
  const res = await send(path, {})
  const blob = await res.blob()
  return { blob, filename: dispositionFilename(res.headers?.get('Content-Disposition')) ?? fallbackFilename }
}

/**
 * Calls the ICID backend and returns the parsed JSON response.
 * Takes a path plus optional {method, body, redirectOn401}; a body is sent as JSON (a FormData body as it is, for
 * a file upload), and the stored session token, when there is one, as a Bearer Authorization header. Returns null
 * for 204 No Content.
 * Throws on non-2xx responses, with the HTTP code on `error.status` and the parsed error body on `error.body`
 * (network failures throw without either). A 2xx response that isn't JSON throws with the status and a
 * preview of the body instead of a bare SyntaxError.
 * A 401 means the session is over: the token is cleared and UNAUTHORIZED_EVENT fires (AuthContext then sends the
 * user to /login), and the returned promise never settles, so the caller shows no error on the way out. Pass
 * redirectOn401: false to get the 401 thrown like any other error (the sign-in calls do).
 */
export async function apiFetch(path, { method = 'GET', body, redirectOn401 = true } = {}) {
  const res = await send(path, { method, body, redirectOn401 })
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
