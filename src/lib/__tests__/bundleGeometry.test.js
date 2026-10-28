import { describe, it, expect } from 'vitest'
import {
  abut, bundleNumbers, bundleProblem, classificationKey, outerArea, rectanglesProblem, unconnected,
} from '../bundleGeometry'
import { isLinearFoot, mostUsedLfItem } from '../segmentItems'

// A 5 x 5 ft 4in assessable flag centred at (x, y) on a 10 px/ft page
const flag = (n, x, extra = {}) => ({
  id: `f${n}`, display_order: n, shape: 'rectangle', dimensions: { L: 5, W: 5 }, sketch_x: x, sketch_y: 100,
  rotation: 0, surveyed_thickness: '4in', surveyed_is_assessable: true, pay_item_id: null, ...extra,
})
const SCALE = 10
const A = flag(1, 100)
const B = flag(2, 150) // 50 px = 5 ft to the right: shares A's right edge
const C = flag(3, 200)

describe('bundle geometry (Slice Y4a, the backend route mirrored)', () => {
  it('two outlines abut when an edge runs along an edge, within 0.1 ft', () => {
    const square = (x) => [{ x, y: 0 }, { x: x + 5, y: 0 }, { x: x + 5, y: 5 }, { x, y: 5 }]
    expect(abut(square(0), square(5))).toBe(true)
    expect(abut(square(0), square(5.08))).toBe(true)
    expect(abut(square(0), square(5.2))).toBe(false)
    expect(abut(square(0), [{ x: 5, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 10 }, { x: 5, y: 10 }])).toBe(false) // a corner
  })

  it('a chain reaches flags through each other', () => {
    expect(unconnected([A, C, B], SCALE)).toEqual([])
    expect(unconnected([A, C], SCALE)).toEqual([C])
  })

  it('names what keeps flags from bundling, as the route does, in its order', () => {
    expect(bundleProblem([A], SCALE)).toBe('A bundle takes at least two flags')
    expect(bundleProblem([A, B], null)).toBe("Set this page's scale first")
    expect(bundleProblem([A, { ...B, claimed_by_idr_id: 'i', claimed_by_idr_number: 'Y15' }], SCALE)).toBe('Flag 2 is claimed by IDR Y15')
    expect(bundleProblem([A, { ...B, bundled: true }], SCALE)).toBe('Flag 2 is already in a bundle')
    expect(bundleProblem([A, { ...B, sketch_x: null }], SCALE)).toBe('Flag 2 has no place on the page')
    expect(bundleProblem([A, { ...B, surveyed_thickness: '7in' }], SCALE))
      .toBe('The flags differ in thickness, assessment or pay item: Flag 2 differ from Flag 1')
    expect(bundleProblem([A, C], SCALE)).toBe("Flag 3 doesn't abut the rest")
    expect(bundleProblem([A, B, C], SCALE)).toBeNull()
  })

  it('a classification is thickness, assessment and pay item', () => {
    expect(classificationKey(A)).toBe('4in|true|')
    expect(classificationKey({ ...A, pay_item_id: 'ci' })).not.toBe(classificationKey(A))
  })

  it('an outline is 1 to 3 rectangles, each above 0; its area each to the cent, summed', () => {
    expect(rectanglesProblem([])).toBe('An outline takes 1 to 3 rectangles')
    expect(rectanglesProblem([{ L: 1, W: 1 }, { L: 1, W: 1 }, { L: 1, W: 1 }, { L: 1, W: 1 }])).toBe('An outline takes 1 to 3 rectangles')
    expect(rectanglesProblem([{ L: '10', W: '' }])).toBe('Rectangle A needs a length and a width above 0')
    expect(rectanglesProblem([{ L: '10', W: '5' }])).toBeNull()
    expect(outerArea([{ L: 10, W: 5 }, { L: 2.5, W: 3.3 }, { L: 0.333, W: 1 }])).toBe(58.58)
  })

  it('numbers bundles per PIR by their lowest flag number', () => {
    const flags = [flag(4, 0, { bundled: true, measurement_id: 'm-b' }), flag(2, 0, { bundled: true, measurement_id: 'm-a' }),
      flag(7, 0, { bundled: true, measurement_id: 'm-b' }), flag(1, 0), flag(3, 0, { bundled: false, measurement_id: 'solo' })]
    expect(bundleNumbers(flags)).toEqual({ 'm-a': 1, 'm-b': 2 })
  })
})

describe('curb pay items (Slice Y4a)', () => {
  const items = [{ contract_item_id: 'aa', pay_unit: 'L.F.' }, { contract_item_id: 'gr', pay_unit: 'LF' },
    { contract_item_id: 'sw', pay_unit: 'S.F.' }]

  it('takes the LF items, whatever their spelling', () => {
    expect(items.filter(isLinearFoot).map(item => item.contract_item_id)).toEqual(['aa', 'gr'])
  })

  it("starts from the LF item the PIR's curbs use most, else none", () => {
    const lf = items.filter(isLinearFoot)
    expect(mostUsedLfItem(lf, [{ pay_item_id: 'gr' }, { pay_item_id: 'aa' }, { pay_item_id: 'gr' }, { pay_item_id: 'sw' }])).toBe('gr')
    expect(mostUsedLfItem(lf, [{ pay_item_id: null }])).toBeNull()
  })
})
