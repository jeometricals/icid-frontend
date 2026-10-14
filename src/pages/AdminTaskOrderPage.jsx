/**
 * One task order (route param :taskOrderId), at /admin/task-orders/:taskOrderId. Admins only: its number with
 * Edit and Delete, a card with its issued date, estimate notes and who created it when, and its bundled
 * properties (those not deleted, by address) with Unbundle on each and "Add properties", which opens a picker of
 * the project's other properties. Edit shares the list page's dialog; Delete (a soft delete) and Unbundle are
 * confirmed first. A deleted task order reads Deleted, has only "Un-delete", and its bundle can't be changed (the
 * backend refuses bundling into it). After each change the page shows the task order the backend returned, and a
 * delete, un-delete, unbundle or batch of additions is announced in a toast. Back returns to the project's task
 * orders. Anyone who isn't an admin is told so instead.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getTaskOrder, listAdminUsers, unbundleProperty, updateTaskOrder } from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
import { personName } from '../lib/personName'
import { shortDate } from '../lib/shortDate'
import { TASK_ORDER_ACTIONS, propertyCount } from '../lib/taskOrders'
import ConfirmDialog from '../components/ConfirmDialog'
import PropertiesTable from '../components/PropertiesTable'
import PropertyPickerModal from '../components/PropertyPickerModal'
import StatusBadge from '../components/StatusBadge'
import TaskOrderFormModal from '../components/TaskOrderFormModal'
import Toast from '../components/Toast'

export const EMPTY_TEXT = "No properties bundled yet. Click 'Add properties' to pick from this project."

// What the toast says after the picker's batch: how many went in and, when one was refused, which and why
export function addedMessage({ added, failed }) {
  const done = added > 0 ? `Added ${propertyCount(added)}.` : 'No properties were added.'
  if (!failed) return done
  return `${done} Couldn't add ${failed.property.bbl}: ${failed.message} The rest weren't tried.`
}

const unbundleAction = {
  title: row => `Unbundle property ${row.bbl}?`,
  message: row => `${row.address} leaves this task order. It stays on the project and can be added again.`,
  confirmLabel: 'Unbundle',
  confirmClassName: 'btn-danger',
  done: row => `Property ${row.bbl} unbundled.`,
}

export default function AdminTaskOrderPage() {
  const { taskOrderId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const admin = isAdmin(user)

  const [taskOrder, setTaskOrder] = useState(null)
  const [creatorName, setCreatorName] = useState(null) // null until found; the card then reads the date alone
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
  // The action waiting to be confirmed: {kind: 'delete' | 'undelete'} or {kind: 'unbundle', property}
  const [pending, setPending] = useState(null)
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null) // the open dialog's failed action: the thrown error
  const [refreshError, setRefreshError] = useState(null) // a change worked but the task order couldn't be read again

  useEffect(() => {
    if (!admin) return
    let ignore = false
    setLoading(true)
    setLoadError(null)
    setRefreshError(null)
    getTaskOrder(taskOrderId)
      .then(found => { if (!ignore) setTaskOrder(found) })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [admin, taskOrderId, attempt])

  // The creator's name is a nicety: when the user list can't be read, or doesn't have them, the card gives the
  // date alone, as the IDR page's signed banner does
  const createdBy = taskOrder?.created_by
  useEffect(() => {
    if (!admin || !createdBy) return
    let ignore = false
    listAdminUsers({ include_deleted: true })
      .then(users => {
        if (!ignore) setCreatorName(personName(users.find(found => found.uuid === createdBy)) || null)
      })
      .catch(() => { if (!ignore) setCreatorName(null) })
    return () => { ignore = true }
  }, [admin, createdBy])

  const open = (show) => {
    setActionError(null)
    show()
  }

  // Runs the open dialog's action; the task order it resolves to is shown. A refusal stays in the dialog.
  // Resolves to whether the action went through.
  const run = async (action) => {
    setBusy(true)
    setActionError(null)
    try {
      setTaskOrder(await action())
    } catch (err) {
      setActionError(err)
      setBusy(false)
      return false
    }
    setBusy(false)
    return true
  }

  // Unbundling answers nothing, so the task order is read again after it
  const reread = async () => {
    try {
      const found = await getTaskOrder(taskOrderId)
      setRefreshError(null)
      return found
    } catch (err) {
      setRefreshError(`The change was saved, but the task order couldn't be refreshed: ${err.message}`)
      return taskOrder
    }
  }

  const save = async (values) => {
    if (await run(() => updateTaskOrder(taskOrder.id, values))) setEditing(false)
  }

  const confirm = async () => {
    const { kind, property } = pending
    const done = kind === 'unbundle'
      ? await run(async () => {
        await unbundleProperty(taskOrder.id, property.id)
        return reread()
      })
      : await run(() => TASK_ORDER_ACTIONS[kind].run(taskOrder))
    if (!done) return
    setToast(kind === 'unbundle' ? unbundleAction.done(property) : TASK_ORDER_ACTIONS[kind].done(taskOrder))
    setPending(null)
  }

  // The picker ran its batch and is closing: show where it got to
  const added = async (outcome) => {
    setPicking(false)
    setToast(addedMessage(outcome))
    if (outcome.taskOrder) setTaskOrder(outcome.taskOrder)
  }

  const backTo = taskOrder ? `/admin/projects/${taskOrder.project_id}/task-orders` : '/admin/projects'
  const back = (
    <button
      onClick={() => navigate(backTo)}
      className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="font-medium">{taskOrder ? `Back to Task orders — ${taskOrder.project_id}` : 'Back to All Projects (Admin)'}</span>
    </button>
  )

  if (!admin) {
    return (
      <div className="flex-1 bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {back}
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
            Only an admin can manage task orders.
          </div>
        </main>
      </div>
    )
  }

  if (loading && !taskOrder) {
    return (
      <div className="flex-1 bg-gray-50 flex justify-center py-12">
        <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex-1 bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {back}
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load the task order: {loadError}</p>
            <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
          </div>
        </main>
      </div>
    )
  }

  const deleted = Boolean(taskOrder.deleted_at)
  const properties = taskOrder.properties

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {back}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 inline-flex items-center gap-3">
            <span className={deleted ? 'line-through text-gray-400' : ''}>Task order {taskOrder.task_order_number}</span>
            {deleted && (
              <span title={`Deleted ${format(parseISO(taskOrder.deleted_at), 'MMM d, yyyy')}`}>
                <StatusBadge status="deleted" />
              </span>
            )}
          </h2>
          <div className="flex flex-wrap gap-3">
            {deleted ? (
              <button type="button" onClick={() => open(() => setPending({ kind: 'undelete' }))} className="btn-primary">
                Un-delete
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => open(() => setEditing(true))}
                  className="btn-secondary inline-flex items-center space-x-2"
                >
                  <Pencil className="h-4 w-4" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => open(() => setPending({ kind: 'delete' }))}
                  className="btn-secondary inline-flex items-center space-x-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>

        {refreshError && (
          <p role="alert" className="text-sm text-red-600 mb-4">
            {refreshError}{' '}
            <button type="button" onClick={() => setAttempt(a => a + 1)} className="underline font-medium">Retry</button>
          </p>
        )}

        <section aria-label="Task order details" className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Issued</dt>
              <dd className="mt-1 text-gray-900">{taskOrder.issued_date ? shortDate(taskOrder.issued_date) : '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium text-gray-500">Estimate notes</dt>
              <dd className="mt-1 text-gray-900 whitespace-pre-line">{taskOrder.estimate_notes || '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-gray-900">
                {format(parseISO(taskOrder.created_at), 'MMM d, yyyy')}{creatorName ? ` by ${creatorName}` : ''}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="bundled-properties-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h3 id="bundled-properties-heading" className="text-lg font-semibold text-gray-900">Bundled properties</h3>
            {!deleted && (
              <button
                type="button"
                onClick={() => open(() => setPicking(true))}
                className="btn-primary inline-flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add properties</span>
              </button>
            )}
          </div>

          {properties.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">{EMPTY_TEXT}</div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">{propertyCount(properties.length)} bundled</p>
              <PropertiesTable
                properties={properties}
                renderActions={property => (deleted ? <span className="text-gray-400">—</span> : (
                  <button
                    type="button"
                    onClick={() => open(() => setPending({ kind: 'unbundle', property }))}
                    className="btn-secondary text-red-600 hover:text-red-700"
                  >
                    Unbundle
                  </button>
                ))}
              />
            </>
          )}
        </section>

        {editing && (
          <TaskOrderFormModal
            mode="edit"
            initial={taskOrder}
            onSave={save}
            onCancel={() => setEditing(false)}
            busy={busy}
            error={actionError}
          />
        )}

        {picking && (
          <PropertyPickerModal taskOrder={taskOrder} onClose={() => setPicking(false)} onDone={added} />
        )}

        {pending && (() => {
          const action = pending.kind === 'unbundle' ? unbundleAction : TASK_ORDER_ACTIONS[pending.kind]
          const subject = pending.kind === 'unbundle' ? pending.property : taskOrder
          return (
            <ConfirmDialog
              title={action.title(subject)}
              message={action.message(subject)}
              confirmLabel={action.confirmLabel}
              cancelLabel="Cancel"
              confirmClassName={action.confirmClassName}
              onConfirm={confirm}
              onCancel={() => setPending(null)}
              busy={busy}
              error={actionError?.message ?? null}
            />
          )
        })()}

        <Toast message={toast} onDone={() => setToast(null)} />
      </main>
    </div>
  )
}
