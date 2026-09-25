/**
 * Lists the signed-in inspector's draft IDRs for one project (route param :projectId), newest edit first.
 * Clicking a draft opens its IDR page.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { listIdrs } from '../services/api'
import IdrCard from '../components/IdrCard'

export default function DraftsListPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    listIdrs({ projectId, reporterUuid: user.id, status: 'draft' })
      .then(data => { if (!ignore) setDrafts(data) })
      .catch(err => { if (!ignore) setError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [projectId, user.id, attempt])

  const openDraft = (idrId) => {
    navigate(`/project/${projectId}/idr/${idrId}`, { state: { from: 'drafts' } })
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

        <h2 className="text-2xl font-bold text-gray-900 mb-6">Drafts — {projectId}</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load drafts: {error}</p>
            <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">
              Retry
            </button>
          </div>
        ) : drafts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
            No draft IDRs for this project yet.{' '}
            <Link to={`/project/${projectId}`} className="font-medium text-construction-700 hover:text-construction-800 underline">
              Start a new IDR from the project page
            </Link>
            .
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drafts.map(draft => (
              <IdrCard key={draft.idr_id} idr={draft} onOpen={() => openDraft(draft.idr_id)} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
