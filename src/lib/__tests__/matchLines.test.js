import { describe, it, expect } from 'vitest'
import { captionPlacement, matchLineCaption, partnerOf } from '../matchLines'

const line = (id, pageId, pageNumber, label) => ({ match_line_id: id, pir_page_id: pageId, page_number: pageNumber, label })
const A1 = line('a1', 'p1', 1, 'A')
const A2 = line('a2', 'p2', 2, 'A')
const B1 = line('b1', 'p1', 1, 'B')

describe('match lines (Slice Y4b)', () => {
  it("finds a line's partner: the same label on another page", () => {
    expect(partnerOf(A1, [A1, A2, B1])).toBe(A2)
    expect(partnerOf(A2, [A1, A2, B1])).toBe(A1)
  })

  it('has no partner for a label on one page only', () => {
    expect(partnerOf(B1, [A1, A2, B1])).toBeNull()
  })

  it('captions a line with its partner page, else with its label alone', () => {
    expect(matchLineCaption(A1, A2)).toBe('MATCH LINE "A" — SEE PAGE 2')
    expect(matchLineCaption(B1, null)).toBe('MATCH LINE "B"')
  })
})

describe('captionPlacement (pilot sweep #2)', () => {
  const CAPTION = 'MATCH LINE "A" — SEE PAGE 2'
  const PAGE = { width_px: 1275, height_px: 1650, rotation_deg: 0 }
  // The caption's angle as the page shows it, in (-180, 180]
  const shown = (placed, page) => {
    const turned = (((placed.angle + (page.rotation_deg ?? 0)) % 360) + 360) % 360
    return turned > 180 ? turned - 360 : turned
  }

  it("turns a vertical line's caption to read bottom to top, whichever way the line was drawn or leans", () => {
    for (const drawn of [{ x1: 600, y1: 200, x2: 600, y2: 900 }, { x1: 600, y1: 900, x2: 600, y2: 200 },
      { x1: 600, y1: 200, x2: 620, y2: 900 }, { x1: 620, y1: 900, x2: 600, y2: 200 }]) {
      const angle = shown(captionPlacement(drawn, CAPTION, PAGE, 20, 30), PAGE)
      expect(angle).toBeGreaterThan(-100)
      expect(angle).toBeLessThan(-80)
    }
  })

  it('reads any other left to right along its slope', () => {
    for (const drawn of [{ x1: 100, y1: 500, x2: 900, y2: 500 }, { x1: 900, y1: 500, x2: 100, y2: 500 },
      { x1: 100, y1: 500, x2: 900, y2: 560 }]) {
      const angle = shown(captionPlacement(drawn, CAPTION, PAGE, 20, 30), PAGE)
      expect(Math.abs(angle)).toBeLessThan(10)
    }
  })

  it('judges vertical as the page shows it, its rotation applied', () => {
    const turned = { ...PAGE, rotation_deg: 90 }
    // Drawn across the native page, it stands upright once the page is turned a quarter
    const across = captionPlacement({ x1: 100, y1: 500, x2: 900, y2: 500 }, CAPTION, turned, 20, 30)
    expect(Math.round(shown(across, turned))).toBe(-90)
    const upright = captionPlacement({ x1: 600, y1: 200, x2: 600, y2: 900 }, CAPTION, turned, 20, 30)
    expect(Math.round(shown(upright, turned))).toBe(0)
  })

  it('slides the caption along its line to stay on the page', () => {
    // A short vertical line at the top: the caption, longer than it, would run off the page's top edge
    const placed = captionPlacement({ x1: 600, y1: 5, x2: 600, y2: 60 }, CAPTION, PAGE, 20, 30)
    const half = (CAPTION.length * 0.6 * placed.fontSize) / 2
    expect(placed.fontSize).toBe(20)
    expect(placed.y - half).toBeGreaterThanOrEqual(0)
    expect(placed.y + half).toBeLessThanOrEqual(PAGE.height_px)
    // and a horizontal one at the right edge
    const right = captionPlacement({ x1: 1200, y1: 500, x2: 1270, y2: 500 }, CAPTION, PAGE, 20, 30)
    expect(right.x + (CAPTION.length * 0.6 * 20) / 2).toBeLessThanOrEqual(PAGE.width_px)
  })

  it('shrinks a caption longer than the page is across', () => {
    const narrow = { width_px: 200, height_px: 1650, rotation_deg: 0 }
    const placed = captionPlacement({ x1: 10, y1: 500, x2: 190, y2: 500 }, CAPTION, narrow, 20, 30)
    const half = (CAPTION.length * 0.6 * placed.fontSize) / 2
    expect(placed.fontSize).toBeLessThan(20)
    expect(placed.x - half).toBeGreaterThanOrEqual(0)
    expect(placed.x + half).toBeLessThanOrEqual(200)
  })
})
