import { describe, it, expect } from 'vitest'
import { computeArea, degreesToRadians, formatArea, polygonArea, radiansToDegrees } from '../flagArea'
import {
  FLAG_MARKS, FLAG_NON_ASSESSABLE_REASONS, FLAG_SHAPES, FLAG_THICKNESSES, markLabel, nonAssessableReasonLabel,
  shapeLabel, thicknessLabel,
} from '../../data/flagEnums'

describe('computeArea', () => {
  it.each([
    ['rectangle', { L: 8.5, W: 5 }, 42.5],
    ['trapezoid', { a: 4, b: 6, w: 3 }, 15],
    ['triangle', { a: 3, b: 4 }, 6],
    ['polygon', { vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] }, 12],
    // A half circle of radius 2: r² / 2 × (π − sin π) = 2π
    ['arc', { r: 2, theta: Math.PI }, 6.28],
  ])('works out a %s as the backend does', (shape, dimensions, area) => {
    expect(computeArea(shape, dimensions)).toBe(area)
  })

  it('rounds to the cent of a square foot', () => {
    expect(computeArea('rectangle', { L: 1.005, W: 1 })).toBe(1.01)
    expect(computeArea('triangle', { a: 1, b: 1 / 3 })).toBe(0.17)
  })

  it('knows no other shape', () => {
    expect(computeArea('hexagon', {})).toBeNull()
  })

  it('takes a polygon\'s vertices either way round, and none for a degenerate one', () => {
    const square = [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 0 }]
    expect(polygonArea(square)).toBe(4)
    expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])).toBe(0)
  })
})

describe('angles and areas', () => {
  it('turns degrees to radians and back', () => {
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI)
    expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90)
  })

  it('prints an area with two decimals and SF', () => {
    expect(formatArea(42.5)).toBe('42.50 SF')
    expect(formatArea(1042.5)).toBe('1,042.50 SF')
  })
})

describe('flag enum labels', () => {
  it('lists the backend\'s values', () => {
    expect(FLAG_SHAPES.map(entry => entry.value)).toEqual(['rectangle', 'trapezoid', 'triangle', 'polygon', 'arc'])
    expect(FLAG_MARKS.map(entry => entry.value)).toEqual(['number_only', 'cross', 'cross_with_number', 'tick', 'none'])
    expect(FLAG_NON_ASSESSABLE_REASONS).toHaveLength(9)
    expect(FLAG_THICKNESSES.map(entry => entry.value)).toEqual(['4in', '7in_as_4in', '7in'])
  })

  it('gives each value its words, and an unknown one as stored', () => {
    expect(shapeLabel('triangle')).toBe('Right triangle')
    expect(markLabel('cross_with_number')).toBe('Cross + number')
    expect(nonAssessableReasonLabel('city_tree')).toBe('City tree')
    expect(thicknessLabel('7in_as_4in')).toBe('7" as 4"')
    expect(markLabel('smudge')).toBe('smudge')
  })
})
