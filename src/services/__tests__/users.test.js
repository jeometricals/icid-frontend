import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  changeOwnPassword, createAdminUser, listAdminUsers, listUsers, patchAdminUser, resetUserPassword,
} from '../users'
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

describe('createAdminUser', () => {
  const NEW_USER = { ...ADMIN_USERS[0], uuid: 'c0000000-0000-4000-8000-000000000003', email: 'test1@icid.local',
    first_name: 'Test', last_name: null }

  it('POSTs the whole user to /v1/admin/users and returns the user', async () => {
    mockFetch(201, { data: NEW_USER })
    const created = await createAdminUser(
      { email: 'test1@icid.local', first_name: 'Test', last_name: 'One', password: 'test1234', is_admin: true })
    expect(created).toEqual(NEW_USER)
    expect(fetchUrl().pathname).toBe('/v1/admin/users')
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual(
      { email: 'test1@icid.local', first_name: 'Test', last_name: 'One', password: 'test1234', is_admin: true })
  })

  it('sends an empty last name and no admin role when neither is given', async () => {
    mockFetch(201, { data: NEW_USER })
    await createAdminUser({ email: 'test1@icid.local', first_name: 'Test', password: 'test1234' })
    expect(JSON.parse(fetchInit().body)).toEqual(
      { email: 'test1@icid.local', first_name: 'Test', last_name: '', password: 'test1234', is_admin: false })
  })

  it('throws the backend message for a taken email, with the user who has it', async () => {
    mockFetch(409, { detail: 'A user with this email already exists', existing_user_uuid: TEST_USER_ID })
    await expect(createAdminUser({ email: 'KHANG@magnoleng.pc', first_name: 'G', password: 'test1234' }))
      .rejects.toMatchObject({ message: 'A user with this email already exists', status: 409,
        body: { existing_user_uuid: TEST_USER_ID } })
  })

  it('throws the backend message on a refusal', async () => {
    mockFetch(400, { detail: 'password must be at least 6 characters' })
    await expect(createAdminUser({ email: 'a@icid.local', first_name: 'A', password: '123' }))
      .rejects.toMatchObject({ message: 'password must be at least 6 characters', status: 400 })
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

describe('changeOwnPassword', () => {
  it('POSTs both passwords to /v1/users/me/password and returns the (empty) data', async () => {
    mockFetch(200, { status: 'success', message: 'Password changed', data: null })
    expect(await changeOwnPassword({ current_password: 'old-pass', new_password: 'new-pass' })).toBeNull()
    expect(fetchUrl().pathname).toBe('/v1/users/me/password')
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({ current_password: 'old-pass', new_password: 'new-pass' })
  })

  it('throws the backend message for a wrong current password', async () => {
    mockFetch(400, { detail: 'Current password is incorrect' })
    await expect(changeOwnPassword({ current_password: 'wrong', new_password: 'new-pass' }))
      .rejects.toMatchObject({ message: 'Current password is incorrect', status: 400 })
  })
})

describe('resetUserPassword', () => {
  it('POSTs the new password to /v1/admin/users/{id}/password and returns the user', async () => {
    mockFetch(200, { data: ADMIN_USERS[0] })
    expect(await resetUserPassword(TEST_USER_ID, { new_password: 'test1234' })).toEqual(ADMIN_USERS[0])
    expect(fetchUrl().pathname).toBe(`/v1/admin/users/${TEST_USER_ID}/password`)
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({ new_password: 'test1234' })
  })

  it('throws the backend message on a refusal', async () => {
    mockFetch(400, { detail: 'new_password must be at least 6 characters' })
    await expect(resetUserPassword(TEST_USER_ID, { new_password: '123' }))
      .rejects.toMatchObject({ message: 'new_password must be at least 6 characters', status: 400 })
  })
})
