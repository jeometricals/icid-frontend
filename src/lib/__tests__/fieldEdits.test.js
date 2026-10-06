import { describe, it, expect } from 'vitest'
import {
  displayValue, editsForField, hasEdits, isPayItemTouched, payItemAddEdit, payItemAttestations, payItemPath,
  reviewStage, revisedAfterReturn, sameValue, stageAcceptedTimes, untouchedPayItems,
} from '../fieldEdits'

const edit = (overrides) => ({ edit_id: 'e', report_id: 'rep-1', field_path: 'description', edit_type: 'field_change',
  old_value: 'a', new_value: 'b', ...overrides })

describe('editsForField', () => {
  const edits = [
    edit({ edit_id: '1' }), edit({ edit_id: '2', field_path: 'comments' }), edit({ edit_id: '3', report_id: 'rep-2' }),
    edit({ edit_id: '4', report_id: null, field_path: 'header.weather_am' }), edit({ edit_id: '5' }),
  ]

  it("picks one field's edits on one report, in the order given", () => {
    expect(editsForField(edits, 'rep-1', 'description').map(e => e.edit_id)).toEqual(['1', '5'])
  })

  it('finds a header field with no report, whether that is null or left out', () => {
    expect(editsForField(edits, null, 'header.weather_am').map(e => e.edit_id)).toEqual(['4'])
    expect(editsForField(edits, undefined, 'header.weather_am')).toHaveLength(1)
  })

  it('is empty for no edits at all', () => {
    expect(editsForField(undefined, 'rep-1', 'description')).toEqual([])
    expect(editsForField([], 'rep-1', 'description')).toEqual([])
  })
})

describe('pay item paths', () => {
  it("names a pay item's field, or the item itself, by its id", () => {
    expect(payItemPath('item-1', 'payQuantity')).toBe('payItems[item-1].payQuantity')
    expect(payItemPath('item-1')).toBe('payItems[item-1]')
  })

  it('finds the edit that added an item, and nothing for an item the inspector entered', () => {
    const added = edit({ edit_id: 'add', field_path: 'payItems[item-3]', edit_type: 'pay_item_add', old_value: null })
    const edits = [edit({ field_path: 'payItems[item-1].payQuantity', edit_type: 'pay_item_revision' }), added]
    expect(payItemAddEdit(edits, 'rep-1', 'item-3')).toBe(added)
    expect(payItemAddEdit(edits, 'rep-1', 'item-1')).toBeUndefined()
    expect(payItemAddEdit(edits, 'rep-2', 'item-3')).toBeUndefined()
  })
})

describe('hasEdits', () => {
  it('tells whether a report (or the header) was edited at all', () => {
    const edits = [edit({ report_id: 'rep-1' }), edit({ report_id: null })]
    expect(hasEdits(edits, 'rep-1')).toBe(true)
    expect(hasEdits(edits, null)).toBe(true)
    expect(hasEdits(edits, 'rep-2')).toBe(false)
    expect(hasEdits(undefined, 'rep-1')).toBe(false)
  })
})

describe('displayValue', () => {
  it.each([[null, '(blank)'], [undefined, '(blank)'], ['', '(blank)'], [true, 'Yes'], [false, 'No'], [0, '0'],
    ['60.00', '60.00'], [74.5, '74.5']])('reads %j as "%s"', (value, text) => {
    expect(displayValue(value)).toBe(text)
  })
})

describe('sameValue', () => {
  it.each([
    ['a', 'a', true], ['a', 'b', false], [null, '', true], [undefined, null, true], ['', '0', false],
    ['78', 78.0, true], ['55', '55.00', true], [80, '80', true], ['60.00', '55.00', false],
    [true, true, true], [true, 'true', false], [false, '', false], ['07:30', '07:30:00', false],
  ])('%j and %j: %s', (a, b, same) => {
    expect(sameValue(a, b)).toBe(same)
  })
})

