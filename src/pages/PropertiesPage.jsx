/**
 * One project's properties (route param :projectId), at /project/:projectId/properties, reached from the project
 * page's "Properties". For anyone on the project: a table (BBL, a link to the property's page; address, type, PIR,
 * added) in the backend's order, which is by address. A member who isn't a demo user also gets "Add property" beside
 * the heading and Edit on each row; both share one dialog. The destructive controls are an admin's alone: Delete (a
 * soft delete) on each row, and "Show deleted" (off to start), which asks the backend for the list again with
 * soft-deleted properties in it; a deleted one is muted, its BBL crossed out, and has "Un-delete" instead. Delete
 * and Un-delete are confirmed first. After every change the list is read again, and a delete or un-delete is
 * announced in a toast. The backend refuses anyone not on the project (403), which shows as the load error.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { createProperty, listProperties, updateProperty } from '../services/api'
import { PROPERTY_ACTIONS } from '../lib/properties'
import { isAdmin } from '../lib/reviewRoles'
import ConfirmDialog from '../components/ConfirmDialog'
import PropertiesTable from '../components/PropertiesTable'
import PropertyFormModal from '../components/PropertyFormModal'
import Toast from '../components/Toast'

export const EMPTY_TEXT = "No properties yet. Click 'Add property' to start."
export const EMPTY_TEXT_READ_ONLY = 'No properties yet.'
export const DEMO_NOTE = 'Demo mode: properties are read-only.'

const isDeleted = (row) => Boolean(row.deleted_at)

export default function PropertiesPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const admin = isAdmin(user)
  const writer = !user?.is_demo // the backend keeps demo users read-only on properties

  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false) // whether there is a list to keep on screen while it is read again
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [showDeleted, setShowDeleted] = useState(false)
  const includeDeleted = admin && showDeleted // only an admin's list has deleted properties

  const [form, setForm] = useState(null) // the open Add / Edit dialog: {mode: 'add'} or {mode: 'edit', property}
  const [pending, setPending] = useState(null) // {row, action}: the delete or un-delete waiting to be confirmed
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null) // the open dialog's failed action: the thrown error
  const [refreshError, setRefreshError] = useState(null) // a change worked but the list couldn't be read again

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setLoadError(null)
    setRefreshError(null)
    listProperties(projectId, { includeDeleted })
      .then(found => {
        if (ignore) return
        setProperties(found)
        setLoaded(true)
      })
      .catch(err => {
        if (ignore) return
        setLoadError(err.message)
        setLoaded(false)
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [projectId, includeDeleted, attempt])

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
      setProperties(await listProperties(projectId, { includeDeleted }))
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

  // A row's controls for a writer: Edit on a live row; Delete, and Un-delete on a deleted row, for an admin
  const renderActions = row => (isDeleted(row) ? (admin && (
    <button
      type="button"
      onClick={() => open(() => setPending({ row, action: 'undelete' }))}
      className="btn-secondary"
    >
      Un-delete
    </button>
  )) : (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => open(() => setForm({ mode: 'edit', property: row }))}
        className="btn-secondary"
      >
        Edit
      </button>
      {admin && (
        <button
          type="button"
          onClick={() => open(() => setPending({ row, action: 'delete' }))}
          className="btn-secondary text-red-600 hover:text-red-700"
        >
          Delete
        </button>
      )}
    </div>
  ))

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

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Properties — {projectId}</h2>
          {writer && (
            <button
              type="button"
              onClick={() => open(() => setForm({ mode: 'add' }))}
              disabled={!loaded}
              className="btn-primary inline-flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add property</span>
            </button>
          )}
        </div>

        {!writer && <p className="text-sm text-gray-600 mb-4">{DEMO_NOTE}</p>}

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
            {admin && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-sm text-gray-700">
                <label className="inline-flex items-center space-x-2">
                  <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
                  <span>Show deleted</span>
                </label>
                {loading && <span className="text-gray-500">Loading...</span>}
              </div>
            )}

            {refreshError && (
              <p role="alert" className="text-sm text-red-600 mb-4">
                {refreshError}{' '}
                <button type="button" onClick={() => setAttempt(a => a + 1)} className="underline font-medium">Retry</button>
              </p>
            )}

            {properties.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
                {writer ? EMPTY_TEXT : EMPTY_TEXT_READ_ONLY}
              </div>
            ) : (
              <PropertiesTable
                properties={properties}
                showPirStatus
                renderActions={writer ? renderActions : undefined}
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
