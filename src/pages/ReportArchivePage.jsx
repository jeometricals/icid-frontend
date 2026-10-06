/**
 * Lists every IDR on one project (route param :projectId) that has been submitted, wherever it now stands in
 * review: submitted, in Stage 1 or Stage 2 review, or approved. Sorted by work date, newest first. Each row shows
 * the IDR #, its status, the inspector, the latest reviewer and when it was submitted.
 * Project-wide on purpose: submitted IDRs are shared project records, not per-inspector.
 * Clicking an IDR opens its IDR page read-only. No filters yet.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { listIdrs } from '../services/api'
import IdrTable from '../components/IdrTable'

// Newest work date first; on the same day, the most recently submitted first
function byWorkDate(a, b) {
  return b.report_date.localeCompare(a.report_date) || (b.submitted_at || '').localeCompare(a.submitted_at || '')
}

export default function ReportArchivePage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [idrs, setIdrs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    // No status filter: the archive spans every status after draft. The list still carries the user's own drafts
    // (a returned IDR among them), which belong on the Drafts page.
    listIdrs({ projectId })
      .then(data => { if (!ignore) setIdrs(data.filter(idr => idr.status !== 'draft').sort(byWorkDate)) })
      .catch(err => { if (!ignore) setError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [projectId, attempt])

  const openIdr = (idr) => {
    navigate(`/project/${projectId}/idr/${idr.idr_id}`, { state: { from: 'archive' } })
  }

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(`/project/${projectId}`)}
          className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Back to Project Page</span>
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">Report Archive — {projectId}</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load submitted IDRs: {error}</p>
            <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">
              Retry
            </button>
          </div>
        ) : idrs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
            No submitted IDRs for this project yet. Submitted IDRs will appear here.
          </div>
        ) : (
          <IdrTable idrs={idrs} onOpen={openIdr} />
        )}
      </main>
    </div>
  )
}
