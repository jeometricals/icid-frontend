import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getContractItems } from '../contractItems'
import { mockFetch, mockFetchFailure } from '../../test/mockFetch'
import { MOCK_CONTRACT_ITEMS } from '../../test/contractItems'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('getContractItems', () => {
  it('calls the contract items endpoint with the text project id', async () => {
    mockFetch(200, { status: 'success', data: MOCK_CONTRACT_ITEMS })
    await getContractItems('HWS0023')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/contract_items/?project_id=HWS0023'),
      { method: 'GET' }
    )
  })

  it('returns the data array on success', async () => {
    mockFetch(200, { status: 'success', data: MOCK_CONTRACT_ITEMS })
    expect(await getContractItems('HWS0023')).toEqual(MOCK_CONTRACT_ITEMS)
  })

  it('returns an empty array for a project with no contract items', async () => {
    mockFetch(200, { status: 'success', data: [] })
    expect(await getContractItems('SE384')).toEqual([])
  })

  it('throws when the API returns a non-ok status', async () => {
    mockFetch(500, { detail: 'Failed to fetch contract items' })
    await expect(getContractItems('HWS0023')).rejects.toThrow('Failed to fetch contract items')
  })

  it('throws when fetch itself fails (network error)', async () => {
    mockFetchFailure('Network error')
    await expect(getContractItems('HWS0023')).rejects.toThrow('Network error')
  })
})
