/**
 * Who may do what in review, worked out from the signed-in user, the roles they hold on each project
 * ({project_id: ['inspector' | 'oe' | 're', ...]}, from useProjectRoles) and an IDR's status. The backend enforces
 * all of it; this only decides what to show.
 */

// The statuses an IDR moves through, in order, with the text shown for each
export const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  stage1_review: 'Stage 1 Review',
  stage2_review: 'Stage 2 Review',
  approved: 'Approved',
}

// The review queues: Stage 1 holds IDRs waiting to be picked up as well as those being reviewed
const STAGE_ONE_QUEUE = { id: 'stage1', label: 'IDR Check Queue', statuses: ['submitted', 'stage1_review'] }
const STAGE_TWO_QUEUE = { id: 'stage2', label: 'RE Review Queue', statuses: ['stage2_review'] }

export function isAdmin(user) {
  return user?.role === 'admin'
}

// Whether the user holds the role on at least one project
function holdsAnywhere(rolesByProject, role) {
  return Object.values(rolesByProject || {}).some(roles => roles.includes(role))
}

/**
 * The review queues a user works: Stage 1 for an OE or RE on any project, Stage 2 for an RE; both for an admin.
 * Returns a list of {id, label, statuses}, empty for a user who reviews nothing.
 */
export function reviewQueuesFor(user, rolesByProject) {
  if (isAdmin(user)) return [STAGE_ONE_QUEUE, STAGE_TWO_QUEUE]
  const isRe = holdsAnywhere(rolesByProject, 're')
  const queues = []
  if (isRe || holdsAnywhere(rolesByProject, 'oe')) queues.push(STAGE_ONE_QUEUE)
  if (isRe) queues.push(STAGE_TWO_QUEUE)
  return queues
}

/**
 * What a user can do to an IDR in review, given the roles they hold on its project.
 * Returns {actions, note}: actions is a list of 'accept-stage1' | 'approve-stage1' | 'accept-stage2' |
 * 'approve-stage2' | 'return-inspector' | 'return-oe' in the order to show them; note is a line explaining why a
 * reviewer has nothing to do (or what accepting will do), or null. At Stage 2 the only action is accept-stage2
 * until the user is the IDR's RE reviewer.
 */
export function reviewActionsFor(idr, user, roles = []) {
  const admin = isAdmin(user)
  const isRe = roles.includes('re')
  const reviewsStageOne = isRe || roles.includes('oe')
  const nothing = { actions: [], note: null }

  if (idr.status === 'submitted') {
    return admin || reviewsStageOne ? { actions: ['accept-stage1'], note: null } : nothing
  }

  if (idr.status === 'stage1_review') {
    if (admin || (reviewsStageOne && idr.stage1_reviewer_uuid === user?.uuid)) {
      return { actions: ['approve-stage1', 'return-inspector'], note: null }
    }
    return reviewsStageOne ? { actions: [], note: 'Another reviewer accepted this IDR for the IDR check.' } : nothing
  }

  if (idr.status === 'stage2_review') {
    if (!admin && !isRe) return nothing
    // Approving and returning stay hidden until this user has accepted the IDR, for an admin too
    if (idr.re_reviewer_uuid === user?.uuid) {
      return { actions: ['approve-stage2', 'return-oe', 'return-inspector'], note: null }
    }
    const note = idr.re_reviewer_uuid ? 'Another RE has accepted this IDR. Accepting takes it over.' : null
    return { actions: ['accept-stage2'], note }
  }

  return nothing
}

/**
 * Whether an IDR in a review queue is a task for the user: something they can act on right now, given the roles
 * they hold on its project. A submitted IDR is one for any OE or RE on the project; one in Stage 1 review, for the
 * reviewer who accepted it; one in Stage 2 review, for the RE who accepted it, or for every RE on the project while
 * nobody has. For an admin, every IDR in a review queue is one.
 */
export function isTaskFor(idr, user, roles = []) {
  if (isAdmin(user)) return ['submitted', 'stage1_review', 'stage2_review'].includes(idr.status)
  const isRe = roles.includes('re')
  if (idr.status === 'submitted') return isRe || roles.includes('oe')
  if (idr.status === 'stage1_review') return (isRe || roles.includes('oe')) && idr.stage1_reviewer_uuid === user?.uuid
  if (idr.status === 'stage2_review') return isRe && (!idr.re_reviewer_uuid || idr.re_reviewer_uuid === user?.uuid)
  return false
}

/**
 * The text for a count badge: the number up to 99, "99+" beyond, and null (no badge) for zero.
 */
export function countBadgeText(count) {
  if (!count || count < 1) return null
  return count > 99 ? '99+' : String(count)
}
