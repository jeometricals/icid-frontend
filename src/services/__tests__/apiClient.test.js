import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch } from '../apiClient'
import { TOKEN_KEY, UNAUTHORIZED_EVENT, clearToken, getToken, setToken } from '../session'
import { mockFetch, mockFetchFailure, fetchInit } from '../../test/mockFetch'

let onUnauthorized

beforeEach(() => {
  localStorage.clear()
  onUnauthorized = vi.fn()
  window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
})

afterEach(() => {
  window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
})

// Resolves to 'pending' when the promise hasn't settled after the microtask queue has drained
async function stateOf(promise) {
  return Promise.race([promise.then(() => 'resolved', () => 'rejected'), new Promise(r => setTimeout(() => r('pending'), 20))])
}

describe('session token helpers', () => {
  it('store the token in localStorage under icid_token', () => {
    expect(TOKEN_KEY).toBe('icid_token')
    expect(getToken()).toBeNull()
    setToken('abc')
    expect(localStorage.getItem('icid_token')).toBe('abc')
    expect(getToken()).toBe('abc')
    clearToken()
    expect(getToken()).toBeNull()
  })
})

describe('apiFetch — Authorization header', () => {
  it('sends the stored token as a Bearer header', async () => {
    setToken('token-abc')
    mockFetch(200, { ok: true })
    await apiFetch('/v1/projects/')
    expect(fetchInit()).toEqual({ method: 'GET', headers: { Authorization: 'Bearer token-abc' } })
  })

  it('sends it alongside the JSON content type on a request with a body', async () => {
    setToken('token-abc')
    mockFetch(201, { ok: true })
    await apiFetch('/v1/idrs/', { method: 'POST', body: { project_id: 'HWS0023' } })
    expect(fetchInit().headers).toEqual({ Authorization: 'Bearer token-abc', 'Content-Type': 'application/json' })
  })

  it('sends no Authorization header when nobody is signed in', async () => {
    mockFetch(200, { ok: true })
    await apiFetch('/v1/projects/')
    expect(fetchInit()).toEqual({ method: 'GET' })
  })

  it('reads the token fresh on every request', async () => {
    mockFetch(200, { ok: true })
    await apiFetch('/status')
    expect(fetchInit().headers).toBeUndefined()
    setToken('later-token')
    mockFetch(200, { ok: true })
    await apiFetch('/status')
    expect(fetchInit().headers).toEqual({ Authorization: 'Bearer later-token' })
  })
})

describe('apiFetch — 401', () => {
  it('clears the token, announces it, and never hands the error to the caller', async () => {
    setToken('expired-token')
    mockFetch(401, { detail: 'Token expired' })
    const request = apiFetch('/v1/projects/')
    expect(await stateOf(request)).toBe('pending')
    expect(getToken()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does the same when no token was stored', async () => {
    mockFetch(401, { detail: 'Not authenticated' })
    expect(await stateOf(apiFetch('/v1/idrs/'))).toBe('pending')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('throws the 401 instead when the caller opts out, leaving the token alone', async () => {
    setToken('token-abc')
    mockFetch(401, { detail: 'Invalid email or password' })
    await expect(apiFetch('/v1/auth/login', { method: 'POST', body: {}, redirectOn401: false }))
      .rejects.toMatchObject({ status: 401, message: 'Invalid email or password' })
    expect(getToken()).toBe('token-abc')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('apiFetch — other errors are unchanged', () => {
  it.each([400, 403, 404, 409, 500, 503])('throws a %i with its status and message, and keeps the session', async (status) => {
    setToken('token-abc')
    mockFetch(status, { detail: 'Nope' })
    await expect(apiFetch('/v1/idrs/x')).rejects.toMatchObject({ status, message: 'Nope' })
    expect(getToken()).toBe('token-abc')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('throws network failures without a status', async () => {
    setToken('token-abc')
    mockFetchFailure('Failed to fetch')
    const err = await apiFetch('/v1/projects/').catch(e => e)
    expect(err.status).toBeUndefined()
    expect(getToken()).toBe('token-abc')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
