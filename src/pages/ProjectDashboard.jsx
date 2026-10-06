import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getProjectById } from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
import NewIdrDateModal from '../components/NewIdrDateModal'

export default function ProjectDashboard() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [loadError, setLoadError] = useState(null) // the thrown Error; status 404 means the project doesn't exist
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [pickingIdrDate, setPickingIdrDate] = useState(false) // the "Pick a report date" dialog is open

  useEffect(() => {
    let ignore = false
    setLoadingProject(true)
    setLoadError(null)
    getProjectById(projectId)
      .then(data => { if (!ignore) setProject(data) })
      .catch(err => { if (!ignore) setLoadError(err) })
      .finally(() => { if (!ignore) setLoadingProject(false) })
    return () => { ignore = true }
  }, [projectId, attempt])


  if (loadingProject) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
      </div>
    )
  }

  if (loadError?.status === 404) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Project not found</h2>
          <button onClick={() => navigate('/projects')} className="mt-4 btn-primary">
            Back to Projects
          </button>
        </div>
      </div>
    )
  }

  if (loadError || !project) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-sm p-6 text-center max-w-md">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Couldn't load this project</h2>
          <p className="text-red-600 mb-6">{loadError?.message || 'No project data returned'}</p>
          <div className="flex justify-center space-x-3">
            <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">
              Retry
            </button>
            <button onClick={() => navigate('/projects')} className="btn-secondary">
              Back to Projects
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-gray-50">

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Back to Project List</span>
        </button>

        {/* Project Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="text-sm space-y-1">
            <p className="text-gray-600">
              <span className="font-medium text-construction-700">Contract No:</span>{' '}
              <span className="text-construction-900 font-bold">{project.project_id}</span>
            </p>
            {project.registration_code && (
              <p className="text-gray-600">
                <span className="font-medium text-construction-700">Reg. No:</span> {project.registration_code}
              </p>
            )}
            <p className="text-gray-600">
              <span className="font-medium text-construction-700">Project Name:</span> {project.project_name}
            </p>
            {project.project_description && (
              <p className="text-gray-600">
                <span className="font-medium text-construction-700">Description:</span> {project.project_description}
              </p>
            )}
            {project.borough && (
              <p className="text-gray-600">
                <span className="font-medium text-construction-700">Borough:</span> {project.borough}
              </p>
            )}
            {project.status && (
              <p className="text-gray-600">
                <span className="font-medium text-construction-700">Status:</span>{' '}
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  project.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {project.status}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => setPickingIdrDate(true)}
            className="bg-construction-600 text-white p-6 rounded-lg hover:bg-construction-700 transition-colors text-center"
          >
            <h3 className="font-bold text-lg">New Inspector Daily Diary</h3>
          </button>
          <button
            onClick={() => navigate(`/project/${projectId}/drafts`)}
            className="bg-gray-200 text-gray-700 p-6 rounded-lg hover:bg-gray-300 transition-colors text-center"
          >
            <h3 className="font-bold text-lg">Drafts</h3>
          </button>
          <button
            onClick={() => navigate(`/project/${projectId}/archive`)}
            className="bg-gray-200 text-gray-700 p-6 rounded-lg hover:bg-gray-300 transition-colors text-center"
          >
            <h3 className="font-bold text-lg">Report Archive</h3>
          </button>
        </div>

        {/* Admin only: who holds which role on this project */}
        {isAdmin(user) && (
          <button
            onClick={() => navigate(`/admin/projects/${projectId}/roles`)}
            className="flex items-center space-x-2 text-construction-700 hover:text-construction-800"
          >
            <Users className="h-5 w-5" />
            <span className="font-medium">Manage Roles</span>
          </button>
        )}
      </main>

      {pickingIdrDate && (
        <NewIdrDateModal
          projectId={projectId}
          onOpen={(idrId) => navigate(`/project/${projectId}/idr/${idrId}`)}
          onClose={() => setPickingIdrDate(false)}
        />
      )}
    </div>
  )
}
