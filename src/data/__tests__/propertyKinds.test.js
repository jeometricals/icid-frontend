import { describe, it, expect } from 'vitest'
import { facingStreetName, parseBbl, propertyKindLabel, rampTypeLabel } from '../propertyKinds'

describe('parseBbl', () => {
  it('reads the borough, block and lot of a 10-digit BBL, without leading zeros', () => {
    expect(parseBbl('4001230045')).toEqual({ borough: 'Queens', block: '123', lot: '45' })
    expect(parseBbl(' 1000010001 ')).toEqual({ borough: 'Manhattan', block: '1', lot: '1' })
    expect(parseBbl('5000000000')).toEqual({ borough: 'Staten Island', block: '0', lot: '0' })
  })

  it.each(['', '400123004', '40012300451', '6001230045', '0001230045', '40012300a5'])('reads %j as nothing', (text) => {
    expect(parseBbl(text)).toBeNull()
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
