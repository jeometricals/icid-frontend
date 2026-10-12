import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listQuantities } from '../quantities'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

const DATA = {
  rows: [{ pay_item_ref: '4.13 AAS', budget_code: 'BC-1', description: '4" sidewalk', amount: 120.5, unit: 'SF' }],
  totals_by_unit: { SF: 120.5 },
  row_count: 1,
  truncated: false,
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('listQuantities', () => {
  it('GETs the project\'s quantities with the range as from and to', async () => {
    mockFetch(200, { status: 'success', data: DATA })
    await listQuantities({ projectId: 'HWS0023', from: '2026-09-12', to: '2026-10-12' })
    const url = fetchUrl()
    expect(url.pathname).toBe('/v1/projects/HWS0023/quantities')
    expect(Object.fromEntries(url.searchParams)).toEqual({ from: '2026-09-12', to: '2026-10-12' })
    expect(fetchInit().method).toBe('GET')
  })

  it('leaves out a bound that isn\'t set, and the query string when neither is', async () => {
    mockFetch(200, { status: 'success', data: DATA })
    await listQuantities({ projectId: 'HWS0023', from: '2026-09-12', to: '' })
    expect(Object.fromEntries(fetchUrl().searchParams)).toEqual({ from: '2026-09-12' })

    mockFetch(200, { status: 'success', data: DATA })
    await listQuantities({ projectId: 'HWS0023' })
    expect(fetch.mock.calls[0][0]).toMatch(/\/v1\/projects\/HWS0023\/quantities$/)
  })

  it('returns the rows with their totals, count and truncated flag', async () => {
    mockFetch(200, { status: 'success', data: DATA })
    expect(await listQuantities({ projectId: 'HWS0023' })).toEqual(DATA)
  })

  it('throws the backend\'s reason, with its status, for a user who isn\'t on the project', async () => {
    mockFetch(403, { detail: 'Project access required' })
    await expect(listQuantities({ projectId: 'HWS0023' })).rejects.toMatchObject({
      message: 'Project access required', status: 403,
    })
  })
})
