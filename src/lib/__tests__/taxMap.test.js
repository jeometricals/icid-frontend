import { describe, it, expect } from 'vitest'
import { frontageText, taxMapSourceLabel } from '../taxMap'

describe('taxMapSourceLabel', () => {
  it.each([
    ['mappluto_26v2', 'MapPLUTO 26v2'], ['mappluto_25v1.1', 'MapPLUTO 25v1.1'], ['manual', 'Manual'],
    ['pip_scrape', 'PIP'], ['r1k', 'R1k'], [null, null], ['', null],
  ])('words %s as %s', (source, label) => {
    expect(taxMapSourceLabel(source)).toBe(label)
  })
})

describe('frontageText', () => {
  it('gives feet to two places, null for none', () => {
    expect(frontageText(16.67)).toBe('16.67 ft')
    expect(frontageText(25)).toBe('25.00 ft')
    expect(frontageText(null)).toBe(null)
  })
})
