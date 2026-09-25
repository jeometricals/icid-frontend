import { FileText } from 'lucide-react'
import { format, parseISO } from 'date-fns'

/**
 * Clickable card for one IDR in the Drafts or Archive list: date, report count and whether a General is included,
 * then "Last edited" for a draft or "Submitted" for a submitted IDR.
 * Props: idr (a listIdrs row), onOpen (click handler), reporterName (optional; shown when given, e.g. in the Archive).
 */
export default function IdrCard({ idr, onOpen, reporterName }) {
  return (
    <button
      onClick={onOpen}
      className="bg-white hover:bg-construction-50 border-2 border-transparent hover:border-construction-300 rounded-lg p-6 transition-all duration-200 shadow-sm hover:shadow-md text-left"
    >
      <div className="flex items-start space-x-4">
        <div className="bg-construction-100 p-3 rounded-lg">
          <FileText className="h-6 w-6 text-construction-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-gray-900 mb-1">
            {/* parseISO keeps a date-only string in local time (new Date() would shift it a day in US zones) */}
            {format(parseISO(idr.report_date), 'MMM d, yyyy')}
          </h3>
          <p className="text-sm text-gray-600 mb-2">{contentsSummary(idr)}</p>
          {reporterName && <p className="text-sm text-gray-600 mb-2">Inspector: {reporterName}</p>}
          <p className="text-xs text-gray-500">{timestampLabel(idr)}</p>
        </div>
      </div>
    </button>
  )
}

// "3 reports · With General", "1 report · General only", "2 reports · No General", or "No reports yet"
function contentsSummary({ report_count: count, has_general: hasGeneral }) {
  if (count === 0) return 'No reports yet'
  const reports = `${count} ${count === 1 ? 'report' : 'reports'}`
  if (!hasGeneral) return `${reports} · No General`
  return `${reports} · ${count === 1 ? 'General only' : 'With General'}`
}

function timestampLabel(idr) {
  if (idr.status === 'draft') return `Last edited ${format(parseISO(idr.updated_at), 'MMM d, h:mm a')}`
  // No DB constraint guarantees submitted_at is set, so don't let a null crash the list
  if (!idr.submitted_at) return 'Submitted (date unknown)'
  return `Submitted ${format(parseISO(idr.submitted_at), "MMM d, yyyy 'at' h:mm a")}`
}
