import { apiFetch } from './apiClient'

// The counts a move that claims or releases an IDR's flags adds to its response (R1f)
const FLAG_COUNTS = ['flags_claimed', 'flags_dropped', 'flags_released']

// The IDR a move returned, with whichever flag counts the response carries set on it
function movedIdr(json) {
  const counts = Object.fromEntries(FLAG_COUNTS.filter(key => typeof json[key] === 'number').map(key => [key, json[key]]))
  return { ...json.data, ...counts }
}

/**
 * Lists the IDRs waiting in one review queue, oldest submission first, on the projects where the signed-in user
 * works that queue. status is 'submitted' (waiting to be picked up), 'stage1_review' or 'stage2_review'.
 * Returns an array of IDR rows as listIdrs does (report_count, has_general, reporter_name, the reviewer names);
 * empty for a user with no reviewing role.
 */
export async function getReviewQueue(status) {
  const params = new URLSearchParams({ status })
  const json = await apiFetch(`/v1/idrs/queue?${params}`)
  return json.data
}

/**
 * Picks a submitted IDR up for Stage 1, making the signed-in user its Stage 1 reviewer. idrNumber is needed the
 * first time an IDR is accepted; an IDR that already has a number keeps it, and idrNumber can be left out.
 * Returns the updated IDR. A 409 with error.body.existing_idr_id means the number is in use on that other IDR.
 */
export async function acceptStage1(idrId, idrNumber) {
  const body = idrNumber === undefined ? {} : { idr_number: idrNumber }
  const json = await apiFetch(`/v1/idrs/${idrId}/accept-stage1`, { method: 'POST', body })
  return json.data
}

/**
 * Passes an IDR from Stage 1 on to Stage 2. Only its Stage 1 reviewer (or an admin) can.
 * Returns the updated IDR.
 */
export async function approveStage1(idrId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/approve-stage1`, { method: 'POST' })
  return json.data
}

/**
 * Picks an IDR up for Stage 2, making the signed-in RE its RE reviewer (the last to accept is the reviewer).
 * Returns the updated IDR.
 */
export async function acceptStage2(idrId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/accept-stage2`, { method: 'POST' })
  return json.data
}

/**
 * Approves an IDR for good, signed with the signed-in user's signature. Only its RE reviewer (or an admin) can;
 * fails with 400 when they have no signature. Approving claims the flags attributed to it (see idrFlags.js).
 * Returns the approved IDR, with flags_claimed and flags_dropped (attributed flags another IDR claimed first, left
 * out) on it.
 */
export async function approveStage2(idrId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/approve-stage2`, { method: 'POST' })
  return movedIdr(json)
}

/**
 * Sends an IDR back from review with a comment. to is 'inspector' (it becomes a draft again) or 'oe' (from Stage 2
 * back to Stage 1 review). The comment is required.
 * Returns the updated IDR.
 */
export async function returnIdr(idrId, { to, comment }) {
  const json = await apiFetch(`/v1/idrs/${idrId}/return`, { method: 'POST', body: { to, comment } })
  return json.data
}

/**
 * Admin only: unlocks an approved IDR (or one already in Stage 2 review) for the RE to review again. It goes to
 * stage2_review with the RE's signature and the RE reviewer cleared; its IDR number stays, and the flags it claimed
 * are released. Fails with 400 for an IDR at any other status.
 * Returns the updated IDR, with flags_released on it.
 */
export async function adminUnlockIdr(idrId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/admin/unlock`, { method: 'POST' })
  return movedIdr(json)
}

/**
 * Admin only: soft-deletes an IDR at any status. The record is kept (status 'deleted') but leaves every list, and
 * its day and IDR number become free again, and the flags it claimed are released. Deleting one that is already
 * deleted succeeds and changes nothing.
 * Returns the deleted IDR, with flags_released on it.
 */
export async function adminDeleteIdr(idrId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/admin/delete`, { method: 'POST' })
  return movedIdr(json)
}

/**
 * Admin only: brings a soft-deleted IDR back with the status it had when it was deleted (a draft when that isn't
 * on record), and into the lists again. Fails with 404 for an IDR that isn't deleted and 409 when another IDR has
 * since taken its day or its IDR number, or claimed one of the flags it would claim back (the thrown error's body
 * then carries existing_idr_id). One that comes back approved claims back the flags its delete released.
 * Returns the restored IDR, with flags_claimed on it.
 */
export async function undeleteIdr(idrId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/admin/undelete`, { method: 'POST' })
  return movedIdr(json)
}

/**
 * Admin only: deletes a soft-deleted IDR for good, with its reports, attachments, edits and quantities. It can't
 * be undone. Fails with 404 for an IDR that isn't soft-deleted first.
 * Returns nothing.
 */
export async function permanentDeleteIdr(idrId) {
  await apiFetch(`/v1/idrs/${idrId}/admin/permanent`, { method: 'DELETE' })
}
