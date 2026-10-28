import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FileDown } from 'lucide-react'


/**
 * A button that downloads a file the backend makes: a property's Construction Report, an IDR's ZIP of them, a
 * project's Assessment Summary. While the file is made the button is off and a spinner says so; a failure shows its
 * message under it. A 422 (e.g. a sketch too large for one sheet) and a 404 can't be fixed by trying again and show the
 * backend's own words; anything else gets Retry.
 * With formats (e.g. ['xlsx', 'csv']) the button opens a small menu of them ("XLSX", "CSV"; Esc or a click elsewhere
 * closes it) and download is called with the one picked; Retry downloads that one again.
 * Props: label, download (the call that fetches and saves the file; given the format when there are formats), enabled
 * (false: off, with disabledTitle as its tooltip), disabledTitle and formats.
 */
export default function DownloadFileButton({ label, download, enabled = true, disabledTitle, formats }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'working' | 'error'
  const [error, setError] = useState(null) // { message, canRetry }
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState(null) // the format last asked for
  const box = useRef(null)

  // A click elsewhere, or Esc, closes the menu
  useEffect(() => {
    if (!open) return undefined
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    const escape = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const run = async (format = picked) => {
    if (status === 'working') return
    setOpen(false)
    setPicked(format)
    setStatus('working')
    setError(null)
    try {
      await (formats ? download(format) : download())
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
    <div ref={box} className="relative flex flex-col items-end space-y-2">
      <button
        type="button"
        onClick={() => (formats ? setOpen(current => !current) : run())}
        disabled={!enabled || working}
        title={enabled ? undefined : disabledTitle}
        aria-haspopup={formats ? 'menu' : undefined}
        aria-expanded={formats ? open : undefined}
        className="btn-secondary inline-flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FileDown className="h-4 w-4" />
        <span>{label}</span>
        {formats && <ChevronDown className="h-4 w-4" />}
      </button>
      {formats && open && (
        <div role="menu" aria-label={label}
          className="absolute right-0 top-full z-10 mt-1 min-w-[8rem] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {formats.map(format => (
            <button key={format} type="button" role="menuitem" onClick={() => run(format)}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      {working && (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <div role="status" className="animate-spin rounded-full h-4 w-4 border-b-2 border-construction-600"></div>
          <span>Preparing the file…</span>
        </div>
      )}
      {status === 'error' && (
        <div role="alert" className="flex items-center space-x-3 text-sm text-red-600 max-w-md text-right">
          <span>{error.message}</span>
          {error.canRetry && (
            <button type="button" onClick={() => run()} className="btn-secondary text-sm">Retry</button>
          )}
        </div>
      )}
    </div>
  )
}
