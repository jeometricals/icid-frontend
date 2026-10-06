import { STATUS_LABELS } from '../lib/reviewRoles'

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-800',
  stage1_review: 'bg-construction-100 text-construction-800',
  stage2_review: 'bg-purple-100 text-purple-800',
  approved: 'bg-emerald-100 text-emerald-800',
}

/**
 * Pill naming where an IDR is in review: Draft, Submitted, Stage 1 Review, Stage 2 Review or Approved. A draft that
 * a reviewer sent back reads "Returned". Props: status (the IDR's status), returned (true for a draft with a return
 * reason).
 */
export default function StatusBadge({ status, returned = false }) {
  const isReturned = status === 'draft' && returned
  const label = isReturned ? 'Returned' : STATUS_LABELS[status] || status
  const style = isReturned ? 'bg-red-100 text-red-800' : STATUS_STYLES[status] || STATUS_STYLES.draft
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${style}`}>
      {label}
    </span>
  )
}
