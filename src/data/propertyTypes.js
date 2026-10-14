// The kinds of property the backend takes (its CHECK on properties.property_type), in the order the form offers
// them, each with the words the app shows for it
export const PROPERTY_TYPES = [
  { value: '1_3_family', label: '1-3 family' },
  { value: '4_plus_family', label: '4+ family / commercial' },
  { value: 'expedited', label: 'Expedited' },
]

// The words for a property type; an unknown one is shown as stored
export function propertyTypeLabel(value) {
  return PROPERTY_TYPES.find(type => type.value === value)?.label ?? value
}
