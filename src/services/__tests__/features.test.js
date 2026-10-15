import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listPirFeatures } from '../features'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const PIR_ID = 'e0000000-0000-4000-8000-000000000001'

describe('listPirFeatures', () => {
  it("GETs the PIR's live features across its pages", async () => {
    const features = [{ feature_id: 'ft-1', feature_type: 'hydrant', sketch_x: 50, sketch_y: 60 }]
    mockFetch(200, { data: features })
    expect(await listPirFeatures(PIR_ID)).toEqual(features)
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/features`)
    expect(fetchInit().method).toBe('GET')
  })

  it('throws the backend\'s refusal', async () => {
    mockFetch(403, { detail: 'Not on this project' })
    await expect(listPirFeatures(PIR_ID)).rejects.toMatchObject({ status: 403, message: 'Not on this project' })
  })
})
