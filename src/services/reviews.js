import { apiFetch } from './apiClient'

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
 * fails with 400 when they have no signature.
 * Returns the approved IDR.
 */
export async function approveStage2(idrId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/approve-stage2`, { method: 'POST' })
  return json.data
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
 * stage2_review with the RE's signature and the RE reviewer cleared; its IDR number stays. Fails with 400 for an
 * IDR at any other status.
 * Returns the updated IDR.
 */
export async function adminUnlockIdr(idrId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/admin/unlock`, { method: 'POST' })
  return json.data
}

/**
 * Admin only: soft-deletes an IDR at any status. The record is kept (status 'deleted') but leaves every list, and
 * its day and IDR number become free again. Deleting one that is already deleted succeeds and changes nothing.
 * Returns the deleted IDR.
 */
export async function adminDeleteIdr(idrId) {
  const json = await apiFetch(`/v1/idrs/${idrId}/admin/delete`, { method: 'POST' })
  return json.data
}
