/**
 * Lists every submitted IDR for one project (route param :projectId), most recently edited first
 * (for a submitted IDR that is its submission time), with the inspector who submitted it.
 * Project-wide on purpose: submitted IDRs are shared project records, not per-inspector.
 * Clicking an IDR opens its IDR page read-only.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { listIdrs, listUsers } from '../services/api'
import IdrCard from '../components/IdrCard'

// Maps user_id (= an IDR's reporter_uuid) to a display name, falling back to email when a name is missing
function namesById(users) {
  return Object.fromEntries(users.map(u => [
    u.user_id,
    [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
  ]))
}

export default function ReportArchivePage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [idrs, setIdrs] = useState([])
  const [reporterNames, setReporterNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    Promise.all([listIdrs({ projectId, status: 'submitted' }), listUsers()])
      .then(([idrData, users]) => {
        if (ignore) return
        setIdrs(idrData)
        setReporterNames(namesById(users))
      })
      .catch(err => { if (!ignore) setError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [projectId, attempt])

  const openIdr = (idrId) => {
    navigate(`/project/${projectId}/idr/${idrId}`, { state: { from: 'archive' } })
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {idrs.map(idr => (
              <IdrCard
                key={idr.idr_id}
                idr={idr}
                reporterName={reporterNames[idr.reporter_uuid] || 'Unknown inspector'}
                onOpen={() => openIdr(idr.idr_id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
