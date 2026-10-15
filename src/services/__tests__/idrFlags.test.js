import { describe, it, expect, beforeEach, vi } from 'vitest'
import { excludeIdrFlag, getIdrFlags, includeIdrFlag } from '../idrFlags'
import * as api from '../api'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'
import { idrFlag, idrFlagsData } from '../../test/idrFlags'

beforeEach(() => {
  vi.restoreAllMocks()
})

const IDR_ID = '5a0e8c1d-0000-4000-8000-00000000000a'
const FLAG_ID = 'f0000000-0000-4000-8000-000000000001'
const DATA = idrFlagsData([idrFlag({ flag_id: FLAG_ID })])

describe('getIdrFlags', () => {
  it("GETs the IDR's attributed flags", async () => {
    mockFetch(200, { status: 'success', message: 'IDR flags', data: DATA })
    expect(await getIdrFlags(IDR_ID)).toEqual(DATA)
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/attributed-flags`)
    expect(fetchInit().method).toBe('GET')
  })
})

describe.each([
  ['excludeIdrFlag', excludeIdrFlag, 'exclude'],
  ['includeIdrFlag', includeIdrFlag, 'include'],
])('%s', (_, call, action) => {
  it(`POSTs to .../${action} with no body and returns the IDR's flags`, async () => {
    mockFetch(200, { status: 'success', message: 'Flag changed', data: DATA })
    expect(await call(IDR_ID, FLAG_ID)).toEqual(DATA)
    expect(fetchUrl().pathname).toBe(`/v1/idrs/${IDR_ID}/attributed-flags/${FLAG_ID}/${action}`)
    expect(fetchInit().method).toBe('POST')
    expect(fetchInit().body).toBeUndefined()
  })

  it('surfaces a refusal', async () => {
    mockFetch(409, { detail: 'Flag is claimed by IDR 003' })
    await expect(call(IDR_ID, FLAG_ID)).rejects.toMatchObject({ message: 'Flag is claimed by IDR 003', status: 409 })
  })
})

describe('barrel', () => {
  it('re-exports the calls from api.js', () => {
    expect(api.getIdrFlags).toBe(getIdrFlags)
    expect(api.excludeIdrFlag).toBe(excludeIdrFlag)
    expect(api.includeIdrFlag).toBe(includeIdrFlag)
  })
})
