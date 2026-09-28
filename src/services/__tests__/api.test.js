import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProjectById } from '../api'
import * as api from '../api'
import * as projects from '../projects'
import * as idrs from '../idrs'
import * as idrReports from '../idrReports'
import * as users from '../users'
import * as attachments from '../attachments'
import { mockFetch, mockFetchFailure, mockFetchText } from '../../test/mockFetch'

describe('barrel exports', () => {
  it('re-exports every project, IDR, IDR-report, user and attachment export so components import from api.js alone', () => {
    for (const [name, fn] of Object.entries({ ...projects, ...idrs, ...idrReports, ...users, ...attachments })) {
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

describe('non-JSON responses', () => {
  it('throws the status and a body preview instead of a SyntaxError when a 2xx body is not JSON', async () => {
    mockFetchText(200, '<!DOCTYPE html><html><body>Vercel</body></html>')
    const err = await getProjectById('HWS0023').catch(e => e)
    expect(err).not.toBeInstanceOf(SyntaxError)
    expect(err.status).toBe(200)
    expect(err.message).toBe('API error 200: expected JSON but got "<!DOCTYPE html><html><body>Vercel</body></html>"')
  })

  it('caps the preview at 100 characters', async () => {
    mockFetchText(200, 'x'.repeat(500))
    const err = await getProjectById('HWS0023').catch(e => e)
    expect(err.message).toBe(`API error 200: expected JSON but got "${'x'.repeat(100)}"`)
  })

  it('falls back to "API error <status>" with an empty body when an error response is not JSON', async () => {
    mockFetchText(502, '<html>Bad Gateway</html>')
    const err = await getProjectById('HWS0023').catch(e => e)
    expect(err).toMatchObject({ message: 'API error 502', status: 502, body: {} })
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
