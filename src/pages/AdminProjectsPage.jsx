/**
 * Every project, at /admin/projects. Admins only: a table (project ID, name, description, borough, registration
 * code, status) in the backend's order, which is by project ID, and a "Create project" button that opens a dialog
 * for a new one. After a save the list is read again, so the new row shows what the backend wrote. A created
 * project is announced once, in a banner that goes when dismissed or when the dialog is opened again. Each row
 * has "Pay items", "Properties", "Task orders" and "Manage roles", which open that project's pay items,
 * properties and task orders (the project-level pages, /project/<id>/properties and /project/<id>/task-orders) and roles pages. Anyone who isn't an
 * admin is told so instead.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FolderPlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { createAdminProject, listAdminProjects } from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
import CreateProjectModal from '../components/CreateProjectModal'

export default function AdminProjectsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const admin = isAdmin(user)

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  const [creating, setCreating] = useState(false) // whether the Create Project dialog is open
  const [createdId, setCreatedId] = useState(null) // the project just created, for the one-time banner
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [refreshError, setRefreshError] = useState(null) // a save worked but the list couldn't be read again

  useEffect(() => {
    if (!admin) return
    let ignore = false
    setLoading(true)
    setLoadError(null)
    setRefreshError(null)
    listAdminProjects()
      .then(data => { if (!ignore) setProjects(data) })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [admin, attempt])

  const startCreating = () => {
    setSaveError(null)
    setCreatedId(null)
    setCreating(true)
  }

  // A refusal is shown as the backend worded it: a taken project ID, or the value that doesn't fit.
  // On success the list is read again rather than guessing what the backend wrote.
  const create = async (values) => {
    setBusy(true)
    setSaveError(null)
    let created
    try {
      created = await createAdminProject(values)
    } catch (err) {
      setSaveError(err.message)
      setBusy(false)
      return
    }
    try {
      setProjects(await listAdminProjects())
      setRefreshError(null)
    } catch (err) {
      setRefreshError(`The project was created, but the list couldn't be refreshed: ${err.message}`)
    }
    setBusy(false)
    setCreatedId(created?.project_id ?? values.project_id)
    setCreating(false)
  }

  const back = (
    <button
      onClick={() => navigate('/projects')}
      className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="font-medium">Back to Projects</span>
    </button>
  )

  if (!admin) {
    return (
      <div className="flex-1 bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {back}
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
            Only an admin can manage projects.
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {back}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">All Projects (Admin)</h2>
          <button type="button" onClick={startCreating} className="btn-primary inline-flex items-center space-x-2">
            <FolderPlus className="h-4 w-4" />
            <span>Create project</span>
          </button>
        </div>

        {createdId && (
          <div role="status" className="flex items-start justify-between gap-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-md px-4 py-3 mb-4">
            <p>Created project <span className="font-medium">{createdId}</span>.</p>
            <button type="button" onClick={() => setCreatedId(null)} className="underline font-medium">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load the projects: {loadError}</p>
            <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
          </div>
        ) : (
          <>
            {refreshError && (
              <p role="alert" className="text-sm text-red-600 mb-4">
                {refreshError}{' '}
                <button type="button" onClick={() => setAttempt(a => a + 1)} className="underline font-medium">Retry</button>
              </p>
            )}

            {projects.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
                No projects to show.
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Project ID', 'Name', 'Description', 'Borough', 'Registration Code', 'Status', 'Actions'].map(heading => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {projects.map(row => (
                      <tr key={row.project_id}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.project_id}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{row.project_name || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{row.project_description || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{row.borough || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{row.registration_code || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{row.status || '—'}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/projects/${row.project_id}/pay-items`)}
                              className="btn-secondary whitespace-nowrap"
                            >
                              Pay items
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/project/${row.project_id}/properties`)}
                              className="btn-secondary whitespace-nowrap"
                            >
                              Properties
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/project/${row.project_id}/task-orders`)}
                              className="btn-secondary whitespace-nowrap"
                            >
                              Task orders
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/projects/${row.project_id}/roles`)}
                              className="btn-secondary whitespace-nowrap"
                            >
                              Manage roles
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {creating && (
          <CreateProjectModal
            onCreate={create}
            onCancel={() => setCreating(false)}
            busy={busy}
            error={saveError}
          />
        )}
      </main>
    </div>
  )
}