describe('revisedAfterReturn', () => {
  const chain = [edit({ old_value: '2', new_value: '3' }), edit({ old_value: '3', new_value: '4' })]

  it('is false while the field still holds its last edit', () => {
    expect(revisedAfterReturn('4', chain)).toBe(false)
    expect(revisedAfterReturn(4, chain)).toBe(false)
  })

  it('is true once the value has moved on, to anything, an earlier value included', () => {
    expect(revisedAfterReturn('5', chain)).toBe(true)
    expect(revisedAfterReturn('3', chain)).toBe(true)
    expect(revisedAfterReturn('', chain)).toBe(true)
  })

  it('is false for a field nobody edited', () => {
    expect(revisedAfterReturn('5', [])).toBe(false)
    expect(revisedAfterReturn('5', undefined)).toBe(false)
  })

  it('compares through the format it is given', () => {
    const times = [edit({ old_value: '07:00:00', new_value: '07:30:00' })]
    expect(revisedAfterReturn('07:30', times)).toBe(true)
    expect(revisedAfterReturn('07:30', times, v => (v ? String(v).slice(0, 5) : v))).toBe(false)
  })
})

describe('pay-item attestation', () => {
  const ME = 'user-me'
  const OTHER = 'user-other'
  const ITEM = { id: 'item-1', itemNo: '4.13 AAS', payQuantity: '60.00' }
  const who = { userUuid: ME, stage: 'stage1' }
  const by = (overrides) => edit({ field_path: 'payItems[item-1]', edit_type: 'pay_item_approve', old_value: '60.00',
    new_value: '60.00', editor_uuid: ME, editor_stage: 'stage1', ...overrides })
  const revision = (overrides) => by({ field_path: 'payItems[item-1].payQuantity', edit_type: 'pay_item_revision',
    old_value: '70.00', ...overrides })
  const added = (overrides) => by({ edit_type: 'pay_item_add', old_value: null, new_value: { ...ITEM }, ...overrides })

  it('names the stage an IDR in review is at', () => {
    expect(reviewStage('stage1_review')).toBe('stage1')
    expect(reviewStage('stage2_review')).toBe('stage2')
    expect(reviewStage('approved')).toBeNull()
  })

  it('lists an item\'s approvals, quantity revisions and its add, and nothing else', () => {
    const edits = [
      added({ edit_id: 'a' }), revision({ edit_id: 'r' }), by({ edit_id: 'p' }),
      by({ edit_id: 'x', field_path: 'payItems[item-1].budgetCode', edit_type: 'field_change' }),
      by({ edit_id: 'y', field_path: 'payItems[item-2]' }), by({ edit_id: 'z', report_id: 'rep-2' }),
    ]
    expect(payItemAttestations(edits, 'rep-1', ITEM).map(a => a.edit.edit_id)).toEqual(['a', 'r', 'p'])
  })

  it('marks an attestation to a quantity the item no longer has as not current', () => {
    const edits = [by({ edit_id: 'old', new_value: '55.00' }), by({ edit_id: 'now', new_value: '60' })]
    expect(payItemAttestations(edits, 'rep-1', ITEM).map(a => a.current)).toEqual([false, true])
  })

  it.each([
    ['their approval', [by({})]],
    ['their revision to the quantity it has now', [revision({})]],
    ['their adding it', [added({})]],
  ])('counts an item as touched by %s', (_, edits) => {
    expect(isPayItemTouched(edits, 'rep-1', ITEM, who)).toBe(true)
  })

  it.each([
    ['no edits', []],
    ['someone else\'s approval', [by({ editor_uuid: OTHER })]],
    ['their approval at the other stage', [by({ editor_stage: 'stage2' })]],
    ['their approval of a quantity since changed', [by({ new_value: '55.00' })]],
    ['their revision, revised again by someone else', [revision({ new_value: '58.00' })]],
    ['their approval on another report', [by({ report_id: 'rep-2' })]],
  ])('does not count %s', (_, edits) => {
    expect(isPayItemTouched(edits, 'rep-1', ITEM, who)).toBe(false)
  })

  it('reads when each stage was last accepted off the IDR', () => {
    expect(stageAcceptedTimes({ stage1_accepted_at: '2026-10-05T14:00:00Z', stage2_accepted_at: null })).toEqual({
      stage1: '2026-10-05T14:00:00Z', stage2: null,
    })
    expect(stageAcceptedTimes({})).toEqual({ stage1: null, stage2: null })
    expect(stageAcceptedTimes(null)).toEqual({ stage1: null, stage2: null })
  })

  describe('rounds', () => {
    const ACCEPTED = '2026-10-05T14:00:00Z'
    const round = { ...who, acceptedAt: { stage1: ACCEPTED, stage2: null } }

    it.each([
      ['an approval', by({ edited_at: '2026-10-05T13:59:59Z' })],
      ['a revision', revision({ edited_at: '2026-10-01T09:00:00Z' })],
      ['an add', added({ edited_at: '2026-10-01T09:00:00Z' })],
    ])('does not count %s from before the stage was last accepted', (_, earlier) => {
      expect(isPayItemTouched([earlier], 'rep-1', ITEM, round)).toBe(false)
    })

    it('counts one made at the moment of accepting, or after', () => {
      expect(isPayItemTouched([by({ edited_at: ACCEPTED })], 'rep-1', ITEM, round)).toBe(true)
      expect(isPayItemTouched([by({ edited_at: '2026-10-05T14:00:01Z' })], 'rep-1', ITEM, round)).toBe(true)
    })

    it('compares moments, not text: the two times may be written differently', () => {
      const offset = { ...round, acceptedAt: { stage1: '2026-10-05T10:00:00-04:00', stage2: null } }
      expect(isPayItemTouched([by({ edited_at: '2026-10-05T14:00:00.250000Z' })], 'rep-1', ITEM, offset)).toBe(true)
      expect(isPayItemTouched([by({ edited_at: '2026-10-05T13:59:00+00:00' })], 'rep-1', ITEM, offset)).toBe(false)
    })

    it('counts every attestation at a stage whose accepted time is not known', () => {
      const unknown = { ...who, acceptedAt: { stage1: null, stage2: null } }
      expect(isPayItemTouched([by({ edited_at: '2020-01-01T00:00:00Z' })], 'rep-1', ITEM, unknown)).toBe(true)
      expect(isPayItemTouched([by({ edited_at: '2020-01-01T00:00:00Z' })], 'rep-1', ITEM, who)).toBe(true)
    })

    it('still drops an approval of a quantity the item no longer has, round or no round', () => {
      const inRound = by({ edited_at: '2026-10-05T15:00:00Z', new_value: '55.00' })
      expect(isPayItemTouched([inRound], 'rep-1', ITEM, round)).toBe(false)
      expect(isPayItemTouched([inRound], 'rep-1', ITEM, { ...who, acceptedAt: { stage1: null, stage2: null } })).toBe(false)
    })

    it('judges each edit by its own stage\'s accepted time', () => {
      const acceptedAt = { stage1: '2026-10-01T00:00:00Z', stage2: '2026-10-06T00:00:00Z' }
      const edits = [
        by({ edit_id: 's1', edited_at: '2026-10-02T00:00:00Z' }),
        by({ edit_id: 's2-old', editor_stage: 'stage2', edited_at: '2026-10-03T00:00:00Z' }),
        by({ edit_id: 's2-new', editor_stage: 'stage2', edited_at: '2026-10-06T09:00:00Z' }),
      ]
      expect(payItemAttestations(edits, 'rep-1', ITEM, acceptedAt).map(a => [a.edit.edit_id, a.current])).toEqual([
        ['s1', true], ['s2-old', false], ['s2-new', true],
      ])
    })
  })

  it('lists the untouched items of every report but an auto-generated General, in order', () => {
    const reports = [
      { report_id: 'rep-auto', is_auto_generated: true, report_data: { payItems: [{ id: 'auto-1', payQuantity: '1' }] } },
      { report_id: 'rep-1', is_auto_generated: false, report_data: { payItems: [ITEM, { id: 'item-2', payQuantity: '5' }, { itemNo: 'no id' }] } },
      { report_id: 'rep-2', is_auto_generated: false, report_data: { payItems: [{ id: 'item-3', payQuantity: '9' }] } },
      { report_id: 'rep-mix', is_auto_generated: false, report_data: {} },
    ]
    expect(untouchedPayItems(reports, [by({})], who)).toEqual([
      { pay_item_id: 'item-2', report_id: 'rep-1' }, { pay_item_id: 'item-3', report_id: 'rep-2' },
    ])
    expect(untouchedPayItems(undefined, [], who)).toEqual([])
  })
})
