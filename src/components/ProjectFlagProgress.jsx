/**
 * The Progress page's "Sidewalk progress (PIR flags)" section: how much of the work the project's PIR flags describe
 * is approved, in flight or unclaimed, per pay item (getProjectProgress). Task order and Site filters narrow it; both
 * live in the URL (?task_order=&property=), and picking another task order clears the site. A headline gives the
 * approved share by value with "Download CSV" beside it (downloadProjectProgress: the table as filtered, Slice ML2), the
 * table the pay items, and a line per site its unmapped flags. Its own loading and
 * error states, apart from the budget view's. Props: projectId.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  downloadProjectProgress, getProjectProgress, getTaskOrder, listProperties, listTaskOrders,
} from '../services/api'
import { formatDollars, formatPercent } from '../lib/payItemFormat'
import DownloadFileButton from './DownloadFileButton'
import FlagProgressTable from './FlagProgressTable'
import UnmappedFlagsNote from './UnmappedFlagsNote'

// "100.0% approved overall · $4,753.38 of $4,753.38 live"; the percent is a dash while nothing is live
export function overallLine(overall) {
  return `${formatPercent(overall.approved_pct)} approved overall · ${formatDollars(overall.approved_value, { cents: true })}`
    + ` of ${formatDollars(overall.live_total_value, { cents: true })} live`
}

export default function ProjectFlagProgress({ projectId }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const taskOrderId = searchParams.get('task_order') || ''
  const propertyId = searchParams.get('property') || ''

  const [taskOrders, setTaskOrders] = useState([])
  const [sites, setSites] = useState([])
  const [filterError, setFilterError] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  useEffect(() => {
    let ignore = false
    listTaskOrders(projectId)
      .then(found => { if (!ignore) setTaskOrders(found) })
      .catch(err => { if (!ignore) setFilterError(err.message) })
    return () => { ignore = true }
  }, [projectId])

  // The sites to pick from: the task order's bundle once one is picked, else every live site of the project
  useEffect(() => {
    let ignore = false
    const read = taskOrderId
      ? getTaskOrder(taskOrderId).then(found => found.properties)
      : listProperties(projectId)
    read
      .then(found => { if (!ignore) setSites(found) })
      .catch(err => { if (!ignore) setFilterError(err.message) })
    return () => { ignore = true }
  }, [projectId, taskOrderId])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    getProjectProgress(projectId, { taskOrderId: taskOrderId || undefined, propertyId: propertyId || undefined })
      .then(found => { if (!ignore) setData(found) })
      .catch(err => { if (!ignore) setError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [projectId, taskOrderId, propertyId, attempt])

  // The other parameters (the budget view's dates) stay as they are
  const choose = (changes) => {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    setSearchParams(params, { replace: true })
  }

  const shown = !loading && !error && data ? data : null

  return (
    <section aria-labelledby="flag-progress-heading" className="mb-10">
      <h3 id="flag-progress-heading" className="text-lg font-semibold text-gray-900 mb-3">
        Sidewalk progress (PIR flags)
      </h3>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div>
            <label htmlFor="flag-progress-task-order" className="input-label">Task order</label>
            <select
              id="flag-progress-task-order"
              className="input-field"
              value={taskOrderId}
              onChange={(e) => choose({ task_order: e.target.value, property: '' })}
            >
              <option value="">All task orders</option>
              {taskOrders.map(order => (
                <option key={order.id} value={order.id}>{order.task_order_number}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="flag-progress-site" className="input-label">Site</label>
            <select
              id="flag-progress-site"
              className="input-field"
              value={propertyId}
              onChange={(e) => choose({ property: e.target.value })}
            >
              <option value="">All sites</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>{site.display_address}</option>
              ))}
            </select>
          </div>
        </div>
        {filterError && (
          <p className="mt-2 text-sm text-red-600">Couldn't load the filter choices: {filterError}</p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-4">Loading flag progress…</p>
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-red-600 mb-4">Couldn't load flag progress: {error}</p>
          <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
        </div>
      ) : shown && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <p aria-label="Flag progress overall" className="text-lg font-semibold text-gray-900 tabular-nums">
              {overallLine(shown.overall)}
            </p>
            <DownloadFileButton
              label="Download CSV"
              enabled={shown.pay_items.length > 0}
              disabledTitle="No pay items to download"
              download={() => downloadProjectProgress(projectId, {
                taskOrderId: taskOrderId || undefined, propertyId: propertyId || undefined,
              })}
            />
          </div>
          {shown.pay_items.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
              No flags with pay items here yet
            </div>
          ) : (
            <FlagProgressTable payItems={shown.pay_items} label="Flag progress by pay item" />
          )}
          <UnmappedFlagsNote projectId={projectId} entries={shown.unmapped_by_property} />
        </>
      )}
    </section>
  )
}
