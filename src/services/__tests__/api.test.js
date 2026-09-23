import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProjectsForUser, getProjectById, createReport, saveGeneralForm, getReport, listReports, submitReport } from '../api'

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
// Reports
// ---------------------------------------------------------------------------

const REPORT_ID = '9b1c2f3e-0000-4000-8000-000000000001'
const REPORTER_UUID = '327d3ed2-a3d6-4235-9408-7fe721b12bed'

const MOCK_REPORT = {
  report_id: REPORT_ID,
  reporter_uuid: REPORTER_UUID,
  project_id: 'HWS0023',
  report_date: '2026-09-23',
  status: 'draft',
  created_at: '2026-09-23T14:00:00Z',
  updated_at: '2026-09-23T14:00:00Z',
}

const MOCK_FORM = { date: '2026-09-23', sheetNo: '1', description: 'Poured curb', payItems: [] }

function fetchInit() {
  return fetch.mock.calls[0][1]
}

describe('createReport', () => {
  it('POSTs to /v1/reports/ with snake_case body and JSON header', async () => {
    mockFetch(201, { status: 'success', data: MOCK_REPORT })
    await createReport({ projectId: 'HWS0023', reporterUuid: REPORTER_UUID, reportDate: '2026-09-23' })
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/reports\/$/), expect.any(Object))
    const init = fetchInit()
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({
      project_id: 'HWS0023',
      reporter_uuid: REPORTER_UUID,
      report_date: '2026-09-23',
    })
  })

  it('omits report_date when not given so the backend defaults it', async () => {
    mockFetch(201, { status: 'success', data: MOCK_REPORT })
    await createReport({ projectId: 'HWS0023', reporterUuid: REPORTER_UUID })
    expect(JSON.parse(fetchInit().body)).toEqual({ project_id: 'HWS0023', reporter_uuid: REPORTER_UUID })
  })

  it('returns the created report row', async () => {
    mockFetch(201, { status: 'success', data: MOCK_REPORT })
    const result = await createReport({ projectId: 'HWS0023', reporterUuid: REPORTER_UUID })
    expect(result).toEqual(MOCK_REPORT)
  })

  it('throws the backend message on 403 (reporter not on project)', async () => {
    mockFetch(403, { detail: 'Reporter is not assigned to this project' })
    await expect(createReport({ projectId: 'HWS0023', reporterUuid: REPORTER_UUID }))
      .rejects.toThrow('Reporter is not assigned to this project')
  })

  it('throws the backend message on 404 (project not found)', async () => {
    mockFetch(404, { detail: 'Project not found' })
    await expect(createReport({ projectId: 'NOPE', reporterUuid: REPORTER_UUID }))
      .rejects.toThrow('Project not found')
  })

  it('throws when fetch itself fails', async () => {
    mockFetchFailure('Network error')
    await expect(createReport({ projectId: 'HWS0023', reporterUuid: REPORTER_UUID }))
      .rejects.toThrow('Network error')
  })
})

