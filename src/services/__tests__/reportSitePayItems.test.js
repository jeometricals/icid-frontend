import { describe, it, expect, beforeEach, vi } from 'vitest'
import { addSitePayItem, listSitePayItems } from '../reportSitePayItems'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const URL = '/v1/idrs/idr-1/reports/rep-1/sites/site-1/pay-items'

describe('listSitePayItems', () => {
  it("GETs a site's pay items with the latest override entries (Slice X.1)", async () => {
    const rows = [{ id: 'spi-1', contract_item_id: 'ci-1', quantity: 185, overrides_auto: true }]
    const audit = [{ contract_item_id: 'ci-1', action: 'site_override_set', text: 'overrode auto 180 SF → 185 SF',
      at: '2026-10-21T18:05:00Z', actor_name: 'Jane Doe' }]
    mockFetch(200, { data: rows, audit })
    expect(await listSitePayItems('idr-1', 'rep-1', 'site-1')).toEqual({ rows, audit })
    expect(fetchUrl().pathname).toBe(URL)
    expect(fetchInit().method).toBe('GET')
  })

  it('reads no audit as none', async () => {
    mockFetch(200, { data: [] })
    expect(await listSitePayItems('idr-1', 'rep-1', 'site-1')).toEqual({ rows: [], audit: [] })
  })
})

describe('addSitePayItem', () => {
  it('POSTs an override with overrides_auto', async () => {
    const body = { contract_item_id: 'ci-1', quantity: '185', note: null, overrides_auto: true }
    mockFetch(201, { data: { id: 'spi-1', ...body, quantity: 185 } })
    expect((await addSitePayItem('idr-1', 'rep-1', 'site-1', body)).overrides_auto).toBe(true)
    expect(fetchUrl().pathname).toBe(URL)
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual(body)
  })
})
