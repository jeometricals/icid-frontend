import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listPirMatchLines } from '../matchLines'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const PIR_ID = 'e0000000-0000-4000-8000-000000000001'

describe('match lines (Slice Y4b)', () => {
  it("GETs a PIR's live match lines", async () => {
    const lines = [{ match_line_id: 'm1', pir_page_id: 'p1', page_number: 1, label: 'A', x1: 0, y1: 0, x2: 10, y2: 0 }]
    mockFetch(200, { data: lines })
    expect(await listPirMatchLines(PIR_ID)).toEqual(lines)
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/match-lines`)
    expect(fetchInit().method).toBe('GET')
  })
})
