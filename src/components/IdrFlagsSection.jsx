import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  excludeIdrFlag, excludeIdrSegment, getIdrSegments, includeIdrFlag, includeIdrSegment, listTaskOrders,
} from '../services/api'
import {
  flagAmountText, flagPayItemText, flagSiteName, flagsHeading, formatAmount, sketchLink,
} from '../lib/idrFlags'
import { shortDate } from '../lib/shortDate'

export const NO_TASK_ORDER_DRAFT = "Pick a task order to bring in its sites' flags."
export const NO_TASK_ORDER = 'No task order: this IDR covers no flags.'
export const NO_FLAGS = "No flags on this task order's sites yet."
export const LIVE_NOTE = 'Live: follows the flags until the IDR is approved.'
export const FROZEN_NOTE = 'Frozen at approval.'

const STATE_LABELS = { attributed: 'Attributed', excluded: 'Excluded', claimed: 'Claimed' }

// A curb segment's kind, in words
export const SEGMENT_KINDS = {
  curb_concrete: 'Concrete curb',
  curb_concrete_depressed: 'Depressed curb',
  curb_steel_faced: 'Steel-faced curb',
  curb_steel_faced_corner: 'Steel-faced corner curb',
  curb_granite: 'Granite curb',
  other: 'Other',
}

/**
 * The IDR page's "Flags attributed" panel (R1f), folded by its heading ("Flags attributed (18 of 23)", once approved
 * "Flags claimed (18)"). First the IDR's task order (the scope of its flags): a select on a draft whose header can be
 * saved (canPickTaskOrder), else its number as text; it reads the project's task orders itself. Then the pay items
 * its flags come to (read-only: live before approval, frozen at it), with a note when some attributed flags add
 * nothing (no pay item, or a unit a flag can't measure). Then one row per flag: its number, site, page, pay item,
 * amount, state and "View in sketch". A user who may change them (canChange) gets a checkbox per row, which excludes
 * or includes the flag and hands the IDR's flags the call answers with to onChanged; a flag another IDR claimed has
 * no checkbox and links to that IDR. Everyone else reads the state as text. Under the flags, its curb segments
 * (curb billing; CurbSegments, which reads getIdrSegments itself, again when the IDR's task order or status changes,
 * and shows nothing when the IDR covers none): "Curb segments (n of m)" ("Curb segments claimed (n)" once approved),
 * the LF they come to per pay item, and one row per segment (site, page, kind, length, pay item, LF, status), with
 * the same checkboxes for the same users. A failure to read them is its own line, with Retry; the flags stand.
 * Props: idr, data (getIdrFlags' answer, or null), loading, error, onRetry, canChange, canPickTaskOrder,
 * onTaskOrderChange(taskOrderId or null) (async; throws on a refusal), onChanged(data).
 */
