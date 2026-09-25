import { describe, it, expect, beforeEach, vi } from 'vitest'
import { addReport, saveReport, deleteReport } from '../idrReports'
import { mockFetch, mockFetchNoContent, mockFetchFailure, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const IDR_ID = '5a0e8c1d-0000-4000-8000-00000000000a'
const REPORT_ID = '9b1c2f3e-0000-4000-8000-000000000001'

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

const MOCK_FORM = { description: 'Poured curb', payItems: [] }

describe('addReport', () => {
  it('POSTs only report_type to /v1/idrs/{id}/reports for a main report', async () => {
    mockFetch(201, { status: 'success', data: MOCK_REPORT })
    await addReport(IDR_ID, { reportType: 'GEN' })
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/reports`)
    const init = fetchInit()
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ report_type: 'GEN' })
  })

  it('sends is_addendum and parent_report_id when given', async () => {
    mockFetch(201, { status: 'success', data: MOCK_REPORT })
    await addReport(IDR_ID, { reportType: 'SKETCH', isAddendum: true, parentReportId: REPORT_ID })
    expect(JSON.parse(fetchInit().body)).toEqual({
      report_type: 'SKETCH',
      is_addendum: true,
      parent_report_id: REPORT_ID,
    })
  })

  it('returns the created report', async () => {
    mockFetch(201, { status: 'success', data: MOCK_REPORT })
    expect(await addReport(IDR_ID, { reportType: 'GEN' })).toEqual(MOCK_REPORT)
  })

  it('exposes existing_report_id on a 409 (IDR already has a General)', async () => {
    mockFetch(409, { detail: 'This IDR already has a General report', existing_report_id: REPORT_ID })
    const err = await addReport(IDR_ID, { reportType: 'GEN' }).catch(e => e)
    expect(err.status).toBe(409)
    expect(err.body.existing_report_id).toBe(REPORT_ID)
  })

  it('throws the backend message on 409 (IDR already submitted)', async () => {
    mockFetch(409, { detail: 'Only draft IDRs can be edited' })
    await expect(addReport(IDR_ID, { reportType: 'GEN' })).rejects.toThrow('Only draft IDRs can be edited')
  })
})

describe('saveReport', () => {
  it('PUTs the report data unchanged as JSON to /v1/idrs/{id}/reports/{report_id}', async () => {
    mockFetch(200, { status: 'success', data: { ...MOCK_REPORT, report_data: MOCK_FORM } })
    await saveReport(IDR_ID, REPORT_ID, MOCK_FORM)
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/reports/${REPORT_ID}`)
    const init = fetchInit()
    expect(init.method).toBe('PUT')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual(MOCK_FORM)
  })

  it('returns the saved report', async () => {
    const saved = { ...MOCK_REPORT, report_data: MOCK_FORM, updated_at: '2026-09-25T13:05:00Z' }
    mockFetch(200, { status: 'success', data: saved })
    expect(await saveReport(IDR_ID, REPORT_ID, MOCK_FORM)).toEqual(saved)
  })

  it('throws the backend message on 409 (IDR already submitted)', async () => {
    mockFetch(409, { detail: 'Only draft IDRs can be edited' })
    await expect(saveReport(IDR_ID, REPORT_ID, MOCK_FORM)).rejects.toThrow('Only draft IDRs can be edited')
  })

  it('throws with status 404 when the report is not in this IDR', async () => {
    mockFetch(404, { detail: 'Report not found in this IDR' })
    await expect(saveReport(IDR_ID, REPORT_ID, MOCK_FORM))
      .rejects.toMatchObject({ message: 'Report not found in this IDR', status: 404 })
  })

  it('throws when fetch itself fails', async () => {
    mockFetchFailure('Network error')
    await expect(saveReport(IDR_ID, REPORT_ID, MOCK_FORM)).rejects.toThrow('Network error')
  })
})

describe('deleteReport', () => {
  it('sends DELETE to /v1/idrs/{id}/reports/{report_id} with no body', async () => {
    mockFetchNoContent()
    await deleteReport(IDR_ID, REPORT_ID)
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/reports/${REPORT_ID}`)
    expect(fetchInit()).toEqual({ method: 'DELETE' })
  })

  it('resolves on 204 without trying to parse the empty body', async () => {
    mockFetchNoContent()
    await expect(deleteReport(IDR_ID, REPORT_ID)).resolves.toBeUndefined()
  })

  it('throws with status 404 when the report is not in this IDR', async () => {
    mockFetch(404, { detail: 'Report not found in this IDR' })
    await expect(deleteReport(IDR_ID, REPORT_ID))
      .rejects.toMatchObject({ message: 'Report not found in this IDR', status: 404 })
  })

  it('throws the backend message on 409 (IDR already submitted)', async () => {
    mockFetch(409, { detail: 'Only draft IDRs can be edited' })
    await expect(deleteReport(IDR_ID, REPORT_ID)).rejects.toThrow('Only draft IDRs can be edited')
  })
})
