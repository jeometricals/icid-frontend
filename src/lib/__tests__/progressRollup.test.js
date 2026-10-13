import { describe, it, expect } from 'vitest'
import { formatQuantity, rollupByItem } from '../progressRollup'

const row = (pay_item_ref, budget_code, unit, amount, description = `Item ${pay_item_ref}`) => (
  { pay_item_ref, budget_code, unit, amount, description }
)

describe('rollupByItem', () => {
  it('sums the amounts of rows with the same item number, budget code and unit', () => {
    expect(rollupByItem([
      row('4.13 AAS', 'BC-1', 'SF', 120),
      row('4.13 AAS', 'BC-1', 'SF', 80.5),
      row('4.13 AAS', 'BC-1', 'SF', -0.5),
    ])).toEqual([
      { pay_item_ref: '4.13 AAS', description: 'Item 4.13 AAS', budget_code: 'BC-1', unit: 'SF', total_qty: 200 },
    ])
  })

  it('keeps apart rows that differ in budget code or in unit', () => {
    const items = rollupByItem([
      row('4.13', 'BC-1', 'SF', 10),
      row('4.13', 'BC-2', 'SF', 20),
      row('4.13', 'BC-1', 'SY', 30),
      row('4.13', null, 'SF', 40),
    ])
    expect(items.map(item => [item.budget_code, item.unit, item.total_qty])).toEqual([
      [null, 'SF', 40], ['BC-1', 'SF', 10], ['BC-1', 'SY', 30], ['BC-2', 'SF', 20],
    ])
  })

  it('takes the first description a group has, skipping blanks', () => {
    const [item] = rollupByItem([
      row('6.02', 'BC-1', 'LF', 1, null),
      row('6.02', 'BC-1', 'LF', 2, 'Steel faced curb'),
      row('6.02', 'BC-1', 'LF', 3, 'Curb, steel faced (reworded)'),
    ])
    expect(item).toMatchObject({ description: 'Steel faced curb', total_qty: 6 })
  })

  it('keeps items without a number apart by their description', () => {
    expect(rollupByItem([
      row(null, null, 'EA', 2, 'Tree guard'),
      row(null, null, 'EA', 5, 'Bollard'),
      row(null, null, 'EA', 1, 'Tree guard'),
    ])).toEqual([
      { pay_item_ref: null, description: 'Bollard', budget_code: null, unit: 'EA', total_qty: 5 },
      { pay_item_ref: null, description: 'Tree guard', budget_code: null, unit: 'EA', total_qty: 3 },
    ])
  })

  it('does not let a description split a numbered item', () => {
    expect(rollupByItem([row('4.13', 'BC-1', 'SF', 1, 'Sidewalk'), row('4.13', 'BC-1', 'SF', 2, '4" sidewalk')]))
      .toHaveLength(1)
  })

  it('sorts by item number as numbers, with items that have none last', () => {
    const items = rollupByItem([
      row(null, 'BC-9', 'EA', 1, 'Added by description'),
      row('10.02', 'BC-1', 'TN', 1),
      row('4.13 AAS', 'BC-1', 'SF', 1),
      row('4.02', 'BC-1', 'CY', 1),
      row('', 'BC-9', 'EA', 1, 'Blank number'),
    ])
    expect(items.map(item => item.pay_item_ref)).toEqual(['4.02', '4.13 AAS', '10.02', null, null])
    expect(items.slice(3).map(item => item.description)).toEqual(['Added by description', 'Blank number'])
  })

  it('leaves no float dust in a total', () => {
    expect(rollupByItem([row('1', 'B', 'TN', 0.1), row('1', 'B', 'TN', 0.2)])[0].total_qty).toBe(0.3)
  })

  it('gives an empty list for no rows', () => {
    expect(rollupByItem([])).toEqual([])
  })
})

describe('formatQuantity', () => {
  it('separates thousands and keeps three decimals at most', () => {
    expect(formatQuantity(1234567.5)).toBe('1,234,567.5')
    expect(formatQuantity(0.1 + 0.2)).toBe('0.3')
    expect(formatQuantity(171)).toBe('171')
    expect(formatQuantity(-12.3456)).toBe('-12.346')
  })
})
