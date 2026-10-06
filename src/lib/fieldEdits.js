/**
 * Reading an IDR's field_edits (every reviewer edit, oldest first, as GET /v1/idrs/{id} returns them). The IDR and
 * its reports already hold the edited values; these helpers pick out one field's history to draw as a redline.
 */

export const REVISED_AFTER_RETURN = 'Inspector revised after return'
export const EDIT_CONFLICT = 'Someone else edited this field — reloading'
// The blue of a reviewer's value (Word's track-changes blue)
export const REDLINE_TEXT = 'text-[#0070C0]'

/** The edits of one field, oldest first. reportId is null (or undefined) for a header field. */
export function editsForField(edits, reportId, fieldPath) {
  return (edits || []).filter(e => (e.report_id ?? null) === (reportId ?? null) && e.field_path === fieldPath)
}

/** The field_path of a pay item's field ('payItems[<id>].payQuantity'), or of the item itself when field is left out. */
export function payItemPath(itemId, field) {
  return field ? `payItems[${itemId}].${field}` : `payItems[${itemId}]`
}

/** The 'pay_item_add' edit that added a pay item to a report, or undefined for an item the inspector entered. */
export function payItemAddEdit(edits, reportId, itemId) {
  return editsForField(edits, reportId, payItemPath(itemId)).find(e => e.edit_type === 'pay_item_add')
}

/** Whether a report has any edit at all (so its history is worth showing). */
export function hasEdits(edits, reportId) {
  return (edits || []).some(e => (e.report_id ?? null) === (reportId ?? null))
}

/** A value as text for display: nothing reads "(blank)", true / false read "Yes" / "No". */
export function displayValue(value) {
  if (value === null || value === undefined || value === '') return '(blank)'
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return String(value)
}

/** Whether two values are the same for display: nothing equals '', and numbers compare as numbers ('78' = 78.0). */
export function sameValue(a, b) {
  const left = a ?? ''
  const right = b ?? ''
  if (left === right) return true
  if (left === '' || right === '' || typeof left === 'boolean' || typeof right === 'boolean') return false
  const asNumbers = [Number(left), Number(right)]
  if (asNumbers.every(n => !Number.isNaN(n)) && String(left).trim() !== '' && String(right).trim() !== '') {
    return asNumbers[0] === asNumbers[1]
  }
  return String(left) === String(right)
}

/**
 * Whether a field was changed after its last reviewer edit, which only its inspector can do, on a returned draft:
 * the current value no longer matches that edit's new value. Such a change has no edit row of its own.
 */
export function revisedAfterReturn(currentValue, chain, format = v => v) {
  if (!chain || chain.length === 0) return false
  return !sameValue(format(currentValue), format(chain[chain.length - 1].new_value))
}
