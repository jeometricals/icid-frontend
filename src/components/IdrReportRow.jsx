import { FileText, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { reportTypeLabel, isReportTypeAvailable } from '../data/reportTypes'

/**
 * One report inside an IDR: type name, addendum chip, saved/not-edited state, "Page X of Y" once submitted,
 * and Open/Delete buttons (Delete hidden when read-only).
 * Props: report (an IDR report), totalPages (IDR total_pages or null), readOnly, disabled (another action
 * is running), deleting (this row's delete is running), onOpen(), onDelete().
 */
export default function IdrReportRow({ report, totalPages, readOnly, disabled, deleting, onOpen, onDelete }) {
  const canOpen = isReportTypeAvailable(report.report_type)
  const showPage = readOnly && report.page_number != null && totalPages != null

  return (
    <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
      <div className="flex items-center space-x-3 min-w-0">
        <div className="bg-construction-100 p-2 rounded-lg">
          <FileText className="h-5 w-5 text-construction-700" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-gray-900">{reportTypeLabel(report.report_type)}</span>
            {report.is_addendum && (
              <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">addendum</span>
            )}
            {showPage && (
              <span className="text-xs text-gray-500">Page {report.page_number} of {totalPages}</span>
            )}
          </div>
          <p className="text-sm text-gray-500">{editState(report, readOnly)}</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpen}
          disabled={!canOpen}
          title={canOpen ? undefined : 'Form not available yet'}
          className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Open
        </button>
        {!readOnly && (
          <button
            onClick={onDelete}
            disabled={disabled || deleting}
            className="btn-secondary flex items-center space-x-1 text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
            <span>{deleting ? 'Deleting...' : 'Delete'}</span>
          </button>
        )}
      </div>
    </li>
  )
}

// Submit bumps every report's updated_at, so the save time is only meaningful while the IDR is a draft
function editState(report, readOnly) {
  if (Object.keys(report.report_data || {}).length === 0) return 'Not yet edited'
  return readOnly ? 'Saved' : `Saved ${format(new Date(report.updated_at), 'HH:mm')}`
}
