import { describe, it, expect } from 'vitest'
import { listOrigin } from '../listOrigin'

describe('listOrigin', () => {
  it('reads which list opened the IDR, and the archive\'s filters, from router state', () => {
    const location = { state: { from: 'archive', archiveSearch: '?idr_number=SW', payItemGate: { itemId: 'x' } } }
    expect(listOrigin(location)).toEqual({ from: 'archive', archiveSearch: '?idr_number=SW' })
  })

  it('gives nothing for a page opened without state', () => {
    expect(listOrigin({ state: null })).toEqual({ from: undefined, archiveSearch: undefined })
    expect(listOrigin({})).toEqual({ from: undefined, archiveSearch: undefined })
  })
})