describe('saveGeneralForm', () => {
  const SAVED = { report_id: REPORT_ID, completed_form_id: 'cf-1', saved_at: '2026-09-23T14:05:00Z' }

  it('PUTs the form data unchanged as JSON to /v1/reports/{id}/general', async () => {
    mockFetch(200, { status: 'success', data: SAVED })
    await saveGeneralForm(REPORT_ID, MOCK_FORM)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/v1/reports/${REPORT_ID}/general`),
      expect.any(Object)
    )
    const init = fetchInit()
    expect(init.method).toBe('PUT')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual(MOCK_FORM)
  })

  it('returns the save confirmation', async () => {
    mockFetch(200, { status: 'success', data: SAVED })
    const result = await saveGeneralForm(REPORT_ID, MOCK_FORM)
    expect(result).toEqual(SAVED)
  })

  it('throws the backend message on 409 (report not a draft)', async () => {
    mockFetch(409, { detail: 'Only draft reports can be edited' })
    await expect(saveGeneralForm(REPORT_ID, MOCK_FORM)).rejects.toThrow('Only draft reports can be edited')
  })

  it('throws the backend message on 404 (report not found)', async () => {
    mockFetch(404, { detail: 'Report not found' })
    await expect(saveGeneralForm(REPORT_ID, MOCK_FORM)).rejects.toThrow('Report not found')
  })

  it('throws when fetch itself fails', async () => {
    mockFetchFailure('Network error')
    await expect(saveGeneralForm(REPORT_ID, MOCK_FORM)).rejects.toThrow('Network error')
  })
})

describe('getReport', () => {
  const WITH_FORM = { ...MOCK_REPORT, general_form: MOCK_FORM }

  it('GETs /v1/reports/{id}', async () => {
    mockFetch(200, { status: 'success', data: WITH_FORM })
    await getReport(REPORT_ID)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/v1/reports/${REPORT_ID}`),
      { method: 'GET' }
    )
  })

  it('returns the report with its general_form', async () => {
    mockFetch(200, { status: 'success', data: WITH_FORM })
    const result = await getReport(REPORT_ID)
    expect(result).toEqual(WITH_FORM)
  })

  it('throws the backend message on 404', async () => {
    mockFetch(404, { detail: 'Report not found' })
    await expect(getReport(REPORT_ID)).rejects.toThrow('Report not found')
  })

  it('throws when fetch itself fails', async () => {
    mockFetchFailure('Network error')
    await expect(getReport(REPORT_ID)).rejects.toThrow('Network error')
  })
})

describe('listReports', () => {
  const ROWS = [{ ...MOCK_REPORT, description_preview: 'Poured curb' }]

  it('GETs /v1/reports/ with all filters as query params', async () => {
    mockFetch(200, { status: 'success', data: ROWS })
    await listReports({ projectId: 'HWS0023', reporterUuid: REPORTER_UUID, status: 'draft' })
    const url = new URL(fetch.mock.calls[0][0])
    expect(url.pathname).toBe('/v1/reports/')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      project_id: 'HWS0023',
      reporter_uuid: REPORTER_UUID,
      status: 'draft',
    })
    expect(fetchInit().method).toBe('GET')
  })

  it('leaves out filters that are not given', async () => {
    mockFetch(200, { status: 'success', data: [] })
    await listReports({ projectId: 'HWS0023' })
    const url = new URL(fetch.mock.calls[0][0])
    expect(Object.fromEntries(url.searchParams)).toEqual({ project_id: 'HWS0023' })
  })

  it('returns the data array', async () => {
    mockFetch(200, { status: 'success', data: ROWS })
    const result = await listReports({ projectId: 'HWS0023' })
    expect(result).toEqual(ROWS)
  })

  it('throws the backend message on error', async () => {
    mockFetch(500, { detail: 'Failed to list reports' })
    await expect(listReports({ projectId: 'HWS0023' })).rejects.toThrow('Failed to list reports')
  })
})

describe('submitReport', () => {
  const SUBMITTED = { ...MOCK_REPORT, status: 'submitted', submitted_at: '2026-09-23T15:00:00Z' }

  it('POSTs to /v1/reports/{id}/submit with no body', async () => {
    mockFetch(200, { status: 'success', data: SUBMITTED })
    await submitReport(REPORT_ID)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/v1/reports/${REPORT_ID}/submit$`)),
      { method: 'POST' }
    )
  })

  it('returns the submitted report row', async () => {
    mockFetch(200, { status: 'success', data: SUBMITTED })
    expect(await submitReport(REPORT_ID)).toEqual(SUBMITTED)
  })

  it('throws the backend message on 409', async () => {
    mockFetch(409, { detail: 'Only draft reports can be submitted' })
    await expect(submitReport(REPORT_ID)).rejects.toThrow('Only draft reports can be submitted')
  })
})
