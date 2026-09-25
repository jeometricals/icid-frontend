import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createIdr, listIdrs, getIdr, saveIdrHeader, submitIdr } from '../idrs'
import { mockFetch, mockFetchFailure, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const IDR_ID = '5a0e8c1d-0000-4000-8000-00000000000a'
const REPORT_ID = '9b1c2f3e-0000-4000-8000-000000000001'
const REPORTER_UUID = '327d3ed2-a3d6-4235-9408-7fe721b12bed'

const MOCK_IDR = {
  idr_id: IDR_ID,
  project_id: 'HWS0023',
  reporter_uuid: REPORTER_UUID,
  report_date: '2026-09-25',
  work_start_time: null,
  work_end_time: null,
  inspector_start_time: null,
  inspector_end_time: null,
  temp_low: null,
  temp_high: null,
  weather_am: null,
  weather_pm: null,
  total_pages: null,
  status: 'draft',
  submitted_at: null,
  created_at: '2026-09-25T13:00:00Z',
  updated_at: '2026-09-25T13:00:00Z',
}

const MOCK_REPORT = {
  report_id: REPORT_ID,
  idr_id: IDR_ID,
  report_type: 'GEN',
  is_addendum: false,
  parent_report_id: null,
  page_number: null,
  report_data: {},
  created_at: '2026-09-25T13:01:00Z',
  updated_at: '2026-09-25T13:01:00Z',
}


describe('error body', () => {
  it('attaches the parsed error body so callers can read extra fields like existing_idr_id', async () => {
    mockFetch(409, { detail: 'IDR already exists for this date', existing_idr_id: IDR_ID })
    const err = await getIdr(IDR_ID).catch(e => e)
    expect(err.body).toEqual({ detail: 'IDR already exists for this date', existing_idr_id: IDR_ID })
  })
})

describe('createIdr', () => {
  it('POSTs to /v1/idrs/ with a snake_case body and JSON header', async () => {
    mockFetch(201, { status: 'success', data: MOCK_IDR })
    await createIdr({ projectId: 'HWS0023', reporterUuid: REPORTER_UUID, reportDate: '2026-09-25' })
    expect(fetchUrl().pathname).toBe('/v1/idrs/')
    const init = fetchInit()
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({
      project_id: 'HWS0023',
      reporter_uuid: REPORTER_UUID,
      report_date: '2026-09-25',
    })
  })

  it('returns the created IDR', async () => {
    mockFetch(201, { status: 'success', data: MOCK_IDR })
    const result = await createIdr({ projectId: 'HWS0023', reporterUuid: REPORTER_UUID, reportDate: '2026-09-25' })
    expect(result).toEqual(MOCK_IDR)
  })

  it('exposes existing_idr_id on a 409 (IDR already exists for that day)', async () => {
    mockFetch(409, { detail: 'An IDR already exists for this date', existing_idr_id: IDR_ID })
    const err = await createIdr({ projectId: 'HWS0023', reporterUuid: REPORTER_UUID, reportDate: '2026-09-25' })
      .catch(e => e)
    expect(err).toMatchObject({ message: 'An IDR already exists for this date', status: 409 })
    expect(err.body.existing_idr_id).toBe(IDR_ID)
  })

  it('throws the backend message on 403 (reporter not on project)', async () => {
    mockFetch(403, { detail: 'Reporter is not assigned to this project' })
    await expect(createIdr({ projectId: 'HWS0023', reporterUuid: REPORTER_UUID, reportDate: '2026-09-25' }))
      .rejects.toMatchObject({ message: 'Reporter is not assigned to this project', status: 403 })
  })

  it('throws when fetch itself fails', async () => {
    mockFetchFailure('Network error')
    await expect(createIdr({ projectId: 'HWS0023', reporterUuid: REPORTER_UUID, reportDate: '2026-09-25' }))
      .rejects.toThrow('Network error')
  })
})

describe('listIdrs', () => {
  const ROWS = [{ ...MOCK_IDR, report_count: 1, has_general: true }]

  it('GETs /v1/idrs/ with all filters as query params', async () => {
    mockFetch(200, { status: 'success', data: ROWS })
    await listIdrs({ projectId: 'HWS0023', reporterUuid: REPORTER_UUID, status: 'draft' })
    const url = fetchUrl()
    expect(url.pathname).toBe('/v1/idrs/')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      project_id: 'HWS0023',
      reporter_uuid: REPORTER_UUID,
      status: 'draft',
    })
    expect(fetchInit().method).toBe('GET')
  })

  it('leaves out filters that are not given (project-wide archive has no reporter_uuid)', async () => {
    mockFetch(200, { status: 'success', data: [] })
    await listIdrs({ projectId: 'HWS0023', status: 'submitted' })
    expect(Object.fromEntries(fetchUrl().searchParams)).toEqual({ project_id: 'HWS0023', status: 'submitted' })
  })

  it('returns the data array', async () => {
    mockFetch(200, { status: 'success', data: ROWS })
    expect(await listIdrs({ projectId: 'HWS0023' })).toEqual(ROWS)
  })

  it('throws the backend message on error', async () => {
    mockFetch(500, { detail: 'Failed to list IDRs' })
    await expect(listIdrs({ projectId: 'HWS0023' })).rejects.toThrow('Failed to list IDRs')
  })
})

