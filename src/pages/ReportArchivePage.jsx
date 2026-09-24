/**
 * Lists every submitted report for one project (route param :projectId), newest submission first.
 * Project-wide on purpose: submitted reports are shared project records, not per-inspector.
 * Clicking a report opens it read-only in the General Form via ?report_id=.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { listReports } from '../services/api'

// Newest submission first; reports missing submitted_at sink to the bottom
const bySubmittedAtDesc = (a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || '')

export default function ReportArchivePage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    listReports({ projectId, status: 'submitted' })
      .then(data => { if (!ignore) setReports([...data].sort(bySubmittedAtDesc)) })
      .catch(err => { if (!ignore) setError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [projectId, attempt])

  const openReport = (reportId) => {
    navigate(`/project/${projectId}/report/general?report_id=${reportId}`, { state: { from: 'archive' } })
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
            <p className="text-red-600 mb-4">Couldn't load submitted reports: {error}</p>
            <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">
              Retry
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
            No submitted reports for this project yet. Submitted General reports will appear here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map(report => (
              <button
                key={report.report_id}
                onClick={() => openReport(report.report_id)}
                className="bg-white hover:bg-construction-50 border-2 border-transparent hover:border-construction-300 rounded-lg p-6 transition-all duration-200 shadow-sm hover:shadow-md text-left"
              >
                <div className="flex items-start space-x-4">
                  <div className="bg-construction-100 p-3 rounded-lg">
                    <FileText className="h-6 w-6 text-construction-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-gray-900 mb-1">
                      {/* parseISO keeps a date-only string in local time (new Date() would shift it a day in US zones) */}
                      {report.report_date ? format(parseISO(report.report_date), 'EEE, MMM d, yyyy') : 'No date'}
                    </h3>
                    <p className={`text-sm mb-2 truncate ${report.description_preview ? 'text-gray-600' : 'text-gray-400 italic'}`}>
                      {report.description_preview || 'No description'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {/* No DB constraint guarantees submitted_at is set, so don't let a null crash the list */}
                      {report.submitted_at
                        ? `Submitted ${format(parseISO(report.submitted_at), 'MMM d, h:mm a')}`
                        : 'Submitted (date unknown)'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
