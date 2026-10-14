import { describe, it, expect } from 'vitest'
import { boundsOf, flagOutline, shapeOutline, svgPoints } from '../flagGeometry'
import { distanceBetween, toNativeCoords } from '../pageGeometry'
import { DEFAULT_DIMENSIONS, newFlagValues, nextDisplayOrder, thicknessColor } from '../flags'
import { computeArea, polygonArea } from '../flagArea'

const close = (point, x, y) => {
  expect(point.x).toBeCloseTo(x, 6)
  expect(point.y).toBeCloseTo(y, 6)
}

describe('toNativeCoords', () => {
  const PAGE = { width_px: 1200, height_px: 800 }

  it('maps the corners of an upright page shown at half size', () => {
    const rect = { left: 100, top: 50, width: 600, height: 400 }
    const page = { ...PAGE, rotation_deg: 0 }
    close(toNativeCoords({ clientX: 100, clientY: 50 }, rect, page), 0, 0)
    close(toNativeCoords({ clientX: 700, clientY: 450 }, rect, page), 1200, 800)
    close(toNativeCoords({ clientX: 400, clientY: 250 }, rect, page), 600, 400)
  })

  // The page's native top-left corner (0, 0) and bottom-right corner (width, height), as seen on screen once the page
  // is turned clockwise; the box is the rotated page at half size, at the screen's origin
  it.each([
    [90, { width: 400, height: 600 }, [400, 0], [0, 600]],
    [180, { width: 600, height: 400 }, [600, 400], [0, 0]],
    [270, { width: 400, height: 600 }, [0, 600], [400, 0]],
  ])('undoes a %i° turn', (rotation, size, topLeft, bottomRight) => {
    const rect = { left: 0, top: 0, ...size }
    const page = { ...PAGE, rotation_deg: rotation }
    close(toNativeCoords({ clientX: topLeft[0], clientY: topLeft[1] }, rect, page), 0, 0)
    close(toNativeCoords({ clientX: bottomRight[0], clientY: bottomRight[1] }, rect, page), 1200, 800)
  })

  it('measures distances', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 30, y: 40 })).toBe(50)
  })
})

describe('shape outlines', () => {
  it('encloses the area the backend computes, for every default shape', () => {
    for (const [shape, dimensions] of Object.entries(DEFAULT_DIMENSIONS)) {
      const enclosed = polygonArea(shapeOutline(shape, dimensions))
      // The arc's curve is sampled, so it falls a little short of the true segment
      expect(enclosed).toBeCloseTo(computeArea(shape, dimensions), shape === 'arc' ? 0 : 6)
    }
  })

  it('draws a trapezoid with a on top and b on the bottom, centred', () => {
    expect(shapeOutline('trapezoid', { a: 2, b: 6, w: 3 })).toEqual([{ x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 3 }, { x: 0, y: 3 }])
  })

  it('gives nothing for an unknown shape or no dimensions', () => {
    expect(shapeOutline('hexagon', {})).toEqual([])
    expect(shapeOutline('rectangle', null)).toEqual([])
  })
})

describe('flagOutline', () => {
  const FLAG = { shape: 'rectangle', dimensions: { L: 4, W: 2 }, sketch_x: 100, sketch_y: 200, rotation: 0 }

  it('centres the shape on its place, in page pixels at the page\'s scale', () => {
    const points = flagOutline(FLAG, 10)
    expect(boundsOf(points)).toEqual({ minX: 80, minY: 190, maxX: 120, maxY: 210 })
  })

  it('turns the shape about its place', () => {
    const box = boundsOf(flagOutline({ ...FLAG, rotation: 90 }, 10))
    expect(box.minX).toBeCloseTo(90)
    expect(box.maxX).toBeCloseTo(110)
    expect(box.minY).toBeCloseTo(180)
    expect(box.maxY).toBeCloseTo(220)
  })

  it('draws at a stand-in place during a drag', () => {
    expect(boundsOf(flagOutline(FLAG, 10, { x: 0, y: 0 }))).toEqual({ minX: -20, minY: -10, maxX: 20, maxY: 10 })
  })

  it('draws nothing without a scale or a place', () => {
    expect(flagOutline(FLAG, null)).toEqual([])
    expect(flagOutline({ ...FLAG, sketch_x: null }, 10)).toEqual([])
  })

  it('prints SVG points', () => {
    expect(svgPoints([{ x: 1, y: 2.345 }, { x: 3, y: 4 }])).toBe('1.00,2.35 3.00,4.00')
  })
})

describe('a new flag', () => {
  it('starts one past the highest display order, centred on the click, number only, assessable, 4"', () => {
    expect(nextDisplayOrder([])).toBe(1)
    expect(newFlagValues('rectangle', { x: 10.123, y: 20 }, [{ display_order: 3 }, { display_order: 7 }])).toEqual({
      display_order: 8, shape: 'rectangle', dimensions: { L: 5, W: 5 }, sketch_x: 10.12, sketch_y: 20, rotation: 0,
      surveyed_mark: 'number_only', surveyed_is_assessable: true, surveyed_thickness: '4in', added_in_field: false,
    })
  })

  it('colours a flag by its thickness, grey for an unknown one', () => {
    expect(thicknessColor('4in')).toBe('#2563eb')
    expect(thicknessColor('9in')).toBe('#6b7280')
  })
})
