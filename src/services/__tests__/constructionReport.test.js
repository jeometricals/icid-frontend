import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  SKETCH_TOO_LARGE_MESSAGE, downloadConstructionReport, downloadConstructionReportZip,
} from '../constructionReport'
import { apiFetchFile } from '../apiClient'
import { fetchUrl } from '../../test/mockFetch'
import { setToken, clearToken } from '../session'

const PROPERTY_ID = 'a1000000-0000-4000-8000-000000000001'
const IDR_ID = 'b1000000-0000-4000-8000-000000000001'

// A file response: its bytes, its status and its Content-Disposition
function mockFile(status, { body = 'PDF', disposition = null, json = null } = {}) {
  const headers = new Headers(disposition ? { 'Content-Disposition': disposition } : {})
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers,
    blob: () => Promise.resolve(new Blob([body])),
    text: () => Promise.resolve(json ? JSON.stringify(json) : body),
  })
}

let clicked // the downloads the temporary links started: [href, download name]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.useFakeTimers()
  setToken('token-abc')
  clicked = []
  global.URL.createObjectURL = vi.fn(() => 'blob:report')
  global.URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    clicked.push([this.getAttribute('href'), this.download])
  })
})

afterEach(() => {
  vi.useRealTimers()
  clearToken()
})

describe('apiFetchFile', () => {
  it('reads the file and its name from Content-Disposition, with the bearer token', async () => {
    mockFile(200, { disposition: 'attachment; filename="138-22_227_STREET_construction_report.pdf"' })
    const { blob, filename } = await apiFetchFile('/v1/x', 'fallback.pdf')
    expect(filename).toBe('138-22_227_STREET_construction_report.pdf')
    expect(await blob.text()).toBe('PDF')
    expect(fetch.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer token-abc' })
  })

  it('falls back to the given name without a Content-Disposition', async () => {
    mockFile(200)
    expect((await apiFetchFile('/v1/x', 'fallback.pdf')).filename).toBe('fallback.pdf')
  })

  it("throws the backend's refusal with its status and detail", async () => {
    mockFile(422, { json: { detail: SKETCH_TOO_LARGE_MESSAGE } })
    await expect(apiFetchFile('/v1/x', 'f.pdf')).rejects.toMatchObject({ status: 422, message: SKETCH_TOO_LARGE_MESSAGE })
  })
})

describe('downloadConstructionReport', () => {
  it("downloads the property's report under the backend's file name", async () => {
    mockFile(200, { disposition: 'attachment; filename="350_Main_St_Brooklyn_construction_report.pdf"' })
    expect(await downloadConstructionReport(PROPERTY_ID)).toBe('350_Main_St_Brooklyn_construction_report.pdf')
    expect(fetchUrl().pathname).toBe(`/v1/properties/${PROPERTY_ID}/construction-report`)
    expect(fetchUrl().search).toBe('')
    expect(clicked).toEqual([['blob:report', '350_Main_St_Brooklyn_construction_report.pdf']])
    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report')
  })

  it('asks for a given IDR', async () => {
    mockFile(200)
    await downloadConstructionReport(PROPERTY_ID, IDR_ID)
    expect(fetchUrl().searchParams.get('idr_id')).toBe(IDR_ID)
  })

  it('throws a 404 when no approved IDR covers the flags, and downloads nothing', async () => {
    mockFile(404, { json: { detail: "No approved IDR covers this property's flags" } })
    await expect(downloadConstructionReport(PROPERTY_ID)).rejects.toMatchObject({ status: 404 })
    expect(clicked).toEqual([])
  })
})

describe('downloadConstructionReportZip', () => {
  it("downloads an IDR's reports as a ZIP", async () => {
    mockFile(200, { disposition: 'attachment; filename="IDR_001_construction_reports.zip"' })
    expect(await downloadConstructionReportZip(IDR_ID)).toBe('IDR_001_construction_reports.zip')
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/construction-reports`)
    expect(clicked[0][1]).toBe('IDR_001_construction_reports.zip')
  })
})
