import { describe, it, expect } from 'vitest'
import {
  canChangeIdrFlags, claimSentence, claimSummary, flagAmountText, flagPayItemText, flagSiteName, flagsHeading,
  releaseSentence, sketchLink,
} from '../idrFlags'
import { PED_RAMP_SITE, idrFlag, idrFlagsData } from '../../test/idrFlags'
import { DEMO_USER, TEST_USER } from '../../test/users'

const ADMIN = { ...TEST_USER, uuid: 'admin-uuid', role: 'admin' }
const OLIVE = { ...TEST_USER, uuid: 'olive-uuid' }

describe('a flag as the IDR lists it', () => {
  it('names its site as sites are named', () => {
    expect(flagSiteName(idrFlag())).toBe('Queens Block 123 Lot 45')
    expect(flagSiteName(idrFlag(PED_RAMP_SITE))).toBe('Atlantic Ave & Court St — NE Quadrant (Facing Court St)')
  })

  it("gives its amount in its pay item's unit, else its square feet", () => {
    expect(flagAmountText(idrFlag({ unit: 'SY', amount: 4.7222 }))).toBe('4.72 SY')
    expect(flagAmountText(idrFlag({ unit: 'SF', amount: 1234.5 }))).toBe('1,234.5 SF')
    expect(flagAmountText(idrFlag({ unit: null, amount: null, quantity_sf: 12.5 }))).toBe('12.5 SF')
    expect(flagAmountText(idrFlag({ unit: 'LF', amount: null, quantity_sf: 9 }))).toBe('9 SF')
  })

  it('names its pay item, or none', () => {
    expect(flagPayItemText(idrFlag())).toBe('608-01 — 4" Concrete Sidewalk')
    expect(flagPayItemText(idrFlag({ pay_item_id: null }))).toBeNull()
  })

  it('links to its page in the sketch workspace, selected', () => {
    expect(sketchLink('SE384', idrFlag({ page_number: 3 }))).toBe('/project/SE384/properties/prop-1/pir?page=3&flag=flag-1')
  })
})

describe('canChangeIdrFlags', () => {
  const draft = { status: 'draft', reporter_uuid: TEST_USER.uuid }

  it("lets a draft's inspector and an admin, but not another user or a demo user", () => {
    expect(canChangeIdrFlags(draft, TEST_USER)).toBe(true)
    expect(canChangeIdrFlags(draft, ADMIN)).toBe(true)
    expect(canChangeIdrFlags(draft, OLIVE)).toBe(false)
    expect(canChangeIdrFlags({ ...draft, reporter_uuid: DEMO_USER.uuid }, DEMO_USER)).toBe(false)
    expect(canChangeIdrFlags(draft, null)).toBe(false)
  })

  it('lets the reviewer who accepted it at its stage, or an admin, while it is in review', () => {
    const stage1 = { status: 'stage1_review', reporter_uuid: TEST_USER.uuid, stage1_reviewer_uuid: OLIVE.uuid }
    expect(canChangeIdrFlags(stage1, OLIVE, ['oe'])).toBe(true)
    expect(canChangeIdrFlags(stage1, TEST_USER, ['oe'])).toBe(false)
    expect(canChangeIdrFlags(stage1, ADMIN)).toBe(true)
    const stage2 = { status: 'stage2_review', re_reviewer_uuid: OLIVE.uuid }
    expect(canChangeIdrFlags(stage2, OLIVE, ['re'])).toBe(true)
    expect(canChangeIdrFlags(stage2, OLIVE, ['oe'])).toBe(false)
  })

  it.each(['submitted', 'approved', 'deleted'])('lets nobody at %s', (status) => {
    expect(canChangeIdrFlags({ status, reporter_uuid: TEST_USER.uuid }, ADMIN)).toBe(false)
    expect(canChangeIdrFlags({ status, reporter_uuid: TEST_USER.uuid }, TEST_USER)).toBe(false)
  })
})

describe('the words for a claim', () => {
  const FLAGS = [
    idrFlag(),
    idrFlag({ flag_id: 'f2', property_id: 'prop-2', quantity_sf: 370 }),
    idrFlag({ flag_id: 'f3', property_id: 'prop-2', surveyed_thickness: '7in', quantity_sf: 180 }),
    idrFlag({ flag_id: 'f4', surveyed_thickness: '7in_as_4in', quantity_sf: 20.25 }),
    idrFlag({ flag_id: 'f5', state: 'excluded', quantity_sf: 1000 }),
    idrFlag({ flag_id: 'f6', state: 'claimed_elsewhere', quantity_sf: 1000 }),
  ]

  it('heads the panel with the attributed count out of all, or once approved the claimed count', () => {
    expect(flagsHeading(idrFlagsData(FLAGS))).toBe('Flags attributed (4 of 6)')
    expect(flagsHeading(idrFlagsData([idrFlag({ state: 'claimed' })], { frozen: true }))).toBe('Flags claimed (1)')
  })

  it('sums the attributed flags: how many, on how many sites, square feet by thickness', () => {
    expect(claimSummary(idrFlagsData(FLAGS))).toEqual({
      flagCount: 4,
      siteCount: 2,
      byThickness: [
        { thickness: '4in', label: '4"', sf: 420 },
        { thickness: '7in_as_4in', label: '7" as 4"', sf: 20.25 },
        { thickness: '7in', label: '7"', sf: 180 },
      ],
    })
  })

  it('says what approving claims', () => {
    expect(claimSentence(claimSummary(idrFlagsData(FLAGS))))
      .toBe('This will claim 4 flags across 2 sites. Total: 420 SF 4", 20.25 SF 7" as 4", 180 SF 7".')
    expect(claimSentence(claimSummary(idrFlagsData([idrFlag()])))).toBe('This will claim 1 flag across 1 site. Total: 50 SF 4".')
    expect(claimSentence(claimSummary(idrFlagsData([])))).toBe('No flags are attributed to this IDR, so approving it claims none.')
  })

  it('says what un-approving releases', () => {
    expect(releaseSentence(18)).toBe('This will release 18 flags back to the pool.')
    expect(releaseSentence(1)).toBe('This will release 1 flag back to the pool.')
    expect(releaseSentence(0)).toBe('It has claimed no flags, so none are released.')
  })
})
