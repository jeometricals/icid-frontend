/**
 * Reading an IDR's field_edits (every reviewer edit, oldest first, as GET /v1/idrs/{id} returns them). The IDR and
 * its reports already hold the edited values; these helpers pick out one field's history to draw as a redline.
 */

export const REVISED_AFTER_RETURN = 'Inspector revised after return'
export const EDIT_CONFLICT = 'Someone else edited this field — reloading'
export const APPROVAL_SUPERSEDED = 'Approval superseded — re-approve or revise to attest.'
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

/** The stage an IDR in review is at, as edits are stamped with it ('stage1' | 'stage2'); null at any other status. */
export function reviewStage(status) {
  return { stage1_review: 'stage1', stage2_review: 'stage2' }[status] ?? null
}

/**
 * The edits by which reviewers have attested to one pay item, oldest first: each approval, each revision of its
 * quantity, and the edit that added it. Returns [{edit, current}]; current is false for an attestation to a
 * quantity the item no longer has, which no longer counts.
 */
export function payItemAttestations(edits, reportId, item) {
  const itemPath = payItemPath(item.id)
  const quantityPath = payItemPath(item.id, 'payQuantity')
  const attested = (edit) => {
    if (edit.edit_type === 'pay_item_approve' && edit.field_path === itemPath) return [edit.new_value]
    if (edit.edit_type === 'pay_item_revision' && edit.field_path === quantityPath) return [edit.new_value]
    if (edit.edit_type === 'pay_item_add' && edit.field_path === itemPath) return [edit.new_value?.payQuantity]
    return null
  }
  return (edits || [])
    .filter(edit => (edit.report_id ?? null) === (reportId ?? null))
    .map(edit => ({ edit, quantity: attested(edit) }))
    .filter(entry => entry.quantity)
    .map(({ edit, quantity }) => ({ edit, current: sameValue(quantity[0], item.payQuantity) }))
}

/**
 * Whether a reviewer has attested to a pay item as it now stands, at one stage: an approval, revision or add of
 * theirs, stamped with that stage, for the quantity the item has now. who is {userUuid, stage, refusal}; refusal
 * (see PayItemGateContext) is the backend's last word, so an item it named is only touched by an edit made since.
 */
export function isPayItemTouched(edits, reportId, item, { userUuid, stage, refusal = null }) {
  const refused = Boolean(refusal?.itemIds.includes(item.id))
  return payItemAttestations(edits, reportId, item).some(({ edit, current }) => current
    && edit.editor_uuid === userUuid && edit.editor_stage === stage
    && !(refused && refusal.knownEditIds.includes(edit.edit_id)))
}

/**
 * The pay items a reviewer still has to approve or revise before they can approve the IDR's stage, as the backend's
 * gate counts them: every item with an id on every report but an auto-generated General. Takes the IDR's reports
 * (with report_data), its field_edits and who (as isPayItemTouched). Returns [{pay_item_id, report_id}] in report
 * and item order. The backend also drops attestations from before the stage was last accepted, which the page
 * can't see, so this can undercount until the backend refuses once.
 */
export function untouchedPayItems(reports, edits, who) {
  return (reports || []).flatMap((report) => {
    const items = report.report_data?.payItems
    if (report.is_auto_generated || !Array.isArray(items)) return []
    return items
      .filter(item => item?.id && !isPayItemTouched(edits, report.report_id, item, who))
      .map(item => ({ pay_item_id: item.id, report_id: report.report_id }))
  })
}
