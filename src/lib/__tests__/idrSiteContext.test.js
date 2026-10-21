import { describe, it, expect } from 'vitest'
import { autoSourceText, claimedElsewhereNote, readIdrContext, siteGeometryRows, withIdrContext } from '../idrSiteContext'

const SITE = 'prop-1'

const flag = (extra = {}) => ({
  property_id: SITE, state: 'attributed', pay_item_ref: '4.13 AAS', budget_code: 'HW-200(S)',
  pay_item_description: '4in sidewalk', unit: 'SF', amount: 40, ...extra,
})
const segment = (extra = {}) => ({
  property_id: SITE, state: 'attributed', pay_item_ref: '4.08 AA', budget_code: 'HW-200(S)',
  pay_item_description: 'Concrete curb', unit: 'LF', amount: 12.5, ...extra,
})

describe('readIdrContext', () => {
  it('reads both ids, with or without the ?', () => {
    expect(readIdrContext('?idrId=i1&reportId=r1&returnTo=%2Fproject%2FX')).toEqual({ idrId: 'i1', reportId: 'r1' })
    expect(readIdrContext(new URLSearchParams('idrId=i1&reportId=r1'))).toEqual({ idrId: 'i1', reportId: 'r1' })
  })

  it('is null unless both are there', () => {
    expect(readIdrContext('?idrId=i1')).toBeNull()
    expect(readIdrContext('?reportId=r1')).toBeNull()
    expect(readIdrContext('')).toBeNull()
    expect(readIdrContext(undefined)).toBeNull()
  })
})

describe('withIdrContext', () => {
  it('adds both ids, keeping the query string and the hash', () => {
    expect(withIdrContext('/project/P/properties/p1/pir?returnTo=%2Fx#top', { idrId: 'i1', reportId: 'r1' }))
      .toBe('/project/P/properties/p1/pir?returnTo=%2Fx&idrId=i1&reportId=r1#top')
  })

  it('leaves the path alone without a context', () => {
    expect(withIdrContext('/project/P/properties/p1', null)).toBe('/project/P/properties/p1')
  })
})

describe('siteGeometryRows', () => {
  it("sums the site's counting flags and segments per pay item, by item number", () => {
    const flags = [flag(), flag({ amount: 2.255 }), flag({ state: 'claimed', amount: 10 })]
    expect(siteGeometryRows(flags, [segment()], SITE)).toEqual([
      { key: '4.08 AA|HW-200(S)', pay_item_ref: '4.08 AA', budget_code: 'HW-200(S)', description: 'Concrete curb',
        unit: 'LF', amount: 12.5, flags: 0, segments: 1 },
      { key: '4.13 AAS|HW-200(S)', pay_item_ref: '4.13 AAS', budget_code: 'HW-200(S)', description: '4in sidewalk',
        unit: 'SF', amount: 52.26, flags: 3, segments: 0 },
    ])
  })

  it('leaves out other sites, excluded and claimed-elsewhere ones, and ones with no amount', () => {
    const flags = [flag({ property_id: 'prop-2' }), flag({ state: 'excluded' }), flag({ state: 'claimed_elsewhere' }),
      flag({ amount: null })]
    expect(siteGeometryRows(flags, [segment({ amount: null })], SITE)).toEqual([])
    expect(siteGeometryRows(undefined, undefined, SITE)).toEqual([])
  })
})

describe('autoSourceText', () => {
  it('names the flags and segments behind an auto row', () => {
    expect(autoSourceText({ flags: 8, segments: 0 })).toBe('auto (8 flags)')
    expect(autoSourceText({ flags: 0, segments: 1 })).toBe('auto (1 segment)')
    expect(autoSourceText({ flags: 8, segments: 1 })).toBe('auto (8 flags, 1 segment)')
    expect(autoSourceText({ flags: 1, segments: 2 })).toBe('auto (1 flag, 2 segments)')
  })
})

describe('claimedElsewhereNote', () => {
  const billed = (by, extra = {}) => ({ state: 'claimed_elsewhere', claimed_by_idr_id: `id-${by}`, claimed_by_idr_number: by,
    constructed_on: '2026-10-16', ...extra })

  it('says what each other IDR billed on the site, by IDR', () => {
    const flags = [...Array(8)].map(() => flag(billed('IDR-001'))).concat([flag(billed('IDR-002', { constructed_on: '2026-10-02' }))])
    expect(claimedElsewhereNote(flags, [segment(billed('IDR-001'))], SITE)).toBe(
      '8 flags and 1 curb segment here were billed by IDR-001 (10/16/26). 1 flag here was billed by IDR-002 (10/2/26).')
  })

  it("counts only the site's drawings claimed elsewhere; null without any", () => {
    expect(claimedElsewhereNote([flag(), flag(billed('IDR-001', { property_id: 'other' }))], [segment({ state: 'claimed' })], SITE))
      .toBeNull()
    expect(claimedElsewhereNote([], [segment(billed('IDR-001')), segment(billed('IDR-001'))], SITE))
      .toBe('2 curb segments here were billed by IDR-001 (10/16/26).')
  })
})
