import { useState } from 'react'
import { Plus } from 'lucide-react'
import { REPORT_TYPES, isReportTypeAvailable } from '../data/reportTypes'

/**
 * Report-type dropdown (all types; ones without a form page yet are "coming soon") plus Add button.
 * Props: onAdd(reportType), adding (an add is running), disabled (another action is running),
 * generalExists (the IDR already has its one main General, so that option is unavailable).
 */
export default function AddReportControl({ onAdd, adding, disabled, generalExists }) {
  const [reportType, setReportType] = useState('GEN')
  const optionSuffix = code => {
    if (!isReportTypeAvailable(code)) return ' (coming soon)'
    if (code === 'GEN' && generalExists) return ' (already added)'
    return ''
  }
  const canAdd = optionSuffix(reportType) === '' && !adding && !disabled

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <label htmlFor="add-report-type" className="text-sm font-medium text-gray-700">Add report</label>
      <select
        id="add-report-type"
        className="input-field sm:w-72"
        value={reportType}
        onChange={e => setReportType(e.target.value)}
      >
        {REPORT_TYPES.map(({ code, label }) => (
          <option key={code} value={code} disabled={optionSuffix(code) !== ''}>
            {label}{optionSuffix(code)}
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
