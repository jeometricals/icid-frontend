import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { HardHat, LogOut, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { getProjectById, createIdr } from '../services/api'

export default function ProjectDashboard() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { signOut, user, isDemoMode } = useAuth()
  const [project, setProject] = useState(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const [loadError, setLoadError] = useState(null) // the thrown Error; status 404 means the project doesn't exist
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [creatingIdr, setCreatingIdr] = useState(false)
  const [createIdrError, setCreateIdrError] = useState(null)

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

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Opens today's IDR: creates it, or on 409 (one already exists for today) opens that one instead.
  // Either way the inspector just lands on their IDR; any other failure is shown under the button.
  const handleNewIdr = async () => {
    if (creatingIdr) return
    setCreatingIdr(true)
    setCreateIdrError(null)
    try {
      const idr = await createIdr({ projectId, reporterUuid: user.id, reportDate: format(new Date(), 'yyyy-MM-dd') })
      navigate(`/project/${projectId}/idr/${idr.idr_id}`)
    } catch (err) {
      if (err.status === 409 && err.body?.existing_idr_id) {
        navigate(`/project/${projectId}/idr/${err.body.existing_idr_id}`)
      } else {
        setCreateIdrError(err.message)
      }
    } finally {
      setCreatingIdr(false)
    }
  }

  if (loadingProject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
      </div>
    )
  }

  if (loadError?.status === 404) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="bg-construction-600 p-2 rounded-lg">
                <HardHat className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-construction-900">ICID Co.</h1>
                <p className="text-xs text-gray-500">Integrated Construction Information Database</p>
              </div>
            </div>

            {/* User Info */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-gray-900">
                    {user?.user_metadata?.full_name || user?.email || 'User'}
                  </div>
                  {isDemoMode && (
                    <div className="text-xs text-construction-600 font-medium">Demo Mode</div>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

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
          <div>
            <button
              onClick={handleNewIdr}
              disabled={creatingIdr}
              className="w-full h-full bg-construction-600 text-white p-6 rounded-lg hover:bg-construction-700 transition-colors text-center disabled:opacity-60 disabled:cursor-wait"
            >
              <h3 className="font-bold text-lg">{creatingIdr ? 'Opening...' : 'New Inspector Daily Diary'}</h3>
            </button>
            {createIdrError && (
              <p role="alert" className="mt-2 text-sm text-red-600">Couldn't start today's IDR: {createIdrError}</p>
            )}
          </div>
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

        {/* Back Button (bottom) */}
        <div className="text-center">
          <button onClick={() => navigate('/projects')} className="btn-secondary">
            Back to Project Page
          </button>
        </div>
      </main>
    </div>
  )
}
