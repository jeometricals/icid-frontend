import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listFlagNonAssessableAreas } from '../nonAssessableAreas'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const FLAG_ID = 'f1000000-0000-4000-8000-000000000001'

describe('listFlagNonAssessableAreas', () => {
  it("GETs one flag's live non-assessable areas", async () => {
    const areas = [{ non_assessable_area_id: 'na-1', flag_id: FLAG_ID, display_order: 1, reason: 'driveway' }]
    mockFetch(200, { data: areas })
    expect(await listFlagNonAssessableAreas(FLAG_ID)).toEqual(areas)
    expect(fetchUrl().pathname).toBe(`/v1/flags/${FLAG_ID}/non-assessable-areas`)
    expect(fetchInit().method).toBe('GET')
  })

  it('throws a 404 for an unknown flag', async () => {
    mockFetch(404, { detail: 'Flag not found' })
    await expect(listFlagNonAssessableAreas(FLAG_ID)).rejects.toMatchObject({ status: 404 })
  })
})
