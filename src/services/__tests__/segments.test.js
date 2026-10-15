import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listPirSegments } from '../segments'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const PIR_ID = 'e0000000-0000-4000-8000-000000000001'

describe('listPirSegments', () => {
  it("GETs the PIR's live segments across its pages", async () => {
    const segments = [{ segment_id: 'sg-1', segment_type: 'curb_concrete', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }]
    mockFetch(200, { data: segments })
    expect(await listPirSegments(PIR_ID)).toEqual(segments)
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/segments`)
    expect(fetchInit().method).toBe('GET')
  })
})
