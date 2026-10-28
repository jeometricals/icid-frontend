import { describe, it, expect } from 'vitest'
import {
  COEF_TABLE, CORRECTION_TOO_LARGE_MESSAGE, RATIO_RANGE_MESSAGE, checkCornerQuadrant, cornerQuadrant,
  cornerQuadrantOutline, hundredths,
} from '../cornerQuadrant'
import { computeArea } from '../flagArea'
import { shapeOutline } from '../flagGeometry'

// BLK_13136_LOT_133 sheet 2: the OE sheet's worked example
const OE = { H: 5.66, C: 18, R1: 12.58, R2: 12, A: 4.83, B: 3.83 }

describe('the corner-quadrant formula (Slice Y5)', () => {
  it("works the OE sheet's example out to 129.87, its rows cut to the cent", () => {
    const worked = cornerQuadrant(OE)
    expect([worked.ratio, worked.coef, worked.area]).toEqual([0.31, 0.7154, 129.87])
    expect(worked.rows).toEqual({ arc: 72.88, triangle: 75.48, correction: 18.49 })
    expect(computeArea('corner_quadrant', OE)).toBe(129.87)
  })

  it.each([[0.18, 18, 0.01, 0.6667], [9, 18, 0.5, 0.7854]])('reaches the table at H %s C %s', (H, C, ratio, coef) => {
    const worked = cornerQuadrant({ ...OE, H, C })
    expect([worked.ratio, worked.coef]).toEqual([ratio, coef])
  })

  it.each([[0.01, 100], [10, 18]])('refuses H %s over C %s, off the table', (H, C) => {
    expect(cornerQuadrant({ ...OE, H, C })).toEqual({ error: RATIO_RANGE_MESSAGE })
  })

  it('rounds H / C halves up, with no interpolation', () => {
    expect(cornerQuadrant({ ...OE, H: 2.25, C: 18 }).ratio).toBe(0.13) // 0.125
  })

  it('takes no correction as 0 and 0, and refuses one larger than the arc and triangle', () => {
    expect(cornerQuadrant({ ...OE, A: 0, B: 0 }).area).toBe(148.36)
    expect(cornerQuadrant({ ...OE, A: 20, B: 10 })).toEqual({ error: CORRECTION_TOO_LARGE_MESSAGE })
  })

  it('has the OE table: fifty coefficients, rising, from 2/3 to pi/4', () => {
    expect(COEF_TABLE).toHaveLength(50)
    expect(COEF_TABLE.every((coef, index) => index === 0 || coef > COEF_TABLE[index - 1])).toBe(true)
    expect([COEF_TABLE[0], COEF_TABLE[30], COEF_TABLE[49]]).toEqual([0.6667, 0.7154, 0.7854])
  })

  it.each([['5.66', 566], ['18', 1800], ['.5', 50], ['5.666', null], ['-1', null], ['0', null], ['', null], ['x', null]])(
    'reads %j as %s hundredths', (typed, value) => {
      expect(hundredths(typed)).toBe(value)
    })

  it('lets A and B be 0', () => {
    expect(hundredths('0', true)).toBe(0)
    const { problems, worked } = checkCornerQuadrant({ H: '5.66', C: '18', R1: '12.58', R2: '12', A: '0', B: '0' })
    expect(problems).toEqual({})
    expect(worked.area).toBe(148.36)
  })

  it('names each input that is wrong', () => {
    const { problems, worked } = checkCornerQuadrant({ H: '', C: '18', R1: '12.585', R2: '12', A: '-1', B: '3.83' })
    expect(problems).toEqual({ H: 'Above 0, at most two decimal places.', R1: 'Above 0, at most two decimal places.',
      A: '0 or more, at most two decimal places.' })
    expect(worked).toBeNull()
  })
})

describe('the corner-quadrant outline (Slice Y5)', () => {
  it('puts the right angle at the bottom left with the A × B notch cut from it, as the backend draws it', () => {
    const points = cornerQuadrantOutline(OE)
    expect(points.slice(0, 5)).toEqual([
      { x: 0, y: 0 }, { x: 0, y: 12 - 3.83 }, { x: 4.83, y: 12 - 3.83 }, { x: 4.83, y: 12 }, { x: 12.58, y: 12 }])
    expect(points).toHaveLength(36)
    expect(shapeOutline('corner_quadrant', OE)).toEqual(points)
  })

  it('bulges H out of the hypotenuse, away from the right angle', () => {
    const chord = Math.hypot(12.58, 12)
    const side = ({ x, y }) => (12 * x - 12.58 * y) / chord
    const arc = cornerQuadrantOutline(OE).slice(5)
    expect(arc.every(point => side(point) > 0)).toBe(true)
    expect(Math.max(...arc.map(side))).toBeCloseTo(5.66, 2)
  })

  it('has no notch without a correction', () => {
    expect(cornerQuadrantOutline({ ...OE, A: 0, B: 0 }).slice(0, 3)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 12 }, { x: 12.58, y: 12 }])
  })
})
