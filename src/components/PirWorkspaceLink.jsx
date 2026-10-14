import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PenTool } from 'lucide-react'
import { listPirPages } from '../services/api'

/**
 * The PIR card's way into the sketch workspace (PirPage): how many pages the PIR has ("3 pages", "No pages uploaded
 * yet") and "Open sketch workspace". The count is read with the PIR's pages; while it loads the line reads
 * "Loading pages...", and if it fails it says so, the button still working.
 * Props: pir (id), projectId, propertyId.
 */
export default function PirWorkspaceLink({ pir, projectId, propertyId }) {
  const navigate = useNavigate()
  const [count, setCount] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let ignore = false
    setCount(null)
    setError(null)
    listPirPages(pir.id)
      .then(pages => { if (!ignore) setCount(pages.length) })
      .catch(err => { if (!ignore) setError(err.message) })
    return () => { ignore = true }
  }, [pir.id])

  const line = error
    ? `Couldn't read the pages: ${error}`
    : count === null ? 'Loading pages...'
      : count === 0 ? 'No pages uploaded yet' : `${count} ${count === 1 ? 'page' : 'pages'}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className={`text-sm ${error ? 'text-red-600' : 'text-gray-700'}`}>{line}</p>
      <button
        type="button"
        onClick={() => navigate(`/project/${projectId}/properties/${propertyId}/pir`)}
        className="btn-primary inline-flex items-center space-x-2"
      >
        <PenTool className="h-4 w-4" />
        <span>Open sketch workspace</span>
      </button>
    </div>
  )
}
