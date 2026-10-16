import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { downloadAssessmentSummary } from '../assessmentSummary'
import { fetchUrl } from '../../test/mockFetch'
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
