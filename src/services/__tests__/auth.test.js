import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchCurrentUser, signIn, signOutOnServer, startDemo } from '../auth'
import * as api from '../api'
import * as auth from '../auth'
import { UNAUTHORIZED_EVENT, getToken, setToken } from '../session'
import { mockFetch, mockFetchNoContent, fetchUrl, fetchInit } from '../../test/mockFetch'
import { DEMO_USER, TEST_USER, sessionFor } from '../../test/users'

let onUnauthorized

beforeEach(() => {
  localStorage.clear()
  onUnauthorized = vi.fn()
  window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
})

afterEach(() => {
  window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
})

describe('auth service', () => {
  it('is re-exported from api.js', () => {
    for (const [name, fn] of Object.entries(auth)) expect(api[name]).toBe(fn)
  })

  it('signIn POSTs the email and password to /v1/auth/login and returns the session', async () => {
    mockFetch(200, sessionFor(TEST_USER))
    const session = await signIn('KhanG@magnoleng.pc', 'secret-pw')
    expect(fetchUrl().pathname).toBe('/v1/auth/login')
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({ email: 'KhanG@magnoleng.pc', password: 'secret-pw' })
    expect(session).toEqual(sessionFor(TEST_USER))
  })

  it('signIn throws wrong credentials as a 401, without ending any session', async () => {
    mockFetch(401, { detail: 'Invalid email or password' })
    await expect(signIn('KhanG@magnoleng.pc', 'wrong')).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('startDemo POSTs to /v1/auth/demo with no body and returns the demo session', async () => {
    mockFetch(200, sessionFor(DEMO_USER))
    const session = await startDemo()
    expect(fetchUrl().pathname).toBe('/v1/auth/demo')
    expect(fetchInit()).toEqual({ method: 'POST' })
    expect(session.user.is_demo).toBe(true)
  })

  it('startDemo throws a 503 with the backend message when demo mode is unavailable', async () => {
    mockFetch(503, { detail: 'Demo mode is busy, try again later' })
    await expect(startDemo()).rejects.toMatchObject({ status: 503, message: 'Demo mode is busy, try again later' })
  })

  it('fetchCurrentUser GETs /v1/auth/me with the stored token', async () => {
    setToken('token-abc')
    mockFetch(200, TEST_USER)
    expect(await fetchCurrentUser()).toEqual(TEST_USER)
    expect(fetchUrl().pathname).toBe('/v1/auth/me')
    expect(fetchInit()).toEqual({ method: 'GET', headers: { Authorization: 'Bearer token-abc' } })
  })

  it('fetchCurrentUser throws a stale token as a 401 for the caller to handle', async () => {
    setToken('stale')
    mockFetch(401, { detail: 'Token expired' })
    await expect(fetchCurrentUser()).rejects.toMatchObject({ status: 401, message: 'Token expired' })
    expect(getToken()).toBe('stale') // AuthContext decides what to do with it
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('signOutOnServer POSTs to /v1/auth/logout with the token and returns null', async () => {
    setToken('token-abc')
    mockFetchNoContent()
    expect(await signOutOnServer()).toBeNull()
    expect(fetchUrl().pathname).toBe('/v1/auth/logout')
    expect(fetchInit()).toEqual({ method: 'POST', headers: { Authorization: 'Bearer token-abc' } })
  })
})
