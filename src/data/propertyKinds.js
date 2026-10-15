// The two kinds of site (property) and a ped ramp's own values, as the backend spells them (migration 035's enum
// types), with the words the app shows for each

export const PROPERTY_KINDS = [
  { value: 'sidewalk', label: 'Sidewalk' },
  { value: 'ped_ramp', label: 'Pedestrian Ramp' },
]

// The five boroughs, as the backend spells them
export const BOROUGHS = ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island']

export const QUADRANTS = ['NE', 'NW', 'SE', 'SW']

export const RAMP_TYPES = [
  { value: 'PERPENDICULAR', label: 'Perpendicular' },
  { value: 'PARALLEL', label: 'Parallel' },
  { value: 'CUT_THROUGH', label: 'Cut-through' },
]

/** The words for a kind; an unknown one is shown as stored. */
export const propertyKindLabel = (value) => PROPERTY_KINDS.find(kind => kind.value === value)?.label ?? value

/** The words for a ramp type; an unknown one is shown as stored. */
export const rampTypeLabel = (value) => RAMP_TYPES.find(type => type.value === value)?.label ?? value

/**
 * The street a ped ramp faces, by name: facing_street ('street_1' | 'street_2') names one of its two intersection
 * streets. Null when it faces neither.
 */
export function facingStreetName(property) {
  if (property.facing_street === 'street_1') return property.intersection_street_1
  if (property.facing_street === 'street_2') return property.intersection_street_2
  return null
}

// The most digits a sidewalk's block and lot have, without their leading zeros (the backend's limits)
export const MAX_BLOCK_DIGITS = 5
export const MAX_LOT_DIGITS = 4

/**
 * A block or a lot as the tax map numbers it, the way the backend stores it: trimmed and, when it is all digits,
 * without its leading zeros ("00123" is "123", "0000" is "0"). Anything else comes back trimmed, as typed.
 */
export function withoutLeadingZeros(text) {
  const value = text.trim()
  return /^\d+$/.test(value) ? value.replace(/^0+/, '') || '0' : value
}
