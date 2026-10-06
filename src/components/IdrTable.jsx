import { ArrowDown, ArrowUp, Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import IDRNumberBadge from './IDRNumberBadge'
import StatusBadge from './StatusBadge'

/**
 * Table of IDRs, one row each, for the Report Archive, the review queues and the admin's list of every IDR: work
 * date, IDR #, status, inspector (with a "Signed" mark when the IDR was submitted with a signature), latest
 * reviewer and when it was submitted. A row opens its IDR. The rows are shown in the order given.
 * Props: idrs (listIdrs / getReviewQueue rows), onOpen(idr) (leave it out and the rows don't open anything),
 * showProject (adds a Project column; default false), sort ({key, direction: 'asc' | 'desc'}) with onSort(key)
 * (makes the Work date, Status and Submitted headings buttons; key is 'report_date' | 'status' | 'submitted_at'),
 * renderActions(idr) (adds an Actions column holding what it returns), blankNumber (shown for an IDR with no
 * number; default the "No IDR # yet" badge).
 */
export default function IdrTable({ idrs, onOpen, showProject = false, sort, onSort, renderActions, blankNumber }) {
  const heading = (label, sortKey) => (
    <ColumnHeading label={label} sortKey={sortKey} sort={sort} onSort={onSort} />
  )

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            {heading('Work date', 'report_date')}
            {showProject && heading('Project')}
            {heading('IDR #')}
            {heading('Status', 'status')}
            {heading('Inspector')}
            {heading('Reviewer')}
            {heading('Submitted', 'submitted_at')}
            {renderActions && heading('Actions')}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {idrs.map(idr => (
            <tr
              key={idr.idr_id}
              onClick={onOpen && (() => onOpen(idr))}
              className={onOpen ? 'cursor-pointer hover:bg-construction-50' : undefined}
            >
              <td className="px-4 py-3 whitespace-nowrap">
                {/* parseISO keeps a date-only string in local time (new Date() would shift it a day in US zones) */}
                {onOpen ? (
                  // The row's one real control, so the table works from the keyboard too
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpen(idr) }}
                    className="font-semibold text-construction-700 hover:text-construction-800 hover:underline"
                  >
                    {format(parseISO(idr.report_date), 'MMM d, yyyy')}
                  </button>
                ) : (
                  <span className="font-semibold text-gray-900">{format(parseISO(idr.report_date), 'MMM d, yyyy')}</span>
                )}
              </td>
              {showProject && <td className="px-4 py-3 whitespace-nowrap text-gray-700">{idr.project_id}</td>}
              <td className="px-4 py-3">
                {!idr.idr_number && blankNumber !== undefined
                  ? <span className="text-gray-400">{blankNumber}</span>
                  : <IDRNumberBadge number={idr.idr_number} />}
              </td>
              <td className="px-4 py-3"><StatusBadge status={idr.status} returned={Boolean(idr.return_reason)} /></td>
              <td className="px-4 py-3 text-gray-700">
                <span>{idr.reporter_name || 'Unknown inspector'}</span>
                {idr.inspector_signature_path && (
                  <span className="ml-2 inline-flex items-center text-xs font-medium text-emerald-700">
                    <Check className="h-3.5 w-3.5 mr-0.5" aria-hidden="true" />
                    Signed
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-700">{latestReviewer(idr) || <span className="text-gray-400">—</span>}</td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-600">{submittedLabel(idr)}</td>
              {renderActions && <td className="px-4 py-3 whitespace-nowrap">{renderActions(idr)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// A column heading; a button that sorts by its column when the table is sortable and the column has a sort key
function ColumnHeading({ label, sortKey, sort, onSort }) {
  if (!onSort || !sortKey) return <th scope="col" className="px-4 py-3">{label}</th>
  const active = sort?.key === sortKey
  const Arrow = sort?.direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <th scope="col" className="px-4 py-3" aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center space-x-1 font-semibold uppercase tracking-wide hover:text-gray-700"
      >
        <span>{label}</span>
        {active && <Arrow className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
    </th>
  )
}

// Whoever last picked the IDR up: the RE once it reached Stage 2, else the Stage 1 reviewer
function latestReviewer(idr) {
  return idr.re_reviewer_name || idr.stage1_reviewer_name || ''
}

function submittedLabel(idr) {
  // No DB constraint guarantees submitted_at is set, so don't let a null crash the list
  if (!idr.submitted_at) return idr.status === 'draft' ? '—' : 'Date unknown'
  return format(parseISO(idr.submitted_at), "MMM d, yyyy 'at' h:mm a")
}
