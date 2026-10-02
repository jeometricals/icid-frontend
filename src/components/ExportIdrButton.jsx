import { useState } from 'react'
import { Download } from 'lucide-react'
import { generateExport } from '../services/api'

const PREPARING = 'Preparing export… this can take up to a minute with photos'
const DELETED = 'This IDR no longer exists, so it can’t be exported.'

/**
 * Export button for an IDR: downloads it as .xlsx on the DDC report forms. While the export runs the button is
 * disabled and a spinner explains the wait; a failure shows its message with Retry (a deleted IDR can't be retried).
 * Props: idrId, isDraft (labels it "Export Draft (.xlsx)" rather than "Export (.xlsx)"), disabled (e.g. no reports
 * yet, or another action is running).
 */
export default function ExportIdrButton({ idrId, isDraft, disabled = false }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'exporting' | 'error'
  const [error, setError] = useState(null) // { message, canRetry }

  const runExport = async () => {
    if (status === 'exporting') return
    setStatus('exporting')
    setError(null)
    try {
      await generateExport(idrId)
      setStatus('idle')
    } catch (err) {
      const gone = err.status === 404
      setError({ message: gone ? DELETED : `Export failed: ${err.message}`, canRetry: !gone })
      setStatus('error')
    }
  }

  const exporting = status === 'exporting'
  return (
    <div className="flex flex-col items-end space-y-2">
      <button
        type="button"
        onClick={runExport}
        disabled={disabled || exporting}
        className="btn-secondary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="h-4 w-4" />
        <span>{isDraft ? 'Export Draft (.xlsx)' : 'Export (.xlsx)'}</span>
      </button>
      {exporting && (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <div role="status" className="animate-spin rounded-full h-4 w-4 border-b-2 border-construction-600"></div>
          <span>{PREPARING}</span>
        </div>
      )}
      {status === 'error' && (
        <div role="alert" className="flex items-center space-x-3 text-sm text-red-600">
          <span>{error.message}</span>
          {error.canRetry && (
            <button type="button" onClick={runExport} className="btn-secondary text-sm">
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}
