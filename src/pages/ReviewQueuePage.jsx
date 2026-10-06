/**
 * The signed-in reviewer's queues at /review, across every project they review on: a Stage 1 tab (IDRs waiting to
 * be picked up and those in Stage 1 review) for an OE or RE, and a Stage 2 tab for an RE; an admin sees both, for
 * every project. Oldest submission first. Clicking an IDR opens its page, whose Back button returns here.
 * A user who reviews nothing is told so instead.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useProjectRoles } from '../contexts/ProjectRolesContext'
import { getReviewQueue } from '../services/api'
import { reviewQueuesFor } from '../lib/reviewRoles'
import IdrTable from '../components/IdrTable'

// Oldest submission first, as each queue comes from the backend; needed again once two statuses are merged
function bySubmission(a, b) {
  return (a.submitted_at || '').localeCompare(b.submitted_at || '')
}

export default function ReviewQueuePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { rolesByProject, error: rolesError, reload: reloadRoles } = useProjectRoles()
  const rolesLoading = rolesByProject === null
  const queues = rolesLoading ? [] : reviewQueuesFor(user, rolesByProject)
  const queueIds = queues.map(q => q.id).join(',')

  const [rowsByQueue, setRowsByQueue] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [selected, setSelected] = useState(null) // the open tab's queue id; null means the first

  useEffect(() => {
    if (rolesLoading) return
    const wanted = reviewQueuesFor(user, rolesByProject)
    if (wanted.length === 0) {
      setLoading(false)
      return
    }
    let ignore = false
    setLoading(true)
    setError(null)
    Promise.all(wanted.map(queue => Promise.all(queue.statuses.map(getReviewQueue))))
      .then(results => {
        if (ignore) return
        setRowsByQueue(Object.fromEntries(wanted.map((queue, i) => [queue.id, results[i].flat().sort(bySubmission)])))
      })
      .catch(err => { if (!ignore) setError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
    // queueIds stands for the queues: they only change when the user's roles do
  }, [rolesLoading, queueIds, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  const openIdr = (idr) => {
    navigate(`/project/${idr.project_id}/idr/${idr.idr_id}`, { state: { from: 'review' } })
  }

  const current = queues.find(q => q.id === selected) || queues[0]
  const rows = current ? rowsByQueue[current.id] || [] : []

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Back to Projects</span>
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">My Queue</h2>

        {rolesLoading || (loading && queues.length > 0) ? (
          <div className="flex justify-center py-12">
            <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
          </div>
        ) : rolesError ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load your review roles: {rolesError}</p>
            <button onClick={reloadRoles} className="btn-primary">Retry</button>
          </div>
        ) : queues.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
            You don't review IDRs on any project, so there is nothing in your queue.
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load your queue: {error}</p>
            <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="Review queues" className="flex space-x-2 border-b border-gray-200 mb-6">
              {queues.map(queue => {
                const isCurrent = queue.id === current.id
                return (
                  <button
                    key={queue.id}
                    type="button"
                    role="tab"
                    aria-selected={isCurrent}
                    onClick={() => setSelected(queue.id)}
                    className={`px-4 py-2 -mb-px border-b-2 text-sm font-medium ${isCurrent
                      ? 'border-construction-600 text-construction-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                    {queue.label} ({(rowsByQueue[queue.id] || []).length})
                  </button>
                )
              })}
            </div>
            <div role="tabpanel" aria-label={`${current.label} queue`}>
              {rows.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
                  Nothing is waiting in {current.label}.
                </div>
              ) : (
                <IdrTable idrs={rows} onOpen={openIdr} showProject />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