describe('getIdr', () => {
  const WITH_REPORTS = { ...MOCK_IDR, reports: [MOCK_REPORT] }

  it('GETs /v1/idrs/{id}', async () => {
    mockFetch(200, { status: 'success', data: WITH_REPORTS })
    await getIdr(IDR_ID)
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}`)
    expect(fetchInit()).toEqual({ method: 'GET' })
  })

  it('returns the IDR with its reports', async () => {
    mockFetch(200, { status: 'success', data: WITH_REPORTS })
    expect(await getIdr(IDR_ID)).toEqual(WITH_REPORTS)
  })

  it('throws with status 404 when the IDR does not exist', async () => {
    mockFetch(404, { detail: 'IDR not found' })
    await expect(getIdr(IDR_ID)).rejects.toMatchObject({ message: 'IDR not found', status: 404 })
  })

  it('throws when fetch itself fails', async () => {
    mockFetchFailure('Network error')
    await expect(getIdr(IDR_ID)).rejects.toThrow('Network error')
  })
})

describe('saveIdrHeader', () => {
  it('PUTs exactly the given fields to /v1/idrs/{id}/header (partial update)', async () => {
    mockFetch(200, { status: 'success', data: MOCK_IDR })
    await saveIdrHeader(IDR_ID, { temp_low: 48, weather_am: null })
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/header`)
    const init = fetchInit()
    expect(init.method).toBe('PUT')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ temp_low: 48, weather_am: null })
  })

  it('returns the updated IDR', async () => {
    const updated = { ...MOCK_IDR, temp_low: 48 }
    mockFetch(200, { status: 'success', data: updated })
    expect(await saveIdrHeader(IDR_ID, { temp_low: 48 })).toEqual(updated)
  })

  it('throws the backend message on 409 (IDR already submitted)', async () => {
    mockFetch(409, { detail: 'Only draft IDRs can be edited' })
    await expect(saveIdrHeader(IDR_ID, { temp_low: 48 }))
      .rejects.toMatchObject({ message: 'Only draft IDRs can be edited', status: 409 })
  })

  it('throws the backend message on 400 (temp_low above temp_high)', async () => {
    mockFetch(400, { detail: 'temp_low cannot be greater than temp_high' })
    await expect(saveIdrHeader(IDR_ID, { temp_low: 70, temp_high: 50 }))
      .rejects.toThrow('temp_low cannot be greater than temp_high')
  })
})

describe('submitIdr', () => {
  const SUBMITTED = {
    ...MOCK_IDR,
    status: 'submitted',
    submitted_at: '2026-09-25T17:00:00Z',
    total_pages: 1,
    reports: [{ ...MOCK_REPORT, page_number: 1 }],
  }

  it('POSTs to /v1/idrs/{id}/submit with no body', async () => {
    mockFetch(200, { status: 'success', data: SUBMITTED })
    await submitIdr(IDR_ID)
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/submit`)
    expect(fetchInit()).toEqual({ method: 'POST' })
  })

  it('returns the submitted IDR with its reports', async () => {
    mockFetch(200, { status: 'success', data: SUBMITTED })
    expect(await submitIdr(IDR_ID)).toEqual(SUBMITTED)
  })

  it('throws the backend message on 400 (IDR has no reports)', async () => {
    mockFetch(400, { detail: 'IDR must contain at least one report before submission.' })
    await expect(submitIdr(IDR_ID))
      .rejects.toMatchObject({ message: 'IDR must contain at least one report before submission.', status: 400 })
  })

  it('throws the backend message on 409 (already submitted)', async () => {
    mockFetch(409, { detail: 'Only draft IDRs can be submitted' })
    await expect(submitIdr(IDR_ID)).rejects.toThrow('Only draft IDRs can be submitted')
  })
})
