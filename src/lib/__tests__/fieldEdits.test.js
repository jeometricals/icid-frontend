import { describe, it, expect } from 'vitest'
import {
  displayValue, editsForField, hasEdits, payItemAddEdit, payItemPath, revisedAfterReturn, sameValue,
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
