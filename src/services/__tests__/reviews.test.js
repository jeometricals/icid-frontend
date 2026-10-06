import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  acceptStage1, acceptStage2, adminDeleteIdr, adminUnlockIdr, approveStage1, approveStage2, getReviewQueue, returnIdr,
} from '../reviews'
import { mockFetch, mockFetchFailure, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const IDR_ID = '5a0e8c1d-0000-4000-8000-00000000000a'
const OTHER_IDR_ID = '5a0e8c1d-0000-4000-8000-00000000000b'
const MOCK_IDR = { idr_id: IDR_ID, project_id: 'HWS0023', status: 'stage1_review', idr_number: '005' }

// ---------------------------------------------------------------------------
// getReviewQueue
// ---------------------------------------------------------------------------

describe('getReviewQueue', () => {
  it.each(['submitted', 'stage1_review', 'stage2_review'])('asks for the %s queue', async (status) => {
    mockFetch(200, { status: 'success', data: [MOCK_IDR] })
    const rows = await getReviewQueue(status)
    expect(fetchUrl().pathname).toBe('/v1/idrs/queue')
    expect(fetchUrl().searchParams.get('status')).toBe(status)
    expect(fetchInit().method).toBe('GET')
    expect(rows).toEqual([MOCK_IDR])
  })

  it('puts no user in the URL: the backend reads the reviewer from the token', async () => {
    mockFetch(200, { status: 'success', data: [] })
    await getReviewQueue('submitted')
    expect([...fetchUrl().searchParams.keys()]).toEqual(['status'])
  })

  it('throws with the backend message and status on failure', async () => {
    mockFetch(500, { detail: 'Failed to list the review queue' })
    await expect(getReviewQueue('submitted')).rejects.toMatchObject({ message: 'Failed to list the review queue', status: 500 })
  })
})

// ---------------------------------------------------------------------------
// acceptStage1
// ---------------------------------------------------------------------------

describe('acceptStage1', () => {
  it('POSTs the IDR number and returns the updated IDR', async () => {
    mockFetch(200, { status: 'success', data: MOCK_IDR })
    const idr = await acceptStage1(IDR_ID, '005')
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/accept-stage1`)
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({ idr_number: '005' })
    expect(idr).toEqual(MOCK_IDR)
  })

  it('sends an empty body when no number is given (an IDR that already has one)', async () => {
    mockFetch(200, { status: 'success', data: MOCK_IDR })
    await acceptStage1(IDR_ID)
    expect(JSON.parse(fetchInit().body)).toEqual({})
  })

  it('carries the other IDR on a 409 for a number already in use', async () => {
    mockFetch(409, { detail: 'This IDR number is already in use on this project', existing_idr_id: OTHER_IDR_ID })
    const error = await acceptStage1(IDR_ID, '005').catch(err => err)
    expect(error.status).toBe(409)
    expect(error.message).toBe('This IDR number is already in use on this project')
    expect(error.body.existing_idr_id).toBe(OTHER_IDR_ID)
  })

  it('throws the backend message when the number is missing', async () => {
    mockFetch(400, { detail: 'An IDR number is required to accept this IDR' })
    await expect(acceptStage1(IDR_ID, ' ')).rejects.toMatchObject({ status: 400 })
  })
})

// ---------------------------------------------------------------------------
// approveStage1, acceptStage2, approveStage2, and the admin's unlock and soft delete
// ---------------------------------------------------------------------------

describe.each([
  ['approveStage1', approveStage1, 'approve-stage1'],
  ['acceptStage2', acceptStage2, 'accept-stage2'],
  ['approveStage2', approveStage2, 'approve-stage2'],
  ['adminUnlockIdr', adminUnlockIdr, 'admin/unlock'],
  ['adminDeleteIdr', adminDeleteIdr, 'admin/delete'],
])('%s', (_, call, segment) => {
  it(`POSTs to /${segment} with no body and returns the updated IDR`, async () => {
    mockFetch(200, { status: 'success', data: MOCK_IDR })
    const idr = await call(IDR_ID)
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/${segment}`)
    expect(fetchInit().method).toBe('POST')
    expect(fetchInit().body).toBeUndefined()
    expect(idr).toEqual(MOCK_IDR)
  })

  it('throws with the backend message and status when refused', async () => {
    mockFetch(403, { detail: 'Only the reviewer who accepted this IDR can do this' })
    await expect(call(IDR_ID)).rejects.toMatchObject({
      message: 'Only the reviewer who accepted this IDR can do this', status: 403,
    })
  })

  it('throws without a status when the request never gets an answer', async () => {
    mockFetchFailure('Network error')
    const error = await call(IDR_ID).catch(err => err)
    expect(error.message).toBe('Network error')
    expect(error.status).toBeUndefined()
  })
})

describe('approveStage2', () => {
  it('surfaces the missing-signature refusal', async () => {
    mockFetch(400, { detail: 'Signature required before approving' })
    await expect(approveStage2(IDR_ID)).rejects.toMatchObject({ message: 'Signature required before approving', status: 400 })
  })
})

// ---------------------------------------------------------------------------
// returnIdr
// ---------------------------------------------------------------------------

describe('returnIdr', () => {
  it.each(['inspector', 'oe'])('POSTs who it goes to (%s) and the comment', async (to) => {
    mockFetch(200, { status: 'success', data: { ...MOCK_IDR, status: 'draft' } })
    const idr = await returnIdr(IDR_ID, { to, comment: 'fix the pay-item quantity' })
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/return`)
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({ to, comment: 'fix the pay-item quantity' })
    expect(idr.status).toBe('draft')
  })

  it('throws the backend message for a blank comment', async () => {
    mockFetch(400, { detail: 'A comment is required to return an IDR' })
    await expect(returnIdr(IDR_ID, { to: 'inspector', comment: ' ' })).rejects.toMatchObject({
      message: 'A comment is required to return an IDR', status: 400,
    })
  })
})
