/**
 * Conversions between an IDR's header fields (as the backend sends them) and the header form's input strings,
 * plus the dirty check that decides what Save Header sends.
 */

export const HEADER_FIELDS = [
  'work_start_time',
  'work_end_time',
  'inspector_start_time',
  'inspector_end_time',
  'temp_low',
  'temp_high',
  'weather_am',
  'weather_pm',
]

const TIME_FIELDS = new Set(['work_start_time', 'work_end_time', 'inspector_start_time', 'inspector_end_time'])
const NUMBER_FIELDS = new Set(['temp_low', 'temp_high'])

/**
 * Turns an IDR's header fields into form strings: null → '', '07:00:00' → '07:00', 78.0 → '78'.
 */
export function headerFormValues(idr) {
  return Object.fromEntries(HEADER_FIELDS.map(field => {
    const value = idr[field]
    if (value === null || value === undefined) return [field, '']
    if (TIME_FIELDS.has(field)) return [field, String(value).slice(0, 5)]
    return [field, String(value)]
  }))
}

// Temps compare by number so '78' and '78.0' count as the same value
function sameValue(field, a, b) {
  if (NUMBER_FIELDS.has(field) && a !== '' && b !== '') return Number(a) === Number(b)
  return a === b
}

// Form string → request value: '' clears the field (null), temps are sent as numbers
function toRequestValue(field, value) {
  if (value === '') return null
  if (NUMBER_FIELDS.has(field)) return Number(value)
  return value
}

/**
 * Compares the form against the last saved values and returns only the changed fields, ready for saveIdrHeader.
 * Returns {} when nothing changed.
 */
export function changedHeaderFields(form, saved) {
  return Object.fromEntries(
    HEADER_FIELDS
      .filter(field => !sameValue(field, form[field], saved[field]))
      .map(field => [field, toRequestValue(field, form[field])])
  )
}
