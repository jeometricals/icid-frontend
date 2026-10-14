/**
 * One project's properties (route param :projectId), at /admin/projects/:projectId/properties. Admins only: a
 * table (BBL, a link to the property's page; address, type, added) in the backend's order, which is by address, with Edit and Delete on each
 * row and "Add property" beside the heading. Add and Edit share one dialog; Delete (a soft delete) is confirmed
 * first. "Show deleted" (off to start) asks the backend for the list again with soft-deleted properties in it;
 * a deleted one is muted, its BBL crossed out, and has "Un-delete" instead, also confirmed first. After every
 * change the list is read again, and a delete or un-delete is announced in a toast. The project's name, for the
 * heading, comes from the admin project list. Anyone who isn't an admin is told so instead.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { createProperty, listAdminProjects, listProperties, updateProperty } from '../services/api'
import { PROPERTY_ACTIONS } from '../lib/properties'
import { isAdmin } from '../lib/reviewRoles'
import ConfirmDialog from '../components/ConfirmDialog'
import PropertiesTable from '../components/PropertiesTable'
import PropertyFormModal from '../components/PropertyFormModal'
import Toast from '../components/Toast'

export const EMPTY_TEXT = "No properties yet. Click 'Add property' to start."

const isDeleted = (row) => Boolean(row.deleted_at)

export default function AdminPropertiesPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const admin = isAdmin(user)

  const [properties, setProperties] = useState([])
  const [projectName, setProjectName] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false) // whether there is a list to keep on screen while it is read again
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [showDeleted, setShowDeleted] = useState(false)

  const [form, setForm] = useState(null) // the open Add / Edit dialog: {mode: 'add'} or {mode: 'edit', property}
  const [pending, setPending] = useState(null) // {row, action}: the delete or un-delete waiting to be confirmed
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null) // the open dialog's failed action: the thrown error
  const [refreshError, setRefreshError] = useState(null) // a change worked but the list couldn't be read again

  useEffect(() => {
    if (!admin) return
    let ignore = false
    setLoading(true)
    setLoadError(null)
    setRefreshError(null)
    Promise.all([listProperties(projectId, { includeDeleted: showDeleted }), listAdminProjects()])
      .then(([found, projects]) => {
        if (ignore) return
        setProperties(found)
        setProjectName(projects.find(project => project.project_id === projectId)?.project_name ?? null)
        setLoaded(true)
      })
      .catch(err => {
        if (ignore) return
        setLoadError(err.message)
        setLoaded(false)
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [admin, projectId, showDeleted, attempt])

  // Opens one of the dialogs, forgetting the last one's error
  const open = (show) => {
    setActionError(null)
    show()
  }

  // Runs the open dialog's action, then reads the list again rather than guessing what the backend wrote.
  // A refusal stays in the dialog. Resolves to whether the action went through.
  const run = async (action) => {
    setBusy(true)
    setActionError(null)
    try {
      await action()
    } catch (err) {
      setActionError(err)
      setBusy(false)
      return false
    }
    try {
      setProperties(await listProperties(projectId, { includeDeleted: showDeleted }))
      setRefreshError(null)
    } catch (err) {
      setRefreshError(`The change was saved, but the list couldn't be refreshed: ${err.message}`)
    }
    setBusy(false)
    return true
  }

  const save = async (values) => {
    const saved = await run(form.mode === 'add'
      ? () => createProperty(projectId, values)
      : () => updateProperty(form.property.id, values))
    if (saved) setForm(null)
  }

  const confirm = async () => {
    const { row, action } = pending
    if (!(await run(() => PROPERTY_ACTIONS[action].run(row)))) return
    setToast(PROPERTY_ACTIONS[action].done(row))
    setPending(null)
  }

  const back = (
    <button
      onClick={() => navigate('/admin/projects')}
      className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="font-medium">Back to All Projects (Admin)</span>
    </button>
  )

  if (!admin) {
    return (
      <div className="flex-1 bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {back}
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
            Only an admin can manage properties.
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
          <h2 className="text-2xl font-bold text-gray-900">
            Properties — {projectId}{projectName ? ` ${projectName}` : ''}
          </h2>
          <button
            type="button"
            onClick={() => open(() => setForm({ mode: 'add' }))}
            disabled={!loaded}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add property</span>
          </button>
        </div>

        {loading && !loaded ? (
          <div className="flex justify-center py-12">
            <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load the properties: {loadError}</p>
            <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-sm text-gray-700">
              <label className="inline-flex items-center space-x-2">
                <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
                <span>Show deleted</span>
              </label>
              {loading && <span className="text-gray-500">Loading...</span>}
            </div>

            {refreshError && (
              <p role="alert" className="text-sm text-red-600 mb-4">
                {refreshError}{' '}
                <button type="button" onClick={() => setAttempt(a => a + 1)} className="underline font-medium">Retry</button>
              </p>
            )}

            {properties.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">{EMPTY_TEXT}</div>
            ) : (
              <PropertiesTable
                properties={properties}
                showPirStatus
                renderActions={row => (isDeleted(row) ? (
                  <button
                    type="button"
                    onClick={() => open(() => setPending({ row, action: 'undelete' }))}
                    className="btn-secondary"
                  >
                    Un-delete
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => open(() => setForm({ mode: 'edit', property: row }))}
                      className="btn-secondary"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => open(() => setPending({ row, action: 'delete' }))}
                      className="btn-secondary text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              />
            )}
          </>
        )}

        {form && (
          <PropertyFormModal
            mode={form.mode}
            initial={form.property}
            onSave={save}
            onCancel={() => setForm(null)}
            busy={busy}
            error={actionError}
          />
        )}

        {pending && (
          <ConfirmDialog
            title={PROPERTY_ACTIONS[pending.action].title(pending.row)}
            message={PROPERTY_ACTIONS[pending.action].message(pending.row)}
            confirmLabel={PROPERTY_ACTIONS[pending.action].confirmLabel}
            cancelLabel="Cancel"
            confirmClassName={PROPERTY_ACTIONS[pending.action].confirmClassName}
            onConfirm={confirm}
            onCancel={() => setPending(null)}
            busy={busy}
            error={actionError?.message ?? null}
          />
        )}

        <Toast message={toast} onDone={() => setToast(null)} />
      </main>
    </div>
  )
}
