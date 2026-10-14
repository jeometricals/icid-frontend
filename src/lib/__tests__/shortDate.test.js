import { describe, it, expect } from 'vitest'
import { shortDate } from '../shortDate'

describe('shortDate', () => {
  const today = new Date(2026, 0, 1)

  it('prints a date of this year without its year', () => {
    expect(shortDate('2026-09-14T12:00:00', today)).toBe('Sep 14')
  })

  it('carries the year on a date of another year', () => {
    expect(shortDate('2024-09-14T12:00:00', today)).toBe('Sep 14, 2024')
  })

  it('reads a bare date as that day on the viewer\'s calendar', () => {
    expect(shortDate('2026-01-01', today)).toBe('Jan 1')
  })
})
