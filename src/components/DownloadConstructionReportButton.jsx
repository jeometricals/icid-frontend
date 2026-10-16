import { useState } from 'react'
import { FileDown } from 'lucide-react'

export const NOT_COVERED = 'No approved IDR has claimed this site’s flags yet.'

/**
 * A Construction Report download button (R1h), for a property's PDF or an IDR's ZIP: while the file is made the button
 * is off and a spinner says so; a failure shows its message under it. A 422 (a sketch too large for one sheet) and a
 * 404 can't be fixed by trying again; anything else gets Retry.
 * Props: label, download (the call that fetches and saves the file), enabled (false: off, with disabledTitle as its
 * tooltip) and disabledTitle.
 */
export default function DownloadConstructionReportButton({ label, download, enabled = true, disabledTitle }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'working' | 'error'
  const [error, setError] = useState(null) // { message, canRetry }

  const run = async () => {
    if (status === 'working') return
    setStatus('working')
    setError(null)
    try {
      await download()
      setStatus('idle')
    } catch (err) {
      // The backend's own words for a 422 and a 404 (SKETCH_TOO_LARGE_MESSAGE, "No approved IDR covers ...")
      const final = err.status === 422 || err.status === 404
      setError({ message: final ? err.message : `Download failed: ${err.message}`, canRetry: !final })
      setStatus('error')
    }
  }

  const working = status === 'working'
  return (
    <div className="flex flex-col items-end space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={!enabled || working}
        title={enabled ? undefined : disabledTitle}
        className="btn-secondary inline-flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FileDown className="h-4 w-4" />
        <span>{label}</span>
      </button>
      {working && (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <div role="status" className="animate-spin rounded-full h-4 w-4 border-b-2 border-construction-600"></div>
          <span>Making the report…</span>
        </div>
      )}
      {status === 'error' && (
        <div role="alert" className="flex items-center space-x-3 text-sm text-red-600 max-w-md text-right">
          <span>{error.message}</span>
          {error.canRetry && (
            <button type="button" onClick={run} className="btn-secondary text-sm">Retry</button>
          )}
        </div>
      )}
    </div>
  )
}