export default function IdrFlagsSection({
  idr, data, loading = false, error = null, onRetry, canChange = false, canPickTaskOrder = false, onTaskOrderChange, onChanged,
}) {
  const projectId = idr.project_id
  const [open, setOpen] = useState(true)
  const [taskOrders, setTaskOrders] = useState(null) // null while loading
  const [taskOrdersError, setTaskOrdersError] = useState(null)
  const [pickError, setPickError] = useState(null)
  const [picking, setPicking] = useState(false)
  const [busyFlag, setBusyFlag] = useState(null)
  const [flagError, setFlagError] = useState(null)

  useEffect(() => {
    let ignore = false
    setTaskOrdersError(null)
    listTaskOrders(projectId)
      .then(found => { if (!ignore) setTaskOrders(found) })
      .catch(err => { if (!ignore) setTaskOrdersError(err.message) })
    return () => { ignore = true }
  }, [projectId])

  const taskOrderId = idr.task_order_id ?? null
  const taskOrder = taskOrders?.find(found => found.id === taskOrderId) ?? null

  const pick = async (value) => {
    setPicking(true)
    setPickError(null)
    try {
      await onTaskOrderChange(value || null)
    } catch (err) {
      setPickError(`Couldn't change the task order: ${err.message}`)
    }
    setPicking(false)
  }

  const toggle = async (flag, include) => {
    setBusyFlag(flag.flag_id)
    setFlagError(null)
    try {
      onChanged(await (include ? includeIdrFlag : excludeIdrFlag)(idr.idr_id, flag.flag_id))
    } catch (err) {
      setFlagError(`Couldn't ${include ? 'include' : 'exclude'} flag #${flag.display_order}: ${err.message}`)
    }
    setBusyFlag(null)
  }

  const heading = data ? flagsHeading(data) : 'Flags attributed'
  const segments = useIdrSegments(idr)

  const taskOrderLine = canPickTaskOrder ? (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="idr-task-order" className="text-sm font-medium text-gray-700">Task order</label>
      <select
        id="idr-task-order"
        className="input-field w-auto"
        value={taskOrderId ?? ''}
        disabled={picking || taskOrders === null}
        onChange={(e) => pick(e.target.value)}
      >
        <option value="">No task order</option>
        {/* One no longer listed (deleted since) still shows as picked */}
        {taskOrderId && taskOrders && !taskOrder && <option value={taskOrderId}>Task order not found</option>}
        {(taskOrders ?? []).map(found => (
          <option key={found.id} value={found.id}>{found.task_order_number}</option>
        ))}
      </select>
      {picking && <span role="status" className="text-sm text-gray-500">Saving...</span>}
    </div>
  ) : (
    <p className="text-sm text-gray-700">
      <span className="font-medium">Task order:</span>{' '}
      {!taskOrderId ? 'None' : taskOrder ? (
        <Link to={`/project/${projectId}/task-orders/${taskOrderId}`} className="text-construction-700 hover:underline">
          {taskOrder.task_order_number}
        </Link>
      ) : taskOrders ? 'Task order not found' : '...'}
    </p>
  )

  return (
    <section aria-label="Flags attributed" className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        className="flex items-center gap-2 form-section-title mb-0 text-left"
      >
        {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        <span>{heading}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {taskOrderLine}
          {taskOrdersError && (
            <p role="alert" className="text-sm text-red-600">Couldn't load the task orders: {taskOrdersError}</p>
          )}
          {pickError && <p role="alert" className="text-sm text-red-600">{pickError}</p>}

          {loading && !data ? (
            <div className="flex justify-center py-4">
              <div role="status" aria-label="Loading flags" className="animate-spin rounded-full h-8 w-8 border-b-2 border-construction-600"></div>
            </div>
          ) : error ? (
            <div className="flex flex-wrap items-center gap-3">
              <p role="alert" className="text-sm text-red-600">Couldn't load this IDR's flags: {error}</p>
              <button type="button" onClick={onRetry} className="btn-secondary">Retry</button>
            </div>
          ) : data && (
            <>
              {data.flags.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {taskOrderId ? NO_FLAGS : canPickTaskOrder ? NO_TASK_ORDER_DRAFT : NO_TASK_ORDER}
                </p>
              ) : (
                <>
                  <PayItemRollup data={data} />
                  {flagError && <p role="alert" className="text-sm text-red-600">{flagError}</p>}
                  <FlagRows
                    data={data}
                    projectId={projectId}
                    canChange={canChange}
                    busyFlag={busyFlag}
                    onToggle={toggle}
                  />
                </>
              )}
            </>
          )}
          <CurbSegments idr={idr} projectId={projectId} canChange={canChange} {...segments} />
        </div>
      )}
    </section>
  )
}

// An IDR's curb segments (getIdrSegments), read beside its flags and again when its task order or status changes
function useIdrSegments(idr) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  useEffect(() => {
    let ignore = false
    setError(null)
    getIdrSegments(idr.idr_id)
      .then(found => { if (!ignore) setData(found) })
      .catch(err => { if (!ignore) setError(err.message) })
    return () => { ignore = true }
  }, [idr.idr_id, idr.task_order_id, idr.status, attempt])

  return { data, error, onRetry: () => setAttempt(a => a + 1), onChanged: setData }
}

// "Curb segments (3 of 4)", or once approved "Curb segments claimed (3)"
export function segmentsHeading(data) {
  if (data.frozen) return `Curb segments claimed (${data.counts.attributed})`
  return `Curb segments (${data.counts.attributed} of ${data.counts.total})`
}

