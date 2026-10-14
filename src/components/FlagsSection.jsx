import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { createFlag, getContractItems, listFlags, updateFlag } from '../services/api'
import { FLAG_ACTIONS, nextDisplayOrder } from '../lib/flags'
import { formatArea } from '../lib/flagArea'
import { markLabel, nonAssessableReasonLabel, shapeLabel, thicknessLabel } from '../data/flagEnums'
import { contractItemLabel } from './ContractItemPicker'
import ConfirmDialog from './ConfirmDialog'
import FlagFormModal from './FlagFormModal'
import Toast from './Toast'

export const EMPTY_TEXT = "No flags yet. Click 'Add flag' to start."
export const EMPTY_TEXT_READ_ONLY = 'No flags.'

// A compact pill for the Marks cell
function Pill({ tone = 'gray', children }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  )
}

/**
 * A PIR's flags, under its PIR card: "Flags" with "Add flag", and a table (#, shape, thickness, area, pay item,
 * marks) by display order. The area is the computed one, with the reported one beside it when it differs; the pay
 * item reads "item no — description" from the project's contract items; marks are the surveyed mark and whether
 * the flag is assessable (or why not). Add and Edit share FlagFormModal; Delete and Un-delete (an admin's) are
 * confirmed first, and every change reads the flags again and is announced in a toast where it isn't obvious.
 * "Show deleted" (an admin's) asks for the soft-deleted flags too, muted with their # struck. Writes (Add, Edit)
 * are for a writer while neither the PIR nor its property is deleted.
 * Props: pir (with id and project_id), pirIsDeleted, propertyIsDeleted, writer (not a demo user), admin,
 * onChanged() (optional, called after any change).
 */
