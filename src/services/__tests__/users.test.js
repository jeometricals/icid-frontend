import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listAdminUsers, listUsers, patchAdminUser } from '../users'
import { mockFetch, mockFetchFailure, fetchUrl, fetchInit } from '../../test/mockFetch'
import { TEST_USER_ID } from '../../test/users'

beforeEach(() => {
  vi.restoreAllMocks()
})

const USERS = [
  { user_id: TEST_USER_ID, email: 'KhanG@magnoleng.pc', first_name: 'Genghis', last_name: 'Khan' },
  { user_id: '5246b39d-87fe-4e21-92a3-2804c899e8b3', email: 'Nadir.shah@goorkaneng.com', first_name: 'Nadir', last_name: 'Shah' },
]

describe('listUsers', () => {
  it('GETs /v1/users/', async () => {
    mockFetch(200, { status: 'success', data: USERS })
    await listUsers()
    expect(fetchUrl().pathname).toBe('/v1/users/')
    expect(fetchInit()).toEqual({ method: 'GET' })
  })

  it('returns the data array', async () => {
    mockFetch(200, { status: 'success', data: USERS })
    expect(await listUsers()).toEqual(USERS)
  })

  it('throws the backend message on error', async () => {
    mockFetch(500, { detail: 'Failed to list users' })
    await expect(listUsers()).rejects.toMatchObject({ message: 'Failed to list users', status: 500 })
  })

  it('throws when fetch itself fails', async () => {
    mockFetchFailure('Network error')
    await expect(listUsers()).rejects.toThrow('Network error')
  })
})

const ADMIN_USERS = [
  { uuid: TEST_USER_ID, email: 'KhanG@magnoleng.pc', first_name: 'Genghis', last_name: 'Khan', role: null,
    is_demo: false, has_signature: false, signature_set_at: null },
]

describe('listAdminUsers', () => {
  it('GETs /v1/admin/users and returns the data array', async () => {
    mockFetch(200, { data: ADMIN_USERS })
    expect(await listAdminUsers()).toEqual(ADMIN_USERS)
    expect(fetchUrl().pathname).toBe('/v1/admin/users')
    expect(fetchInit().method).toBe('GET')
  })

  it('throws the backend message for someone who is not an admin', async () => {
    mockFetch(403, { detail: 'Admin access required' })
    await expect(listAdminUsers()).rejects.toMatchObject({ message: 'Admin access required', status: 403 })
  })
})

describe('patchAdminUser', () => {
  it('PATCHes the user with both names and returns the user', async () => {
    const renamed = { ...ADMIN_USERS[0], first_name: 'Temujin', last_name: 'Borjigin' }
    mockFetch(200, { data: renamed })
    expect(await patchAdminUser(TEST_USER_ID, { first_name: 'Temujin', last_name: 'Borjigin' })).toEqual(renamed)
    expect(fetchUrl().pathname).toBe(`/v1/admin/users/${TEST_USER_ID}`)
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ first_name: 'Temujin', last_name: 'Borjigin' })
  })

  it.each([
    [{ first_name: 'Temujin' }, { first_name: 'Temujin' }],
    [{ last_name: 'Borjigin' }, { last_name: 'Borjigin' }],
    [{ first_name: undefined, last_name: 'Borjigin' }, { last_name: 'Borjigin' }],
  ])('sends only the names it was given: %j', async (names, body) => {
    mockFetch(200, { data: ADMIN_USERS[0] })
    await patchAdminUser(TEST_USER_ID, names)
    expect(JSON.parse(fetchInit().body)).toEqual(body)
  })

  it('throws the backend message on a refusal', async () => {
    mockFetch(400, { detail: 'last_name cannot be blank' })
    await expect(patchAdminUser(TEST_USER_ID, { last_name: ' ' }))
      .rejects.toMatchObject({ message: 'last_name cannot be blank', status: 400 })
  })
})
