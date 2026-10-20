import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  approveInspection, getCornerInspection, returnInspection, startInspection, submitInspection, unlockInspection,
  updateInspection,
} from '../pedRampInspections'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const CORNER_ID = 'd0000000-0000-4000-8000-000000000001'
const INSPECTION_ID = 'e0000000-0000-4000-8000-000000000001'
const INSPECTION = { id: INSPECTION_ID, corner_id: CORNER_ID, status: 'draft' }

describe('ped ramp inspections', () => {
  it("reads a corner's inspection, null when there is none", async () => {
    mockFetch(200, { data: INSPECTION })
    expect(await getCornerInspection(CORNER_ID)).toEqual(INSPECTION)
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-corners/${CORNER_ID}/inspection`)
    mockFetch(200, { data: null })
    expect(await getCornerInspection(CORNER_ID)).toBeNull()
  })

  it('starts one', async () => {
    mockFetch(201, { data: INSPECTION })
    expect(await startInspection(CORNER_ID)).toEqual(INSPECTION)
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-corners/${CORNER_ID}/inspection/start`)
    expect(fetchInit().method).toBe('POST')
  })

  it('records the requirements answer', async () => {
    mockFetch(200, { data: { ...INSPECTION, requirements_met: false } })
    await updateInspection(INSPECTION_ID, false)
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-inspections/${INSPECTION_ID}`)
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ requirements_met: false })
  })

  it('submits, returns with a comment and approves', async () => {
    for (const [call, path, body] of [
      [() => submitInspection(INSPECTION_ID), 'submit', undefined],
      [() => returnInspection(INSPECTION_ID, 'Check slopes'), 'return', { comment: 'Check slopes' }],
      [() => approveInspection(INSPECTION_ID), 'approve', undefined],
      [() => unlockInspection(INSPECTION_ID), 'admin/unlock', undefined],
    ]) {
      mockFetch(200, { data: INSPECTION })
      await call()
      expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-inspections/${INSPECTION_ID}/${path}`)
      expect(fetchInit().method).toBe('POST')
      if (body) expect(JSON.parse(fetchInit().body)).toEqual(body)
    }
  })

  it("throws the backend's refusal", async () => {
    mockFetch(409, { detail: "Approve or delete this inspection's draft TIFs first" })
    await expect(approveInspection(INSPECTION_ID)).rejects.toMatchObject({
      status: 409, message: "Approve or delete this inspection's draft TIFs first",
    })
  })
})
