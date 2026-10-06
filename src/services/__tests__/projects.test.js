import { describe, it, expect, vi, beforeEach } from 'vitest'
import { changeProjectRole, getProjectRoles, getProjectsForUser, getProjectById } from '../projects'
import { mockFetch, mockFetchFailure, fetchUrl, fetchInit } from '../../test/mockFetch'

const MOCK_PROJECTS = [
  { project_id: 'P001', project_name: 'Bridge Rehab', borough: 'Brooklyn', status: 'active', user_role: 'inspector' },
  { project_id: 'P002', project_name: 'Queens Plaza', borough: 'Queens', status: 'active', user_role: 'supervisor' },
]

const MOCK_PROJECT_DETAIL = {
  project_id: 'P001',
  project_name: 'Bridge Rehab',
  project_description: 'Full rehabilitation of the deck.',
  registration_code: 'REG-2024-001',
  borough: 'Brooklyn',
  status: 'active',
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// getProjectsForUser
// ---------------------------------------------------------------------------

describe('getProjectsForUser', () => {
  it('asks for the signed-in user\'s projects, with no user id in the URL', async () => {
    mockFetch(200, { status: 'success', data: MOCK_PROJECTS })
    await getProjectsForUser()
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/projects\/$/), { method: 'GET' })
    expect(fetch.mock.calls[0][0]).not.toContain('user_id')
  })

  it('returns the data array on success', async () => {
    mockFetch(200, { status: 'success', data: MOCK_PROJECTS })
    const result = await getProjectsForUser()
    expect(result).toEqual(MOCK_PROJECTS)
  })

  it('returns an empty array when the user has no projects', async () => {
    mockFetch(200, { status: 'success', data: [] })
    const result = await getProjectsForUser()
    expect(result).toEqual([])
  })

  it('throws when the API returns a non-ok status', async () => {
    mockFetch(500, { detail: 'Internal Server Error' })
    await expect(getProjectsForUser()).rejects.toThrow('Internal Server Error')
  })

  it('throws when fetch itself fails (network error)', async () => {
    mockFetchFailure('Network error')
    await expect(getProjectsForUser()).rejects.toThrow('Network error')
  })
})

// ---------------------------------------------------------------------------
// getProjectById
// ---------------------------------------------------------------------------

describe('getProjectById', () => {
  it('calls the correct endpoint with the project ID', async () => {
    mockFetch(200, { status: 'success', data: MOCK_PROJECT_DETAIL })
    await getProjectById('P001')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/projects/P001'),
      { method: 'GET' }
    )
  })

  it('returns the project detail object on success', async () => {
    mockFetch(200, { status: 'success', data: MOCK_PROJECT_DETAIL })
    const result = await getProjectById('P001')
    expect(result).toEqual(MOCK_PROJECT_DETAIL)
  })

  it('throws with the API detail message on 404', async () => {
    mockFetch(404, { detail: 'Project not found' })
    await expect(getProjectById('DOESNOTEXIST')).rejects.toThrow('Project not found')
  })

  it('throws a generic message when the error body has no detail field', async () => {
    mockFetch(503, {})
    await expect(getProjectById('P001')).rejects.toThrow('API error 503')
  })

  it('throws when fetch itself fails', async () => {
    mockFetchFailure('Network error')
    await expect(getProjectById('P001')).rejects.toThrow('Network error')
  })
})

// ---------------------------------------------------------------------------
// getProjectRoles, changeProjectRole
// ---------------------------------------------------------------------------

const OLIVE = 'f0000000-0000-4000-8000-000000000006'
const MEMBERS = [
  { user_uuid: OLIVE, email: 'olive@icid.local', first_name: 'Olive', last_name: 'Engineer', role: 'oe',
    assigned_at: '2026-10-06T14:00:00Z' },
]

describe('getProjectRoles', () => {
  it("asks for the project's roles and returns the members with the message", async () => {
    mockFetch(200, { status: 'success', message: 'Project roles', data: MEMBERS })
    const result = await getProjectRoles('HWS0023')
    expect(fetchUrl().pathname).toBe('/v1/projects/HWS0023/roles')
    expect(fetchInit().method).toBe('GET')
    expect(result).toEqual({ members: MEMBERS, message: 'Project roles' })
  })

  it('throws with the status for a user who is not an admin', async () => {
    mockFetch(403, { detail: 'Admin access required' })
    await expect(getProjectRoles('HWS0023')).rejects.toMatchObject({ message: 'Admin access required', status: 403 })
  })
})

describe('changeProjectRole', () => {
  it.each(['grant', 'revoke'])('POSTs the user, the role and the %s action', async (action) => {
    mockFetch(200, { status: 'success', message: 'Role granted', data: MEMBERS })
    const result = await changeProjectRole('HWS0023', { userUuid: OLIVE, role: 're', action })
    expect(fetchUrl().pathname).toBe('/v1/projects/HWS0023/roles')
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({ user_uuid: OLIVE, role: 're', action })
    expect(result).toEqual({ members: MEMBERS, message: 'Role granted' })
  })

  it('passes on what the backend says the change did', async () => {
    mockFetch(200, { status: 'success', message: 'Role already held', data: MEMBERS })
    expect((await changeProjectRole('HWS0023', { userUuid: OLIVE, role: 'oe', action: 'grant' })).message).toBe('Role already held')
  })

  it('throws with the backend message when the user is unknown', async () => {
    mockFetch(404, { detail: 'User not found' })
    await expect(changeProjectRole('HWS0023', { userUuid: OLIVE, role: 're', action: 'grant' })).rejects.toMatchObject({
      message: 'User not found', status: 404,
    })
  })

  it('throws without a status when the request never gets an answer', async () => {
    mockFetchFailure('Network error')
    const error = await changeProjectRole('HWS0023', { userUuid: OLIVE, role: 're', action: 'grant' }).catch(err => err)
    expect(error.message).toBe('Network error')
    expect(error.status).toBeUndefined()
  })
})