// The curb segments an IDR covers: their rollup and one row each, a checkbox on each for a user who may change them
function CurbSegments({ idr, projectId, canChange, data, error, onRetry, onChanged }) {
  const [busy, setBusy] = useState(null)
  const [toggleError, setToggleError] = useState(null)

  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-red-600">Couldn't load this IDR's curb segments: {error}</p>
        <button type="button" onClick={onRetry} className="btn-secondary">Retry</button>
      </div>
    )
  }
  if (!data || data.segments.length === 0) return null

  const toggle = async (segment, include) => {
    setBusy(segment.segment_id)
    setToggleError(null)
    try {
      onChanged(await (include ? includeIdrSegment : excludeIdrSegment)(idr.idr_id, segment.segment_id))
    } catch (err) {
      setToggleError(`Couldn't ${include ? 'include' : 'exclude'} the segment: ${err.message}`)
    }
    setBusy(null)
  }

  return (
    <div className="pt-2 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">{segmentsHeading(data)}</h3>
      {data.pay_items.length === 0 ? (
        <p className="text-sm text-gray-500">No attributed curb segment has a pay item yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" aria-label="Pay items from curb segments">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4 font-medium">Pay item</th>
                <th className="py-2 pr-4 font-medium">Description</th>
                <th className="py-2 pr-4 font-medium">Budget code</th>
                <th className="py-2 pr-4 font-medium text-right">Quantity</th>
                {!data.frozen && <th className="py-2 font-medium text-right">Segments</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.pay_items.map(item => (
                <tr key={`${item.pay_item_ref}|${item.budget_code}`}>
                  <td className="py-2 pr-4 font-mono">{item.pay_item_ref ?? '—'}</td>
                  <td className="py-2 pr-4">{item.description ?? '—'}</td>
                  <td className="py-2 pr-4 font-mono">{item.budget_code ?? '—'}</td>
                  <td className="py-2 pr-4 text-right whitespace-nowrap">{formatAmount(item.amount)} {item.unit}</td>
                  {!data.frozen && <td className="py-2 text-right">{item.segment_count ?? '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.unmapped > 0 && (
        <p className="text-sm text-amber-700">
          {data.unmapped === 1 ? '1 segment adds' : `${data.unmapped} segments add`} nothing here: no pay item in LF, or no
          length (its page has no scale).
        </p>
      )}
      {toggleError && <p role="alert" className="text-sm text-red-600">{toggleError}</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm" aria-label="Curb segments">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              {canChange && <th className="py-2 pr-3 font-medium"><span className="sr-only">Attributed</span></th>}
              <th className="py-2 pr-4 font-medium">Site</th>
              <th className="py-2 pr-4 font-medium">Page</th>
              <th className="py-2 pr-4 font-medium">Kind</th>
              <th className="py-2 pr-4 font-medium text-right">Length</th>
              <th className="py-2 pr-4 font-medium">Pay item</th>
              <th className="py-2 pr-4 font-medium text-right">Quantity</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.segments.map(segment => {
              const out = segment.state === 'excluded' || segment.state === 'claimed_elsewhere'
              const site = flagSiteName(segment)
              const kind = SEGMENT_KINDS[segment.segment_type] ?? segment.segment_type
              return (
                <tr key={segment.segment_id} className={out ? 'text-gray-400' : 'text-gray-900'}>
                  {canChange && (
                    <td className="py-2 pr-3">
                      {segment.state !== 'claimed_elsewhere' && (
                        <input
                          type="checkbox"
                          aria-label={`Attribute ${kind.toLowerCase()} at ${site}, page ${segment.page_number}`}
                          checked={segment.state === 'attributed'}
                          disabled={busy !== null}
                          onChange={(e) => toggle(segment, e.target.checked)}
                        />
                      )}
                    </td>
                  )}
                  <td className="py-2 pr-4">{site}</td>
                  <td className="py-2 pr-4">{segment.page_number}</td>
                  <td className="py-2 pr-4">{kind}</td>
                  <td className="py-2 pr-4 text-right whitespace-nowrap">
                    {segment.length_ft === null || segment.length_ft === undefined
                      ? '—' : `${Number(segment.length_ft).toFixed(2)} ft`}
                  </td>
                  <td className="py-2 pr-4">{flagPayItemText(segment) ?? <span className="text-gray-400">No pay item</span>}</td>
                  <td className="py-2 pr-4 text-right whitespace-nowrap">
                    {segment.amount === null || segment.amount === undefined ? '—' : `${formatAmount(segment.amount)} ${segment.unit}`}
                  </td>
                  <td className="py-2">
                    {segment.state === 'claimed_elsewhere' ? (
                      <Link to={`/project/${projectId}/idr/${segment.claimed_by_idr_id}`} className="text-construction-700 hover:underline">
                        Claimed by IDR {segment.claimed_by_idr_number ?? ''}
                      </Link>
                    ) : segment.state === 'claimed' && segment.constructed_on ? (
                      `Claimed · constructed ${shortDate(segment.constructed_on)}`
                    ) : (
                      STATE_LABELS[segment.state] ?? segment.state
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// The pay items the flags come to, read-only
function PayItemRollup({ data }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Pay items from flags</h3>
        <span className="text-xs text-gray-500">{data.frozen ? FROZEN_NOTE : LIVE_NOTE}</span>
      </div>
      {data.pay_items.length === 0 ? (
        <p className="text-sm text-gray-500">No attributed flag has a pay item yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" aria-label="Pay items from flags">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4 font-medium">Pay item</th>
                <th className="py-2 pr-4 font-medium">Description</th>
                <th className="py-2 pr-4 font-medium">Budget code</th>
                <th className="py-2 pr-4 font-medium text-right">Quantity</th>
                {!data.frozen && <th className="py-2 font-medium text-right">Flags</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.pay_items.map(item => (
                <tr key={`${item.pay_item_ref}|${item.budget_code}|${item.unit}`}>
                  <td className="py-2 pr-4 font-mono">{item.pay_item_ref ?? '—'}</td>
                  <td className="py-2 pr-4">{item.description ?? '—'}</td>
                  <td className="py-2 pr-4 font-mono">{item.budget_code ?? '—'}</td>
                  <td className="py-2 pr-4 text-right whitespace-nowrap">{formatAmount(item.amount)} {item.unit}</td>
                  {!data.frozen && <td className="py-2 text-right">{item.flag_count ?? '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.unmapped > 0 && (
        <p className="text-sm text-amber-700 mt-2">
          {data.unmapped === 1 ? '1 flag adds' : `${data.unmapped} flags add`} nothing here: no pay item, or one in a unit a
          flag can't be measured in.
        </p>
      )}
    </div>
  )
}

// One row per flag, a checkbox on each for a user who may change them
function FlagRows({ data, projectId, canChange, busyFlag, onToggle }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm" aria-label="Flags">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            {canChange && <th className="py-2 pr-3 font-medium"><span className="sr-only">Attributed</span></th>}
            <th className="py-2 pr-4 font-medium">Flag</th>
            <th className="py-2 pr-4 font-medium">Site</th>
            <th className="py-2 pr-4 font-medium">Page</th>
            <th className="py-2 pr-4 font-medium">Pay item</th>
            <th className="py-2 pr-4 font-medium text-right">Quantity</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 font-medium"><span className="sr-only">Sketch</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.flags.map(flag => {
            const out = flag.state === 'excluded' || flag.state === 'claimed_elsewhere'
            const site = flagSiteName(flag)
            return (
              <tr key={flag.flag_id} data-flag-id={flag.flag_id} className={out ? 'text-gray-400' : 'text-gray-900'}>
                {canChange && (
                  <td className="py-2 pr-3">
                    {flag.state !== 'claimed_elsewhere' && (
                      <input
                        type="checkbox"
                        aria-label={`Attribute flag #${flag.display_order} at ${site}`}
                        checked={flag.state === 'attributed'}
                        disabled={busyFlag !== null}
                        onChange={(e) => onToggle(flag, e.target.checked)}
                      />
                    )}
                  </td>
                )}
                <td className="py-2 pr-4 font-medium">#{flag.display_order}</td>
                <td className="py-2 pr-4">{site}</td>
                <td className="py-2 pr-4">{flag.page_number ?? '—'}</td>
                <td className="py-2 pr-4">{flagPayItemText(flag) ?? <span className="text-gray-400">No pay item</span>}</td>
                <td className="py-2 pr-4 text-right whitespace-nowrap">{flagAmountText(flag)}</td>
                <td className="py-2 pr-4">
                  {flag.state === 'claimed_elsewhere' ? (
                    <Link to={`/project/${projectId}/idr/${flag.claimed_by_idr_id}`} className="text-construction-700 hover:underline">
                      Claimed by IDR {flag.claimed_by_idr_number ?? ''}
                    </Link>
                  ) : flag.state === 'claimed' && flag.constructed_on ? (
                    `Claimed · constructed ${shortDate(flag.constructed_on)}`
                  ) : (
                    STATE_LABELS[flag.state] ?? flag.state
                  )}
                </td>
                <td className="py-2 whitespace-nowrap">
                  <Link to={sketchLink(projectId, flag)} className="text-construction-700 hover:underline">View in sketch</Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
