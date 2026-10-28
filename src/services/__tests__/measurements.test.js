import { describe, it, expect, beforeEach, vi } from 'vitest'
import { bundleFlags, getMeasurement, unbundleMeasurement, updateMeasurement } from '../measurements'
import { createSegment, deleteSegment } from '../segments'
import { mockFetch, mockFetchNoContent, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const PAGE_ID = 'e2000000-0000-4000-8000-000000000001'
const BUNDLE_ID = 'b1000000-0000-4000-8000-000000000001'
const BUNDLE = { measurement_id: BUNDLE_ID, outer_area: 50, members: [] }

describe('measurements (Slice Y4a)', () => {
  it('GETs one measurement', async () => {
    mockFetch(200, { data: BUNDLE })
    expect(await getMeasurement(BUNDLE_ID)).toEqual(BUNDLE)
    expect(fetchUrl().pathname).toBe(`/v1/measurements/${BUNDLE_ID}`)
    expect(fetchInit().method).toBe('GET')
  })

  it("POSTs a bundle of a page's flags with the outline measured", async () => {
    mockFetch(201, { data: BUNDLE })
    expect(await bundleFlags(PAGE_ID, ['f1', 'f2'], [{ L: 10, W: 5 }])).toEqual(BUNDLE)
    expect(fetchUrl().pathname).toBe(`/v1/pir-pages/${PAGE_ID}/measurements/bundle`)
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({ flag_ids: ['f1', 'f2'], outer_dimensions: { rectangles: [{ L: 10, W: 5 }] } })
  })

  it('PATCHes a re-measurement', async () => {
    mockFetch(200, { data: BUNDLE })
    expect(await updateMeasurement(BUNDLE_ID, { needs_remeasure: false })).toEqual(BUNDLE)
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ needs_remeasure: false })
  })

  it('DELETEs a bundle to break it up', async () => {
    mockFetchNoContent()
    await unbundleMeasurement(BUNDLE_ID)
    expect(fetchUrl().pathname).toBe(`/v1/measurements/${BUNDLE_ID}`)
    expect(fetchInit().method).toBe('DELETE')
  })
})

describe('segments drawn and deleted (Slice Y4a)', () => {
  it('POSTs a curb to its page', async () => {
    const body = { segment_type: 'curb_granite', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], pay_item_id: null }
    mockFetch(201, { data: { segment_id: 'sg-1', ...body } })
    expect((await createSegment(PAGE_ID, body)).segment_id).toBe('sg-1')
    expect(fetchUrl().pathname).toBe(`/v1/pir-pages/${PAGE_ID}/segments`)
    expect(JSON.parse(fetchInit().body)).toEqual(body)
  })

  it('DELETEs a curb', async () => {
    mockFetchNoContent()
    await deleteSegment('sg-1')
    expect(fetchUrl().pathname).toBe('/v1/segments/sg-1')
    expect(fetchInit().method).toBe('DELETE')
  })
})
