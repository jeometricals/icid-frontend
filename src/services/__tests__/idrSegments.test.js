import { describe, it, expect, beforeEach, vi } from 'vitest'
import { excludeIdrSegment, getIdrSegments, includeIdrSegment } from '../idrSegments'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const IDR_ID = '5a0e8c1d-0000-4000-8000-00000000000a'
const SEGMENT_ID = 'c0000000-0000-4000-8000-000000000001'
const DATA = { idr_id: IDR_ID, frozen: false, segments: [], pay_items: [], unmapped: 0 }

describe('getIdrSegments', () => {
  it("GETs the IDR's attributed curb segments", async () => {
    mockFetch(200, { status: 'success', message: 'IDR segments', data: DATA })
    expect(await getIdrSegments(IDR_ID)).toEqual(DATA)
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/attributed-segments`)
    expect(fetchInit().method).toBe('GET')
  })
})

describe.each([
  ['excludeIdrSegment', excludeIdrSegment, 'exclude'],
  ['includeIdrSegment', includeIdrSegment, 'include'],
])('%s', (_, call, action) => {
  it(`POSTs to .../${action} with no body and returns the IDR's segments`, async () => {
    mockFetch(200, { status: 'success', message: 'Segment changed', data: DATA })
    expect(await call(IDR_ID, SEGMENT_ID)).toEqual(DATA)
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/attributed-segments/${SEGMENT_ID}/${action}`)
    expect(fetchInit().method).toBe('POST')
    expect(fetchInit().body).toBeUndefined()
  })

  it('surfaces a refusal', async () => {
    mockFetch(409, { detail: 'Segment is claimed by IDR 003' })
    await expect(call(IDR_ID, SEGMENT_ID)).rejects.toMatchObject({ message: 'Segment is claimed by IDR 003', status: 409 })
  })
})
