import { describe, it, expect } from 'vitest'
import { matchLineCaption, partnerOf } from '../matchLines'

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
