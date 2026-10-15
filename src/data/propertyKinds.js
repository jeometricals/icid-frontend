// The two kinds of site (property) and a ped ramp's own values, as the backend spells them (migration 035's enum
// types), with the words the app shows for each

export const PROPERTY_KINDS = [
  { value: 'sidewalk', label: 'Sidewalk' },
  { value: 'ped_ramp', label: 'Pedestrian Ramp' },
]

// The five boroughs; a sidewalk's is its BBL's first digit (1 Manhattan ... 5 Staten Island)
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

/**
 * A BBL as typed, read for the form's preview: {borough, block, lot} once it is 10 digits with a first digit of 1-5
 * (block and lot without their leading zeros, as the backend's block_display / lot_display), else null. Only the
 * form uses it; tables show what the backend sends.
 */
export function parseBbl(text) {
  const bbl = text.trim()
  if (!/^[1-5]\d{9}$/.test(bbl)) return null
  const part = (start, end) => bbl.slice(start, end).replace(/^0+/, '') || '0'
  return { borough: BOROUGHS[Number(bbl[0]) - 1], block: part(1, 6), lot: part(6, 10) }
}
