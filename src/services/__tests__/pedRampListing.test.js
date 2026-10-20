import { describe, it, expect, beforeEach, vi } from 'vitest'
import { bulkDownloadPedRampInspections, listPedRampInspections } from '../pedRampListing'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const INSPECTION_ID = 'e0000000-0000-4000-8000-000000000001'
const RE_ID = 'b0000000-0000-4000-8000-000000000003'
const PAGE = { total: 1, page: 1, page_size: 30, rows: [{ inspection_id: INSPECTION_ID }] }
const LINK = { url: 'https://storage.example/z.zip', expires_at: '2026-10-21T13:00:00Z', corner_count: 3, file_name: 'HWS0023.zip' }

describe('the ped ramp listing', () => {
  it('lists a page, sending only the filters set', async () => {
    mockFetch(200, { data: PAGE })
    expect(await listPedRampInspections('HWS0023')).toEqual(PAGE)
    expect(fetchUrl().pathname).toBe('/v1/projects/HWS0023/ped-ramp-inspections')
    expect(Object.fromEntries(fetchUrl().searchParams)).toEqual({ page: '1', page_size: '30' })

    mockFetch(200, { data: PAGE })
    await listPedRampInspections('HWS0023', {
      status: 'approved', inspectorUuid: '', reUuid: RE_ID, from: '2026-10-01', to: '', hasTif: 'no', q: ' 3rd ', page: 2,
    })
    expect(Object.fromEntries(fetchUrl().searchParams)).toEqual({
      status: 'approved', re_uuid: RE_ID, from: '2026-10-01', has_tif: 'no', q: '3rd', page: '2', page_size: '30',
    })
  })

  it('asks for the bulk ZIP with the same filters in the body', async () => {
    mockFetch(200, { data: LINK })
    expect(await bulkDownloadPedRampInspections('HWS0023', { hasTif: 'yes', q: '' })).toEqual(LINK)
    expect(fetchUrl().pathname).toBe('/v1/projects/HWS0023/ped-ramp-inspections/bulk-download')
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({ has_tif: 'yes' })
  })

  it("throws the backend's refusal of a bulk ZIP", async () => {
    mockFetch(400, { detail: 'More than 100 corners match: narrow the filters to download at most 100' })
    await expect(bulkDownloadPedRampInspections('HWS0023')).rejects.toMatchObject({ status: 400 })
  })
})
