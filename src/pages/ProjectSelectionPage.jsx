import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getProjectsForUser } from '../services/api'
import AppHeader from '../components/AppHeader'

export default function ProjectSelectionPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    if (!user) return
    getProjectsForUser()
      .then(data => setProjects(data))
      .catch(err => setFetchError(err.message))
      .finally(() => setLoadingProjects(false))
  }, [user])

  const handleProjectSelect = (projectId) => {
    navigate(`/project/${projectId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Pick A Project</h2>
          <p className="mt-2 text-gray-600">Select a project to begin your inspection report</p>
        </div>

        {/* Project List */}
        {loadingProjects && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-construction-600"></div>
          </div>
        )}

        {fetchError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
            Failed to load projects: {fetchError}
          </div>
        )}

        {!loadingProjects && !fetchError && projects.length === 0 && (
          <p className="text-gray-500 text-center py-16">No projects assigned to your account.</p>
        )}

        <div className="space-y-4">
          {projects.map((project) => (
            <button
              key={project.project_id}
              onClick={() => handleProjectSelect(project.project_id)}
              className="w-full text-left bg-white hover:bg-construction-50 border-2 border-transparent hover:border-construction-300 rounded-lg p-6 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-construction-700 mb-2">{project.project_id}</h3>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Description:</span> {project.project_name}
                    </p>
                    {project.borough && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Borough:</span> {project.borough}
                      </p>
                    )}
                    {project.status && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Status:</span>{' '}
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
                <div className="ml-4">
                  <div className="w-12 h-12 bg-construction-100 rounded-full flex items-center justify-center">
                    <span className="text-construction-700 text-xl">→</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Sign-up for Project Button */}
        <div className="mt-8 text-center">
          <button className="btn-secondary">
            Sign-up for a Project
          </button>
        </div>
      </main>
    </div>
  )
}
