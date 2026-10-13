import { describe, it, expect } from 'vitest'
import { formatDollars, formatPayItemQuantity, formatPercent, formatUnitPrice } from '../payItemFormat'

describe('formatPayItemQuantity', () => {
  it('separates thousands and keeps three decimals at most', () => {
    expect(formatPayItemQuantity(1234567.89)).toBe('1,234,567.89')
    expect(formatPayItemQuantity(0.12345)).toBe('0.123')
    expect(formatPayItemQuantity(901)).toBe('901')
  })
})

describe('formatDollars', () => {
  it('prints whole dollars by default', () => {
    expect(formatDollars(1205214)).toBe('$1,205,214')
    expect(formatDollars(125430.49)).toBe('$125,430')
    expect(formatDollars(0)).toBe('$0')
  })

  it('prints cents when asked', () => {
    expect(formatDollars(125430, { cents: true })).toBe('$125,430.00')
    expect(formatDollars(12.5, { cents: true })).toBe('$12.50')
  })
})

describe('formatUnitPrice', () => {
  it('is dollars with two decimals', () => {
    expect(formatUnitPrice(1500)).toBe('$1,500.00')
    expect(formatUnitPrice(0.5)).toBe('$0.50')
  })
})

describe('formatPercent', () => {
  it('prints one decimal', () => {
    expect(formatPercent(3.8)).toBe('3.8%')
    expect(formatPercent(28)).toBe('28.0%')
    expect(formatPercent(0)).toBe('0.0%')
    expect(formatPercent(1234.56)).toBe('1,234.6%')
  })

  it('is a dash for a percentage that isn\'t known', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(undefined)).toBe('—')
  })
})
