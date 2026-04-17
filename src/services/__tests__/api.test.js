import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProjectsForUser, getProjectById } from '../api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(status, body) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

function mockFetchFailure(message) {
  global.fetch = vi.fn().mockRejectedValue(new Error(message))
}

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
  it('calls the correct endpoint with user_id', async () => {
    mockFetch(200, { status: 'success', data: MOCK_PROJECTS })
    await getProjectsForUser(28)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/projects/?user_id=28')
    )
  })

  it('returns the data array on success', async () => {
    mockFetch(200, { status: 'success', data: MOCK_PROJECTS })
    const result = await getProjectsForUser(28)
    expect(result).toEqual(MOCK_PROJECTS)
  })

  it('returns an empty array when the user has no projects', async () => {
    mockFetch(200, { status: 'success', data: [] })
    const result = await getProjectsForUser(28)
    expect(result).toEqual([])
  })

  it('throws when the API returns a non-ok status', async () => {
    mockFetch(500, { detail: 'Internal Server Error' })
    await expect(getProjectsForUser(28)).rejects.toThrow('Internal Server Error')
  })

  it('throws when fetch itself fails (network error)', async () => {
    mockFetchFailure('Network error')
    await expect(getProjectsForUser(28)).rejects.toThrow('Network error')
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
      expect.stringContaining('/v1/projects/P001')
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
