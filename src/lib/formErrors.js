/**
 * Splits a failed save into what shows beside each field and what shows below the form, for the admin form
 * dialogs. A 409 is the conflict message on the field it names; a 422 names its fields in each entry's loc (the
 * first message for a field wins, and one for a field the form doesn't have goes below); anything else is said as
 * the backend worded it.
 * Takes the thrown error (or null), the form's field keys and {field, message} for a 409.
 * Returns {fields: {key: message}, general: message or null}.
 */
export function formErrors(error, keys, conflict) {
  if (!error) return { fields: {}, general: null }
  if (error.status === 409) return { fields: { [conflict.field]: conflict.message }, general: null }
  const entries = error.status === 422 && Array.isArray(error.body?.detail) ? error.body.detail : null
  if (!entries) return { fields: {}, general: error.message }
  const fields = {}
  const rest = []
  for (const entry of entries) {
    const key = entry.loc?.[entry.loc.length - 1]
    if (keys.includes(key) && !fields[key]) fields[key] = entry.msg
    else rest.push(entry.msg)
  }
  return { fields, general: rest.length > 0 ? rest.join('; ') : null }
}
