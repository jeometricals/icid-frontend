import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getProjectsForUser, getProjectById,
  createReport, saveGeneralForm, getReport, listReports, submitReport,
} from '../api'
import * as api from '../api'
import * as idrs from '../idrs'
import * as idrReports from '../idrReports'
import { mockFetch, mockFetchFailure } from '../../test/mockFetch'

describe('barrel exports', () => {
  it('re-exports every IDR and IDR-report call so components import from api.js alone', () => {
    for (const [name, fn] of Object.entries({ ...idrs, ...idrReports })) {
      expect(api[name]).toBe(fn)
    }
  })
})

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
      expect.stringContaining('/v1/projects/?user_id=28'),
      { method: 'GET' }
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
// Error message formatting
// ---------------------------------------------------------------------------

describe('error status', () => {
  it('attaches the HTTP status to thrown errors so callers can tell 404 from other failures', async () => {
    mockFetch(404, { detail: 'Project not found' })
    await expect(getProjectById('NOPE')).rejects.toMatchObject({ message: 'Project not found', status: 404 })
  })

  it('leaves status undefined for network failures', async () => {
    mockFetchFailure('Failed to fetch')
    const err = await getProjectById('HWS0023').catch(e => e)
    expect(err.status).toBeUndefined()
  })
})

describe('error messages', () => {
  it('joins FastAPI 422 validation messages instead of throwing [object Object]', async () => {
    mockFetch(422, {
      detail: [
        { loc: ['body', 'foo'], msg: 'Extra inputs are not permitted' },
        { loc: ['body', 'date'], msg: 'Input should be a valid string' },
      ],
    })
    await expect(getProjectById('P001')).rejects.toThrow(
      'Extra inputs are not permitted; Input should be a valid string'
    )
  })
})

// ---------------------------------------------------------------------------
// Removed report-level calls (stubs until R3 Pass 4)
// ---------------------------------------------------------------------------

describe('removed report-level calls', () => {
  it.each([
    ['createReport', createReport],
    ['saveGeneralForm', saveGeneralForm],
    ['getReport', getReport],
    ['listReports', listReports],
    ['submitReport', submitReport],
  ])('%s rejects without calling the backend', async (name, fn) => {
    global.fetch = vi.fn()
    await expect(fn()).rejects.toThrow(`${name} was removed in the IDR refactor (R3)`)
    expect(fetch).not.toHaveBeenCalled()
  })
})
