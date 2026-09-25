import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ADDABLE_REPORT_TYPES, reportTypeLabel } from '../data/reportTypes'

/**
 * Report-type dropdown plus Add button for adding a report to a draft IDR.
 * Props: onAdd(reportType), adding (an add is running), disabled (another action is running),
 * generalExists (the IDR already has its one main General, so that option is unavailable).
 */
export default function AddReportControl({ onAdd, adding, disabled, generalExists }) {
  const [reportType, setReportType] = useState(ADDABLE_REPORT_TYPES[0])
  const unavailable = type => type === 'GEN' && generalExists
  const canAdd = !unavailable(reportType) && !adding && !disabled

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <label htmlFor="add-report-type" className="text-sm font-medium text-gray-700">Add report</label>
      <select
        id="add-report-type"
        className="input-field sm:w-64"
        value={reportType}
        onChange={e => setReportType(e.target.value)}
      >
        {ADDABLE_REPORT_TYPES.map(type => (
          <option key={type} value={type} disabled={unavailable(type)}>
            {reportTypeLabel(type)}{unavailable(type) ? ' (already added)' : ''}
          </option>
        ))}
      </select>
      <button
        onClick={() => onAdd(reportType)}
        disabled={!canAdd}
        className="btn-primary flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="h-4 w-4" />
        <span>{adding ? 'Adding...' : 'Add'}</span>
      </button>
    </div>
  )
}
