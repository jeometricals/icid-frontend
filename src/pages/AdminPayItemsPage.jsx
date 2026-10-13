/**
 * One project's pay items (route param :projectId), at /admin/projects/:projectId/pay-items. Admins only: a table
 * (pay item ref, description, unit, quantity, unit price, budget code) in the backend's order, which is by budget
 * code then ref, with Edit and Delete on each row, and "Add pay item" and "Clear all pay items" beside the
 * heading, with "Import CSV" between them. Add and Edit share one dialog; after a save the list is read again, so
 * a row shows what the backend wrote and sits where the backend sorts it. Delete and Clear all are confirmed
 * first. Import CSV opens a dialog that previews a file and then imports it, after which the list is read again.
 * A cleared list and an import are each announced once, in a banner that goes when dismissed or when a dialog is
 * opened. The project's name, for the heading, comes from the admin project list. Anyone who isn't an admin is
 * told so instead.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Upload } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  clearProjectPayItems, createProjectPayItem, deleteProjectPayItem, listAdminProjects, listProjectPayItems,
  updateProjectPayItem,
} from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
import { formatPayItemQuantity, formatUnitPrice } from '../lib/payItemFormat'
import ConfirmDialog from '../components/ConfirmDialog'
import PayItemFormModal from '../components/PayItemFormModal'
import PayItemImportModal from '../components/PayItemImportModal'

// How much of a description the Delete confirmation quotes
export const DELETE_DESCRIPTION_LENGTH = 60

const HEADINGS = [
  { label: 'Pay Item Ref' },
  { label: 'Description' },
  { label: 'Unit' },
  { label: 'Quantity', right: true },
  { label: 'Unit Price', right: true },
  { label: 'Budget Code' },
  { label: 'Actions' },
]

const countOf = (count) => `${count} pay item${count === 1 ? '' : 's'}`

const shortened = (text) => (
  text.length > DELETE_DESCRIPTION_LENGTH ? `${text.slice(0, DELETE_DESCRIPTION_LENGTH)}…` : text
)

export default function AdminPayItemsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const admin = isAdmin(user)

  const [items, setItems] = useState([])
  const [projectName, setProjectName] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  const [form, setForm] = useState(null) // the open Add / Edit dialog: {mode: 'add'} or {mode: 'edit', item}
  const [deleting, setDeleting] = useState(null) // the pay item whose deletion is being confirmed
  const [clearing, setClearing] = useState(false) // whether Clear all is being confirmed
  const [importing, setImporting] = useState(false) // whether the Import CSV dialog is open
  const [notice, setNotice] = useState(null) // what the one-time banner says: a clear or an import that went through
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null) // why the open dialog's action failed
  const [refreshError, setRefreshError] = useState(null) // a change worked but the list couldn't be read again

  useEffect(() => {
    if (!admin) return
    let ignore = false
    setLoading(true)
    setLoadError(null)
    setRefreshError(null)
    Promise.all([listProjectPayItems(projectId), listAdminProjects()])
      .then(([found, projects]) => {
        if (ignore) return
        setItems(found)
        setProjectName(projects.find(project => project.project_id === projectId)?.project_name ?? null)
      })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [admin, projectId, attempt])

  // Opens one of the dialogs, forgetting the last one's error and the banner
  const open = (show) => {
    setActionError(null)
    setNotice(null)
    show()
  }

  // Reads the list again rather than guessing what the backend wrote
  const reread = async () => {
    try {
      setItems(await listProjectPayItems(projectId))
      setRefreshError(null)
    } catch (err) {
      setRefreshError(`The change was saved, but the list couldn't be refreshed: ${err.message}`)
    }
  }

  // Runs the open dialog's action, then what follows it, with the dialog locked throughout. A refusal is shown
  // in the dialog as the backend worded it (a ref the budget code already has, or a value that doesn't fit) and
  // what follows is skipped.
  const run = async (action, after) => {
    setBusy(true)
    setActionError(null)
    let result
    try {
      result = await action()
    } catch (err) {
      setActionError(err.message)
      setBusy(false)
      return
    }
    await after(result)
    setBusy(false)
  }

  const save = (values) => run(
    form.mode === 'add'
      ? () => createProjectPayItem(projectId, values)
      : () => updateProjectPayItem(projectId, form.item.pay_item_uuid, values),
    async () => {
      await reread()
      setForm(null)
    },
  )

  const remove = () => run(
    () => deleteProjectPayItem(projectId, deleting.pay_item_uuid),
    () => {
      setItems(current => current.filter(item => item.pay_item_uuid !== deleting.pay_item_uuid))
      setDeleting(null)
    },
  )

  const clear = () => run(
    () => clearProjectPayItems(projectId),
    async (cleared) => {
      setNotice(`Cleared ${countOf(cleared?.deleted_count ?? items.length)} from ${projectId}.`)
      setItems([])
      setClearing(false)
      await reread()
    },
  )

  // The import dialog ran the import itself and is closing
  const imported = ({ inserted, updated }) => {
    setNotice(`Imported ${inserted} new and ${updated} updated pay items.`)
    reread()
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
            Only an admin can manage pay items.
          </div>
        </main>
      </div>
    )
  }

  const listed = !loading && !loadError

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {back}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Pay Items — {projectId}{projectName ? ` ${projectName}` : ''}
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => open(() => setClearing(true))}
              disabled={!listed || items.length === 0}
              className="btn-secondary inline-flex items-center space-x-2 text-red-600 hover:text-red-700 disabled:text-gray-400"
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear all pay items</span>
            </button>
            <button
              type="button"
              onClick={() => open(() => setImporting(true))}
              disabled={!listed}
              className="btn-secondary inline-flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>Import CSV</span>
            </button>
            <button
              type="button"
              onClick={() => open(() => setForm({ mode: 'add' }))}
              disabled={!listed}
              className="btn-primary inline-flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add pay item</span>
            </button>
          </div>
        </div>

        {notice && (
          <div role="status" className="flex items-start justify-between gap-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-md px-4 py-3 mb-4">
            <p>{notice}</p>
            <button type="button" onClick={() => setNotice(null)} className="underline font-medium">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load the pay items: {loadError}</p>
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

            {items.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
                No pay items yet for this project. Click Add pay item to add one manually, or Import CSV to
                bulk-seed from a file.
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {HEADINGS.map(({ label, right }) => (
                        <th
                          key={label}
                          scope="col"
                          className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${right ? 'text-right' : 'text-left'}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map(item => (
                      <tr key={item.pay_item_uuid}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{item.pay_item_ref}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <p title={item.description} className="line-clamp-2 max-w-md">{item.description}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{item.unit}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right tabular-nums whitespace-nowrap">
                          {formatPayItemQuantity(item.quantity)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right tabular-nums whitespace-nowrap">
                          {formatUnitPrice(item.unit_price)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{item.budget_code}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => open(() => setForm({ mode: 'edit', item }))}
                              className="btn-secondary"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => open(() => setDeleting(item))}
                              className="btn-secondary text-red-600 hover:text-red-700"
                            >
                              Delete
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

        {form && (
          <PayItemFormModal
            mode={form.mode}
            initial={form.item}
            onSave={save}
            onCancel={() => setForm(null)}
            busy={busy}
            error={actionError}
          />
        )}

        {importing && (
          <PayItemImportModal projectId={projectId} onClose={() => setImporting(false)} onImported={imported} />
        )}

        {deleting && (
          <ConfirmDialog
            title="Delete pay item?"
            message={`This will remove ${deleting.pay_item_ref} (${shortened(deleting.description)}) from ${deleting.budget_code}. This can't be undone.`}
            confirmLabel="Delete"
            cancelLabel="Cancel"
            onConfirm={remove}
            onCancel={() => setDeleting(null)}
            busy={busy}
            error={actionError}
          />
        )}

        {clearing && (
          <ConfirmDialog
            title="Clear all pay items?"
            message={`This will remove all ${countOf(items.length)} from ${projectId}. This can't be undone.`}
            confirmLabel="Clear all"
            cancelLabel="Cancel"
            onConfirm={clear}
            onCancel={() => setClearing(false)}
            busy={busy}
            error={actionError}
          />
        )}
      </main>
    </div>
  )
}
