import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { downloadAssessmentSummary, downloadTailoredAssessmentSummary, getAssessmentSites } from '../assessmentSummary'
import { fetchUrl, mockFetch } from '../../test/mockFetch'
import { setToken, clearToken } from '../session'

// A file response: its status, its Content-Disposition, and a JSON error body
function mockFile(status, { disposition = null, json = null } = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(disposition ? { 'Content-Disposition': disposition } : {}),
    blob: () => Promise.resolve(new Blob(['xlsx'])),
    text: () => Promise.resolve(json ? JSON.stringify(json) : 'xlsx'),
  })
}

let clicked // the downloads started: [href, download name]

beforeEach(() => {
  vi.restoreAllMocks()
  setToken('token-abc')
  clicked = []
  global.URL.createObjectURL = vi.fn(() => 'blob:summary')
  global.URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    clicked.push([this.getAttribute('href'), this.download])
  })
})

afterEach(() => { clearToken() })

describe('downloadAssessmentSummary', () => {
  it("downloads the project's workbook under the backend's file name", async () => {
    mockFile(200, { disposition: 'attachment; filename="SE384_assessment_summary_2026-10-16.xlsx"' })
    expect(await downloadAssessmentSummary('SE384')).toBe('SE384_assessment_summary_2026-10-16.xlsx')
    expect(fetchUrl().pathname).toBe('/v1/projects/SE384/assessment-summary.xlsx')
    expect(fetchUrl().search).toBe('')
    expect(clicked).toEqual([['blob:summary', 'SE384_assessment_summary_2026-10-16.xlsx']])
  })

  it('sends a month range when given', async () => {
    mockFile(200)
    await downloadAssessmentSummary('SE384', { from: '2026-10', to: '2026-11' })
    expect(fetchUrl().searchParams.get('from')).toBe('2026-10')
    expect(fetchUrl().searchParams.get('to')).toBe('2026-11')
  })

  it("names the file itself when the response doesn't", async () => {
    mockFile(200)
    expect(await downloadAssessmentSummary('SE384')).toBe('SE384_assessment_summary.xlsx')
  })

  it("throws the backend's refusal and downloads nothing", async () => {
    mockFile(400, { json: { detail: 'from after to' } })
    await expect(downloadAssessmentSummary('SE384', { from: '2026-11', to: '2026-10' }))
      .rejects.toMatchObject({ status: 400, message: 'from after to' })
    expect(clicked).toEqual([])
  })
})

describe('getAssessmentSites', () => {
  it("returns the project's sites for a range of days", async () => {
    mockFetch(200, { status: 'success', message: '1 constructed sites', data: { sites: [{ property_id: 'p1' }] } })
    expect(await getAssessmentSites('HWS0023', { from: '2026-10-01', to: '2026-10-31' }))
      .toEqual({ sites: [{ property_id: 'p1' }] })
    expect(fetchUrl().pathname).toBe('/v1/projects/HWS0023/assessment-summary')
    expect(fetchUrl().search).toBe('?from=2026-10-01&to=2026-10-31')
  })

  it('sends no dates when there are none', async () => {
    mockFetch(200, { data: { sites: [] } })
    await getAssessmentSites('HWS0023', { from: '', to: '' })
    expect(fetchUrl().search).toBe('')
  })
})

describe('downloadTailoredAssessmentSummary', () => {
  it('downloads the view: its dates and each site shown', async () => {
    mockFile(200, { disposition: 'attachment; filename="HWS0023_assessment_summary_tailored_2026-10-19.xlsx"' })
    expect(await downloadTailoredAssessmentSummary('HWS0023', { from: '2026-10-01', to: '', propertyIds: ['p1', 'p2'] }))
      .toBe('HWS0023_assessment_summary_tailored_2026-10-19.xlsx')
    expect(fetchUrl().pathname).toBe('/v1/projects/HWS0023/assessment-summary/tailored.xlsx')
    expect(fetchUrl().searchParams.get('from')).toBe('2026-10-01')
    expect(fetchUrl().searchParams.has('to')).toBe(false)
    expect(fetchUrl().searchParams.getAll('property_id')).toEqual(['p1', 'p2'])
  })

  it('sends no sites when none are given, and names the file itself', async () => {
    mockFile(200)
    expect(await downloadTailoredAssessmentSummary('HWS0023')).toBe('HWS0023_assessment_summary_tailored.xlsx')
    expect(fetchUrl().search).toBe('')
  })
})
