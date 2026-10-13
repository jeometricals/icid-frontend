import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  changeOwnPassword, createAdminUser, listAdminUsers, listUsers, patchAdminUser, permanentDeleteUser, resetUserPassword,
  softDeleteUser, undeleteUser,
} from '../users'
import { mockFetch, mockFetchFailure, mockFetchNoContent, fetchUrl, fetchInit } from '../../test/mockFetch'
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

describe('patchAdminUser — email, admin role and demo flag', () => {
  it('sends the email, is_admin and is_demo when given', async () => {
    mockFetch(200, { data: ADMIN_USERS[0] })
    await patchAdminUser(TEST_USER_ID, { email: 'khan@magnoleng.pc', is_admin: true, is_demo: false })
    expect(JSON.parse(fetchInit().body)).toEqual({ email: 'khan@magnoleng.pc', is_admin: true, is_demo: false })
  })

  it('sends is_admin false, and leaves out what it was not given', async () => {
    mockFetch(200, { data: ADMIN_USERS[0] })
    await patchAdminUser(TEST_USER_ID, { is_admin: false, email: undefined })
    expect(JSON.parse(fetchInit().body)).toEqual({ is_admin: false })
  })

  it('throws the backend message for a taken email, with the user who has it', async () => {
    mockFetch(409, { detail: 'A user with this email already exists', existing_user_uuid: TEST_USER_ID })
    await expect(patchAdminUser(TEST_USER_ID, { email: 'reza@icid.local' })).rejects.toMatchObject({
      message: 'A user with this email already exists', status: 409, body: { existing_user_uuid: TEST_USER_ID },
    })
  })

  it('throws the backend message when an admin takes their own role away', async () => {
    mockFetch(400, { detail: 'You cannot revoke your own admin role.' })
    await expect(patchAdminUser(TEST_USER_ID, { is_admin: false }))
      .rejects.toMatchObject({ message: 'You cannot revoke your own admin role.', status: 400 })
  })
})

describe('listAdminUsers — include_deleted', () => {
  it('asks for deleted users too when told to', async () => {
    mockFetch(200, { data: ADMIN_USERS })
    await listAdminUsers({ include_deleted: true })
    expect(fetchUrl().pathname).toBe('/v1/admin/users')
    expect(fetchUrl().search).toBe('?include_deleted=true')
  })

  it.each([[undefined], [{}], [{ include_deleted: false }]])('leaves the query off for %j', async (options) => {
    mockFetch(200, { data: ADMIN_USERS })
    await listAdminUsers(options)
    expect(fetchUrl().search).toBe('')
  })
})

describe.each([
  ['softDeleteUser', softDeleteUser, 'delete'],
  ['undeleteUser', undeleteUser, 'undelete'],
])('%s', (_, call, segment) => {
  it(`POSTs to /${segment} with no body and returns the user`, async () => {
    const user = { ...ADMIN_USERS[0], deleted_at: null, deleted_by: null }
    mockFetch(200, { data: user })
    expect(await call(TEST_USER_ID)).toEqual(user)
    expect(fetchUrl().pathname).toBe(`/v1/admin/users/${TEST_USER_ID}/${segment}`)
    expect(fetchInit().method).toBe('POST')
    expect(fetchInit().body).toBeUndefined()
  })

  it('throws the backend message on a refusal', async () => {
    mockFetch(404, { detail: 'User not found' })
    await expect(call(TEST_USER_ID)).rejects.toMatchObject({ message: 'User not found', status: 404 })
  })
})

describe('undeleteUser — a taken email', () => {
  it('throws the backend message, with the user who has the email', async () => {
    mockFetch(409, { detail: 'Email is now in use by another user', existing_user_uuid: TEST_USER_ID })
    await expect(undeleteUser(TEST_USER_ID)).rejects.toMatchObject({
      message: 'Email is now in use by another user', status: 409, body: { existing_user_uuid: TEST_USER_ID },
    })
  })
})

describe('permanentDeleteUser', () => {
  it('DELETEs /permanent with no body and returns nothing', async () => {
    mockFetchNoContent()
    expect(await permanentDeleteUser(TEST_USER_ID)).toBeUndefined()
    expect(fetchUrl().pathname).toBe(`/v1/admin/users/${TEST_USER_ID}/permanent`)
    expect(fetchInit().method).toBe('DELETE')
    expect(fetchInit().body).toBeUndefined()
  })

  it('throws the backend message for a user with history, with what still names them', async () => {
    const references = { idrs: 3, project_users: 1, audit: 12, field_edits: 0, attachments: 0 }
    mockFetch(409, { detail: "User has history and can't be permanently deleted", references })
    await expect(permanentDeleteUser(TEST_USER_ID)).rejects.toMatchObject({
      message: "User has history and can't be permanently deleted", status: 409, body: { references },
    })
  })
})
