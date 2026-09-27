import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProjectById } from '../api'
import * as api from '../api'
import * as projects from '../projects'
import * as idrs from '../idrs'
import * as idrReports from '../idrReports'
import * as users from '../users'
import { mockFetch, mockFetchFailure } from '../../test/mockFetch'

describe('barrel exports', () => {
  it('re-exports every project, IDR, IDR-report and user call so components import from api.js alone', () => {
    for (const [name, fn] of Object.entries({ ...projects, ...idrs, ...idrReports, ...users })) {
      expect(api[name]).toBe(fn)
    }
  })
})

beforeEach(() => {
  vi.restoreAllMocks()
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