export default function FlagsSection({ pir, pirIsDeleted = false, propertyIsDeleted = false, writer, admin, onChanged }) {
  const [flags, setFlags] = useState([])
  const [contractItems, setContractItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false) // whether there is a list to keep on screen while it is read again
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [showDeleted, setShowDeleted] = useState(false)
  const includeDeleted = admin && showDeleted // only an admin's list has deleted flags

  const [form, setForm] = useState(null) // the open Add / Edit dialog: {mode: 'add'} or {mode: 'edit', flag}
  const [pending, setPending] = useState(null) // {flag, action}: the delete or un-delete waiting to be confirmed
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null) // the open dialog's failed action: the thrown error
  const [refreshError, setRefreshError] = useState(null) // a change worked but the flags couldn't be read again

  const canWrite = writer && !pirIsDeleted && !propertyIsDeleted

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setLoadError(null)
    setRefreshError(null)
    Promise.all([listFlags(pir.id, { includeDeleted }), getContractItems(pir.project_id)])
      .then(([foundFlags, foundItems]) => {
        if (ignore) return
        setFlags(foundFlags)
        setContractItems(foundItems)
        setLoaded(true)
      })
      .catch(err => {
        if (ignore) return
        setLoadError(err.message)
        setLoaded(false)
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [pir.id, pir.project_id, includeDeleted, attempt])

  const open = (show) => {
    setActionError(null)
    show()
  }

  // Runs the open dialog's action, then reads the flags again rather than guessing what the backend wrote.
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
      setFlags(await listFlags(pir.id, { includeDeleted }))
      setRefreshError(null)
    } catch (err) {
      setRefreshError(`The change was saved, but the flags couldn't be refreshed: ${err.message}`)
    }
    setBusy(false)
    onChanged?.()
    return true
  }

  const save = async (values) => {
    const saved = await run(form.mode === 'add' ? () => createFlag(pir.id, values) : () => updateFlag(form.flag.id, values))
    if (saved) setForm(null)
  }

  const confirm = async () => {
    const { flag, action } = pending
    if (!(await run(() => FLAG_ACTIONS[action].run(flag)))) return
    setToast(FLAG_ACTIONS[action].done(flag))
    setPending(null)
  }

  const payItemText = (flag) => {
    if (!flag.pay_item_id) return '—'
    const item = contractItems.find(found => found.contract_item_id === flag.pay_item_id)
    return item ? contractItemLabel(item) : 'Not in the catalog'
  }

  const showActions = canWrite || admin

  return (
    <section aria-labelledby="flags-heading" className="bg-white rounded-lg shadow-sm p-6 mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 id="flags-heading" className="text-lg font-semibold text-gray-900">Flags</h3>
        {canWrite && (
          <button
            type="button"
            onClick={() => open(() => setForm({ mode: 'add' }))}
            disabled={!loaded}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add flag</span>
          </button>
        )}
      </div>

      {loading && !loaded ? (
        <div className="flex justify-center py-6">
          <div role="status" className="animate-spin rounded-full h-8 w-8 border-b-2 border-construction-600"></div>
        </div>
      ) : loadError ? (
        <div className="text-center py-4">
          <p className="text-red-600 mb-4">Couldn't load the flags: {loadError}</p>
          <button type="button" onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
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

          {flags.length === 0 ? (
            <p className="text-gray-600">{canWrite ? EMPTY_TEXT : EMPTY_TEXT_READ_ONLY}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['#', 'Shape', 'Thickness', 'Area', 'Pay item', 'Marks', ...(showActions ? ['Actions'] : [])].map(heading => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {flags.map(flag => {
                    const deleted = Boolean(flag.deleted_at)
                    const reportedDiffers = flag.reported_quantity !== null && flag.reported_quantity !== undefined
                      && Number(flag.reported_quantity) !== Number(flag.computed_quantity)
                    return (
                      <tr key={flag.id} data-deleted={deleted || undefined} className={deleted ? 'bg-gray-50 text-gray-400' : 'text-gray-900'}>
                        <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                          <span className={deleted ? 'line-through' : ''}>{flag.display_order}</span>
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">{shapeLabel(flag.shape)}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">{thicknessLabel(flag.surveyed_thickness)}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap tabular-nums">
                          {formatArea(flag.computed_quantity)}
                          {reportedDiffers && (
                            <span className="block text-gray-500">{formatArea(flag.reported_quantity)} (reported)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <p className="line-clamp-2 max-w-xs" title={payItemText(flag)}>{payItemText(flag)}</p>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex flex-wrap gap-1">
                            <Pill>{markLabel(flag.surveyed_mark)}</Pill>
                            {flag.surveyed_is_assessable
                              ? <Pill tone="green">assessable</Pill>
                              : <Pill tone="amber">non-assessable ({nonAssessableReasonLabel(flag.surveyed_non_assessable_reason)})</Pill>}
                          </div>
                        </td>
                        {showActions && (
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              {deleted ? admin && (
                                <button
                                  type="button"
                                  onClick={() => open(() => setPending({ flag, action: 'undelete' }))}
                                  className="btn-secondary"
                                >
                                  Un-delete
                                </button>
                              ) : (
                                <>
                                  {canWrite && (
                                    <button
                                      type="button"
                                      onClick={() => open(() => setForm({ mode: 'edit', flag }))}
                                      className="btn-secondary"
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {admin && (
                                    <button
                                      type="button"
                                      onClick={() => open(() => setPending({ flag, action: 'delete' }))}
                                      className="btn-secondary text-red-600 hover:text-red-700"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
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
        <FlagFormModal
          mode={form.mode}
          initial={form.flag}
          nextDisplayOrder={nextDisplayOrder(flags)}
          contractItems={contractItems}
          onSave={save}
          onCancel={() => setForm(null)}
          busy={busy}
          error={actionError}
        />
      )}

      {pending && (
        <ConfirmDialog
          title={FLAG_ACTIONS[pending.action].title(pending.flag)}
          message={FLAG_ACTIONS[pending.action].message(pending.flag)}
          confirmLabel={FLAG_ACTIONS[pending.action].confirmLabel}
          cancelLabel="Cancel"
          confirmClassName={FLAG_ACTIONS[pending.action].confirmClassName}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
          busy={busy}
          error={actionError?.message ?? null}
        />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </section>
  )
}
