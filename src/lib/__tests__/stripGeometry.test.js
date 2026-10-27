import { describe, it, expect } from 'vitest'
import { flagsToFlip, outsideFlags, overlapArea, stripFrontageFt, stripProblem, triangles } from '../stripGeometry'

// The backend's own cases (tests/test_property_line.py): 16 px/ft, 5 x 5 ft flags (80 px square)
const SCALE = 16
const STRIP = [{ x: 300, y: 250 }, { x: 460, y: 250 }, { x: 460, y: 450 }, { x: 300, y: 450 }]
const flag = (id, x, y, extra = {}) => ({ id, shape: 'rectangle', dimensions: { L: 5, W: 5 }, sketch_x: x, sketch_y: y,
  rotation: 0, surveyed_is_assessable: true, claimed_by_idr_id: null, ...extra })

describe('overlapArea', () => {
  it('measures the overlap of two squares', () => {
    const a = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
    const b = [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }]
    expect(overlapArea(a, b)).toBeCloseTo(25)
  })

  it('cuts a concave container exactly', () => {
    const u = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 0, y: 5 }]
    expect(triangles(u).length).toBe(6)
    const inNotch = [{ x: 2.5, y: 0.5 }, { x: 3.5, y: 0.5 }, { x: 3.5, y: 1.5 }, { x: 2.5, y: 1.5 }]
    expect(overlapArea(inNotch, u)).toBeCloseTo(0)
  })
})

describe('outsideFlags', () => {
  it('finds only the flags wholly outside', () => {
    const flags = [flag('inside', 400, 300), flag('crossing', 450, 450), flag('outside', 700, 300), flag('touching', 500, 300)]
    expect(outsideFlags(STRIP, flags, SCALE).map(f => f.id)).toEqual(['outside', 'touching'])
  })

  it("leaves out a flag without a place, and nothing without a scale or 3 points", () => {
    expect(outsideFlags(STRIP, [flag('x', null, null)], SCALE)).toEqual([])
    expect(outsideFlags(STRIP, [flag('x', 700, 300)], null)).toEqual([])
    expect(outsideFlags(STRIP.slice(0, 2), [flag('x', 700, 300)], SCALE)).toEqual([])
  })

  it('would flip only the assessable, unclaimed ones', () => {
    const flags = [flag('a', 700, 300), flag('b', 900, 300, { claimed_by_idr_id: 'idr' }),
      flag('c', 1100, 300, { surveyed_is_assessable: false })]
    expect(flagsToFlip(STRIP, flags, SCALE).map(f => f.id)).toEqual(['a'])
  })
})

describe('stripFrontageFt', () => {
  it('is the first edge at the scale', () => {
    expect(stripFrontageFt(STRIP, SCALE)).toBe(10)
    expect(stripFrontageFt([{ x: 0, y: 0 }, { x: 30, y: 40 }, { x: 0, y: 40 }], 2)).toBe(25)
    expect(stripFrontageFt(STRIP, null)).toBe(null)
  })
})

describe('stripProblem', () => {
  it('passes a simple polygon', () => {
    expect(stripProblem(STRIP)).toBe(null)
  })

  it.each([
    [[{ x: 0, y: 0 }, { x: 1, y: 1 }], 'A sidewalk strip has 3 to 200 points'],
    [[{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }], "A sidewalk strip's first edge, the property line, has no length"],
    [[{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], 'A sidewalk strip must enclose some area'],
    [[{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 50 }], "A sidewalk strip's edges must not cross"],
  ])('refuses %j', (points, problem) => {
    expect(stripProblem(points)).toBe(problem)
  })
})
