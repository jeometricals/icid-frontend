import { describe, it, expect } from 'vitest'
import { facingStreetName, propertyKindLabel, rampTypeLabel, withoutLeadingZeros } from '../propertyKinds'

describe('withoutLeadingZeros', () => {
  it.each([['00123', '123'], [' 0045 ', '45'], ['0000', '0'], ['0', '0'], ['120', '120']])(
    'reads %j as %j', (text, number) => {
      expect(withoutLeadingZeros(text)).toBe(number)
    })

  it.each([['', ''], [' 12a ', '12a'], ['4-5', '4-5']])('leaves %j that is not all digits trimmed, as %j', (text, kept) => {
    expect(withoutLeadingZeros(text)).toBe(kept)
  })
})

describe('labels', () => {
  it('names the kinds, the ramp types and the street a ramp faces', () => {
    expect(propertyKindLabel('ped_ramp')).toBe('Pedestrian Ramp')
    expect(propertyKindLabel('sidewalk')).toBe('Sidewalk')
    expect(rampTypeLabel('CUT_THROUGH')).toBe('Cut-through')
    expect(rampTypeLabel('ODD')).toBe('ODD')
    const ramp = { intersection_street_1: 'Atlantic Ave', intersection_street_2: 'Court St' }
    expect(facingStreetName({ ...ramp, facing_street: 'street_1' })).toBe('Atlantic Ave')
    expect(facingStreetName({ ...ramp, facing_street: 'street_2' })).toBe('Court St')
    expect(facingStreetName({ ...ramp, facing_street: null })).toBeNull()
  })
})
