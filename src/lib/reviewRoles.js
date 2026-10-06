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
const STAGE_ONE_QUEUE = { id: 'stage1', label: 'Stage 1', statuses: ['submitted', 'stage1_review'] }
const STAGE_TWO_QUEUE = { id: 'stage2', label: 'Stage 2', statuses: ['stage2_review'] }

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
 * reviewer has nothing to do (or what accepting will do), or null.
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
    return reviewsStageOne ? { actions: [], note: 'Another reviewer accepted this IDR for Stage 1.' } : nothing
  }

  if (idr.status === 'stage2_review') {
    if (!admin && !isRe) return nothing
    const mine = idr.re_reviewer_uuid === user?.uuid
    const decide = ['approve-stage2', 'return-oe', 'return-inspector']
    if (mine) return { actions: decide, note: null }
    const note = idr.re_reviewer_uuid ? 'Another RE has accepted this IDR. Accepting takes it over.' : null
    return { actions: admin ? ['accept-stage2', ...decide] : ['accept-stage2'], note }
  }

  return nothing
}
