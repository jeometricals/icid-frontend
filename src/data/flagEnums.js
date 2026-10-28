// What a flag's enumerated fields can be, as the backend spells them (its Literals in api/schemas/flag.py), in the
// order the form offers them, each with the words the app shows for it

export const FLAG_SHAPES = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'trapezoid', label: 'Trapezoid' },
  { value: 'triangle', label: 'Right triangle' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'arc', label: 'Arc' },
  { value: 'corner_quadrant', label: 'Corner quadrant' },
]

export const FLAG_MARKS = [
  { value: 'number_only', label: 'Number only' },
  { value: 'cross', label: 'Cross (X)' },
  { value: 'cross_with_number', label: 'Cross + number' },
  { value: 'tick', label: 'Tick' },
  { value: 'none', label: 'None' },
]

export const FLAG_NON_ASSESSABLE_REASONS = [
  { value: 'tree_damage', label: 'Tree damage' },
  { value: 'city_tree', label: 'City tree' },
  { value: 'transition', label: 'Transition' },
  { value: 'no_driveway', label: 'No driveway' },
  { value: 'hydrant', label: 'Hydrant' },
  { value: 'fronting_city', label: 'Fronting city property' },
  { value: 'utility', label: 'Utility' },
  { value: 'settlement', label: 'Settlement' },
  { value: 'other', label: 'Other' },
  // The Smart PIR survey's reasons (migration 034 added them; every older one stays)
  { value: 'tree', label: 'Tree' },
  { value: 'driveway', label: 'Driveway' },
  { value: 'grass', label: 'Grass' },
  { value: 'dirt', label: 'Dirt' },
  { value: 'existing_sidewalk', label: 'Existing sidewalk' },
  { value: 'asphalt', label: 'Asphalt' },
  { value: 'tree_pit', label: 'Tree pit' },
  { value: 'landmark', label: 'Landmark' },
  { value: 'vault', label: 'Vault' },
  { value: 'subway', label: 'Subway' },
  { value: 'scaffolding', label: 'Scaffolding' },
  { value: 'other_perm_obstruction', label: 'Other permanent obstruction' },
  { value: 'other_temp_obstruction', label: 'Other temporary obstruction' },
  // Slice Y1.5: wholly outside the page's sidewalk strip (the strip marks it; it can be chosen by hand too)
  { value: 'outside_property_line', label: 'Outside property line' },
]

// A flag's DOT defect codes, in the order the backend stores them
export const DEFECT_CODES = ['1', '2', '3', '4', '5', '6A', '6B', '6C']

// What a non-assessable area (a part of a flag that isn't assessed) can be
export const AREA_REASONS = [
  { value: 'driveway', label: 'Driveway' },
  { value: 'grass', label: 'Grass' },
  { value: 'dirt', label: 'Dirt' },
  { value: 'existing_sidewalk', label: 'Existing sidewalk' },
  { value: 'asphalt', label: 'Asphalt' },
  { value: 'tree_pit', label: 'Tree pit' },
  { value: 'landmark', label: 'Landmark' },
  { value: 'other', label: 'Other' },
  { value: 'outside_property_line', label: 'Outside property line' },
]

// A feature's type (a point obstruction or a sized feature on the page), as the backend spells it
export const FEATURE_TYPES = [
  { value: 'manhole', label: 'Manhole' },
  { value: 'grate', label: 'Grate' },
  { value: 'utility_cover', label: 'Utility cover' },
  { value: 'hydrant', label: 'Hydrant' },
  { value: 'fire_alarm', label: 'Fire alarm' },
  { value: 'tree_pit', label: 'Tree pit' },
  { value: 'meter', label: 'Meter' },
  { value: 'sign_or_meter', label: 'Sign or meter' },
  { value: 'mail_box', label: 'Mail box' },
  { value: 'telephone', label: 'Telephone' },
  { value: 'cellar_door', label: 'Cellar door' },
  { value: 'pole', label: 'Pole' },
  { value: 'detectable_warning', label: 'Detectable warning unit' },
  { value: 'other', label: 'Other' },
]

// A segment's type (a curb run)
export const SEGMENT_TYPES = [
  { value: 'curb_concrete', label: 'Concrete curb' },
  { value: 'curb_concrete_depressed', label: 'Depressed concrete curb' },
  { value: 'curb_steel_faced', label: 'Steel-faced curb' },
  { value: 'curb_steel_faced_corner', label: 'Steel-faced corner curb' },
  { value: 'curb_granite', label: 'Granite curb' },
  { value: 'other', label: 'Other' },
]

export const FLAG_THICKNESSES = [
  { value: '4in', label: '4"' },
  { value: '7in_as_4in', label: '7" as 4"' },
  { value: '7in', label: '7"' },
]

// The words for a value of one of the lists; an unknown value is shown as stored
const labelIn = (list) => (value) => list.find(entry => entry.value === value)?.label ?? value

export const shapeLabel = labelIn(FLAG_SHAPES)
export const markLabel = labelIn(FLAG_MARKS)
export const nonAssessableReasonLabel = labelIn(FLAG_NON_ASSESSABLE_REASONS)
export const thicknessLabel = labelIn(FLAG_THICKNESSES)
export const areaReasonLabel = labelIn(AREA_REASONS)
export const featureTypeLabel = labelIn(FEATURE_TYPES)
export const segmentTypeLabel = labelIn(SEGMENT_TYPES)
