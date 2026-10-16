import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getPageTitleBlock, updatePirTitleBlock } from '../pirTitleBlock'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => { vi.restoreAllMocks() })

const PIR_ID = 'e0000000-0000-4000-8000-000000000001'

describe('pirTitleBlock', () => {
  it("reads a page's title block", async () => {
    mockFetch(200, { status: 'success', data: { pir_page_id: 'page-1', contract_no: 'HWS0023' } })
    expect(await getPageTitleBlock('page-1')).toEqual({ pir_page_id: 'page-1', contract_no: 'HWS0023' })
    expect(fetchUrl().pathname).toBe('/v1/pir-pages/page-1/annotations')
  })

  it('reads null for a page without one', async () => {
    mockFetch(200, { status: 'success', message: 'No annotations for this page', data: null })
    expect(await getPageTitleBlock('page-1')).toBeNull()
  })

  it('saves the fields given with a PATCH and returns the whole block', async () => {
    const block = { pir_id: PIR_ID, contract_no: 'HWS0023', date_notice_issued: null, date_excavated: null,
      date_constructed: '2026-10-05', north_bearing: 'NE' }
    mockFetch(200, { status: 'success', message: 'Title block saved', data: block })
    expect(await updatePirTitleBlock(PIR_ID, { contract_no: 'HWS0023', north_bearing: 'NE' })).toEqual(block)
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/title-block`)
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ contract_no: 'HWS0023', north_bearing: 'NE' })
  })

  it("throws the backend's refusal", async () => {
    mockFetch(400, { detail: 'Invalid north bearing' })
    await expect(updatePirTitleBlock(PIR_ID, { north_bearing: 'XX' })).rejects.toMatchObject({ status: 400, message: 'Invalid north bearing' })
  })
})
