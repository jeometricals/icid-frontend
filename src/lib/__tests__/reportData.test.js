import { describe, it, expect } from 'vitest'
import { formDataFromReportData, isObject, sharedSectionDefaults } from '../reportData'

describe('isObject', () => {
  it('is true only for a plain object', () => {
    expect(isObject({})).toBe(true)
    expect(isObject({ a: 1 })).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject('text')).toBe(false)
    expect(isObject(undefined)).toBe(false)
  })
})

describe('formDataFromReportData — payItems', () => {
  it.each([
    ['an object', { itemNo: '4.01' }],
    ['null', null],
    ['a string', '4.01'],
  ])('loads a saved payItems that is %s as no pay items', (_, payItems) => {
    expect(formDataFromReportData({ payItems }, sharedSectionDefaults()).payItems).toEqual([])
  })

  it('still loads a saved array, with a blank unit where it is missing', () => {
    const data = formDataFromReportData({ payItems: [{ itemNo: '4.01', payQuantity: '12' }] }, sharedSectionDefaults())
    expect(data.payItems).toEqual([{ itemNo: '4.01', payQuantity: '12', unit: '' }])
  })
})
