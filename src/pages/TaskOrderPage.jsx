/**
 * One task order of a project (route params :projectId and :taskOrderId), at
 * /project/:projectId/task-orders/:taskOrderId. For anyone on the project: its number, a card with its issued date,
 * estimate notes and who created it when, and its bundled properties (those not deleted, by address). A member
 * who isn't a demo user also gets Edit, Unbundle on each property and "Add properties", which opens a picker of
 * the project's other properties; Delete (a soft delete) is an admin's alone. Edit shares the list page's dialog;
 * Delete and Unbundle are confirmed first. A deleted task order reads Deleted and can't be changed: an admin gets
 * only "Un-delete", anyone else nothing (the backend refuses them). After each change the page shows the task
 * order the backend returned, and a delete, un-delete, unbundle or batch of additions is announced in a toast. A
 * site's block and lot ("Ped ramp" for a ped ramp) link to the property's page, which is open to anyone on the project. Back returns to the project's
 * task orders; "Go to Project Page" sits beside it. The backend refuses anyone not on the project (403), which
 * shows as the load error.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getTaskOrder, unbundleProperty, updateTaskOrder } from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
import { shortDate } from '../lib/shortDate'
import { siteName } from '../lib/properties'
import { TASK_ORDER_ACTIONS, propertyCount } from '../lib/taskOrders'
import { useUserNames } from '../lib/useUserNames'
import ConfirmDialog from '../components/ConfirmDialog'
import GoToProjectButton from '../components/GoToProjectButton'
import PropertiesTable from '../components/PropertiesTable'
import PropertyPickerModal from '../components/PropertyPickerModal'
import StatusBadge from '../components/StatusBadge'
import TaskOrderFormModal from '../components/TaskOrderFormModal'
import Toast from '../components/Toast'

export const EMPTY_TEXT = "No sites bundled yet. Click 'Add sites' to pick from this project."

// What the toast says after the picker's batch: how many went in and, when one was refused, which and why
export function addedMessage({ added, failed }) {
  const done = added > 0 ? `Added ${propertyCount(added)}.` : 'No sites were added.'
  if (!failed) return done
  return `${done} Couldn't add ${siteName(failed.property)}: ${failed.message} The rest weren't tried.`
}

const unbundleAction = {
  title: row => `Unbundle site ${siteName(row)}?`,
  message: row => `${row.display_address} leaves this task order. It stays on the project and can be added again.`,
  confirmLabel: 'Unbundle',
  confirmClassName: 'btn-danger',
  done: row => `Site ${siteName(row)} unbundled.`,
}

export const DEMO_NOTE = 'Demo mode: task orders are read-only.'

export default function TaskOrderPage() {
  const { projectId, taskOrderId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const admin = isAdmin(user)
  const writer = !user?.is_demo // the backend keeps demo users read-only on task orders

  const [taskOrder, setTaskOrder] = useState(null)
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
    let ignore = false
    setLoading(true)
    setLoadError(null)
    setRefreshError(null)
    getTaskOrder(taskOrderId)
      .then(found => {
        if (ignore) return
        // A task order of another project, reached by an edited URL, isn't this project's to show
        if (found.project_id !== projectId) setLoadError(`Task order not found in project ${projectId}`)
        else setTaskOrder(found)
      })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [projectId, taskOrderId, attempt])

  // The creator's name; until it is found, the card gives the date alone
  const nameOf = useUserNames(user)

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

  const back = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6">
      <button
        onClick={() => navigate(`/project/${projectId}/task-orders`)}
        className="flex items-center space-x-2 text-construction-700 hover:text-construction-800"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="font-medium">Back to Task Orders</span>
      </button>
      <GoToProjectButton onClick={() => navigate(`/project/${projectId}`)} />
    </div>
  )

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
  const changeable = writer && !deleted // a deleted task order is the admin's to un-delete, and nobody's to change
  const creatorName = nameOf(taskOrder.created_by)
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
            {deleted && admin && (
              <button type="button" onClick={() => open(() => setPending({ kind: 'undelete' }))} className="btn-primary">
                Un-delete
              </button>
            )}
            {changeable && (
              <button
                type="button"
                onClick={() => open(() => setEditing(true))}
                className="btn-secondary inline-flex items-center space-x-2"
              >
                <Pencil className="h-4 w-4" />
                <span>Edit</span>
              </button>
            )}
            {!deleted && admin && (
              <button
                type="button"
                onClick={() => open(() => setPending({ kind: 'delete' }))}
                className="btn-secondary inline-flex items-center space-x-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {!writer && <p className="text-sm text-gray-600 mb-4">{DEMO_NOTE}</p>}

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
            <h3 id="bundled-properties-heading" className="text-lg font-semibold text-gray-900">Bundled sites</h3>
            {changeable && (
              <button
                type="button"
                onClick={() => open(() => setPicking(true))}
                className="btn-primary inline-flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add sites</span>
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
                renderActions={property => (!changeable ? <span className="text-gray-400">—</span> : (
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
