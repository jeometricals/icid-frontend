// What a flag's enumerated fields can be, as the backend spells them (its Literals in api/schemas/flag.py), in the
// order the form offers them, each with the words the app shows for it

export const FLAG_SHAPES = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'trapezoid', label: 'Trapezoid' },
  { value: 'triangle', label: 'Right triangle' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'arc', label: 'Arc' },
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
