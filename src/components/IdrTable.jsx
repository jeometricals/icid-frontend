import { Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import IDRNumberBadge from './IDRNumberBadge'
import StatusBadge from './StatusBadge'

/**
 * Table of IDRs, one row each, for the Report Archive and the review queues: work date, IDR #, status, inspector
 * (with a "Signed" mark when the IDR was submitted with a signature), latest reviewer and when it was submitted.
 * A row opens its IDR. The rows are shown in the order given.
 * Props: idrs (listIdrs / getReviewQueue rows), onOpen(idr), showProject (adds a Project column; default false).
 */
export default function IdrTable({ idrs, onOpen, showProject = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th scope="col" className="px-4 py-3">Work date</th>
            {showProject && <th scope="col" className="px-4 py-3">Project</th>}
            <th scope="col" className="px-4 py-3">IDR #</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Inspector</th>
            <th scope="col" className="px-4 py-3">Reviewer</th>
            <th scope="col" className="px-4 py-3">Submitted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {idrs.map(idr => (
            <tr key={idr.idr_id} onClick={() => onOpen(idr)} className="cursor-pointer hover:bg-construction-50">
              <td className="px-4 py-3 whitespace-nowrap">
                {/* The row's one real control, so the table works from the keyboard too */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpen(idr) }}
                  className="font-semibold text-construction-700 hover:text-construction-800 hover:underline"
                >
                  {/* parseISO keeps a date-only string in local time (new Date() would shift it a day in US zones) */}
                  {format(parseISO(idr.report_date), 'MMM d, yyyy')}
                </button>
              </td>
              {showProject && <td className="px-4 py-3 whitespace-nowrap text-gray-700">{idr.project_id}</td>}
              <td className="px-4 py-3"><IDRNumberBadge number={idr.idr_number} /></td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Whoever last picked the IDR up: the RE once it reached Stage 2, else the Stage 1 reviewer
function latestReviewer(idr) {
  return idr.re_reviewer_name || idr.stage1_reviewer_name || ''
}

function submittedLabel(idr) {
  // No DB constraint guarantees submitted_at is set, so don't let a null crash the list
  if (!idr.submitted_at) return 'Date unknown'
  return format(parseISO(idr.submitted_at), "MMM d, yyyy 'at' h:mm a")
}
