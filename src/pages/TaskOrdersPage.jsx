/**
 * One project's task orders (route param :projectId), at /project/:projectId/task-orders, reached from the
 * project page's "Task Order" tile. A "Site Info" link in the header leads to the project's properties (the sites
 * a task order bundles). For anyone on the project: a table (number, issued, how many properties) in the
 * backend's order, which is by number. A number opens its task order's page. A member who isn't a demo user also
 * gets "Add task order" beside the heading and Edit on each row; both share one dialog. The destructive controls
 * are an admin's alone: Delete (a soft delete) on each row, and "Show deleted" (off to start), which asks the
 * backend for the list again with soft-deleted task orders in it; a deleted one is muted, its number crossed out,
 * and has "Un-delete" instead. Delete and Un-delete are confirmed first. After every change the list is read
 * again, and a delete or un-delete is announced in a toast. The backend refuses anyone not on the project (403),
 * which shows as the load error.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { createTaskOrder, listTaskOrders, updateTaskOrder } from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
import { shortDate } from '../lib/shortDate'
import { TASK_ORDER_ACTIONS, propertyCount } from '../lib/taskOrders'
import ConfirmDialog from '../components/ConfirmDialog'
import StatusBadge from '../components/StatusBadge'
import TaskOrderFormModal from '../components/TaskOrderFormModal'
import Toast from '../components/Toast'

export const EMPTY_TEXT = "No task orders yet. Click 'Add task order' to start."
export const EMPTY_TEXT_READ_ONLY = 'No task orders yet.'

const isDeleted = (row) => Boolean(row.deleted_at)

export const DEMO_NOTE = 'Demo mode: task orders are read-only.'

export default function TaskOrdersPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const admin = isAdmin(user)
  const writer = !user?.is_demo // the backend keeps demo users read-only on task orders

  const [taskOrders, setTaskOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false) // whether there is a list to keep on screen while it is read again
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [showDeleted, setShowDeleted] = useState(false)
  const includeDeleted = admin && showDeleted // only an admin's list has deleted task orders

  const [form, setForm] = useState(null) // the open Add / Edit dialog: {mode: 'add'} or {mode: 'edit', taskOrder}
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
    listTaskOrders(projectId, { includeDeleted })
      .then(found => {
        if (ignore) return
        setTaskOrders(found)
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
      setTaskOrders(await listTaskOrders(projectId, { includeDeleted }))
      setRefreshError(null)
    } catch (err) {
      setRefreshError(`The change was saved, but the list couldn't be refreshed: ${err.message}`)
    }
    setBusy(false)
    return true
  }

  const save = async (values) => {
    const saved = await run(form.mode === 'add'
      ? () => createTaskOrder(projectId, values)
      : () => updateTaskOrder(form.taskOrder.id, values))
    if (saved) setForm(null)
  }

  const confirm = async () => {
    const { row, action } = pending
    if (!(await run(() => TASK_ORDER_ACTIONS[action].run(row)))) return
    setToast(TASK_ORDER_ACTIONS[action].done(row))
    setPending(null)
  }

  const back = (
    <button
      onClick={() => navigate(`/project/${projectId}`)}
      className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="font-medium">Back to Project Page</span>
    </button>
  )

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {back}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Task Orders — {projectId}</h2>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to={`/project/${projectId}/properties`}
              className="text-sm font-medium text-construction-700 hover:text-construction-800 hover:underline"
            >
              Site Info
            </Link>
            {writer && (
              <button
                type="button"
                onClick={() => open(() => setForm({ mode: 'add' }))}
                disabled={!loaded}
                className="btn-primary inline-flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add task order</span>
              </button>
            )}
          </div>
        </div>

        {!writer && <p className="text-sm text-gray-600 mb-4">{DEMO_NOTE}</p>}

        {loading && !loaded ? (
          <div className="flex justify-center py-12">
            <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load the task orders: {loadError}</p>
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

            {taskOrders.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
                {writer ? EMPTY_TEXT : EMPTY_TEXT_READ_ONLY}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Number', 'Issued', 'Properties', ...(writer ? ['Actions'] : [])].map(heading => (
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
                    {taskOrders.map(row => {
                      const deleted = isDeleted(row)
                      return (
                        <tr key={row.id} data-deleted={deleted || undefined} className={deleted ? 'bg-gray-50 text-gray-400' : 'text-gray-900'}>
                          <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              <Link
                                to={`/project/${projectId}/task-orders/${row.id}`}
                                className={deleted ? 'line-through hover:underline' : 'text-construction-700 hover:underline'}
                              >
                                {row.task_order_number}
                              </Link>
                              {deleted && (
                                <span title={`Deleted ${format(parseISO(row.deleted_at), 'MMM d, yyyy')}`}>
                                  <StatusBadge status="deleted" />
                                </span>
                              )}
                            </span>
                          </td>
                          <td className={`px-6 py-4 text-sm whitespace-nowrap ${deleted ? '' : 'text-gray-600'}`}>
                            {row.issued_date ? shortDate(row.issued_date) : '—'}
                          </td>
                          <td className={`px-6 py-4 text-sm whitespace-nowrap ${deleted ? '' : 'text-gray-600'}`}>
                            {propertyCount(row.property_count)}
                          </td>
                          {writer && (
                            <td className="px-6 py-4 text-sm">
                              {deleted ? (admin && (
                                <button
                                  type="button"
                                  onClick={() => open(() => setPending({ row, action: 'undelete' }))}
                                  className="btn-secondary"
                                >
                                  Un-delete
                                </button>
                              )) : (
                                <div className="flex gap-2">
                                  {writer && (
                                    <button
                                      type="button"
                                      onClick={() => open(() => setForm({ mode: 'edit', taskOrder: row }))}
                                      className="btn-secondary"
                                    >
                                      Edit
                                    </button>
                                  )}
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
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {form && (
          <TaskOrderFormModal
            mode={form.mode}
            initial={form.taskOrder}
            onSave={save}
            onCancel={() => setForm(null)}
            busy={busy}
            error={actionError}
          />
        )}

        {pending && (
          <ConfirmDialog
            title={TASK_ORDER_ACTIONS[pending.action].title(pending.row)}
            message={TASK_ORDER_ACTIONS[pending.action].message(pending.row)}
            confirmLabel={TASK_ORDER_ACTIONS[pending.action].confirmLabel}
            cancelLabel="Cancel"
            confirmClassName={TASK_ORDER_ACTIONS[pending.action].confirmClassName}
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
