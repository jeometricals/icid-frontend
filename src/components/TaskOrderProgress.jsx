/**
 * The task order page's Progress section (getTaskOrderProgress): a headline ("Overall 100.0% approved · 2 of 5 sites
 * started"), the pay-item table from its sites' PIR flags, a line per site with unmapped flags, and a row per bundled
 * site that folds open to that site's own table (closed to start), with a note under them on rounding. The whole
 * section folds too (open to start).
 * Read again whenever the task order it is handed changes (an edit, a bundle or an unbundle).
 * Props: taskOrder (as getTaskOrder gives it).
 */
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getTaskOrderProgress } from '../services/api'
import { formatPercent } from '../lib/payItemFormat'
import FlagProgressTable, { flagCount } from './FlagProgressTable'
import UnmappedFlagsNote from './UnmappedFlagsNote'

// Under "By site": why the rounded site rows can miss the rounded total by a little (2.03 + 0.97 against 3.01)
export const ROUNDING_NOTE = 'Figures are rounded for display from the backend’s full-precision quantities. Rounded site '
  + 'rows may not add up to the rounded total by a small amount — the totals here are computed from the unrounded amounts.'

// "Overall 100.0% approved · 2 of 5 sites started"; the percent is a dash while nothing is live
export function taskOrderHeadline(data) {
  const sites = data.site_count === 1 ? 'site' : 'sites'
  return `Overall ${formatPercent(data.overall.approved_pct)} approved · ${data.sites_started} of ${data.site_count} ${sites} started`
}

// A site's row, folded: its address and how far it has got, open: its own table
function SiteProgressRow({ site }) {
  const [open, setOpen] = useState(false)
  const flags = site.pay_items.reduce((sum, item) => sum + item.live_total.flag_count, 0)
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <li className="bg-white rounded-lg shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 font-medium text-gray-900">
          <Chevron className="h-4 w-4 text-gray-500" aria-hidden="true" />
          {site.display_address}
        </span>
        <span className="text-sm text-gray-600 tabular-nums">
          {flags ? `${formatPercent(site.overall.approved_pct)} approved · ${flagCount(flags)}` : 'No flags yet'}
          {site.unmapped_flag_count > 0 && ` · ${site.unmapped_flag_count} unmapped`}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {site.pay_items.length === 0 ? (
            <p className="text-sm text-gray-600">No flags with pay items on this site yet</p>
          ) : (
            <FlagProgressTable payItems={site.pay_items} label={`Flag progress for ${site.display_address}`} />
          )}
        </div>
      )}
    </li>
  )
}

export default function TaskOrderProgress({ taskOrder }) {
  const [open, setOpen] = useState(true)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    getTaskOrderProgress(taskOrder.id)
      .then(found => { if (!ignore) setData(found) })
      .catch(err => { if (!ignore) setError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [taskOrder, attempt])

  const shown = !loading && !error && data ? data : null
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <section aria-labelledby="task-order-progress-heading" className="mt-8">
      <h3 id="task-order-progress-heading" className="text-lg font-semibold text-gray-900 mb-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-2"
        >
          <Chevron className="h-5 w-5 text-gray-500" aria-hidden="true" />
          Progress
        </button>
      </h3>

      {open && (loading ? (
        <p className="text-sm text-gray-500 py-4">Loading progress…</p>
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-red-600 mb-4">Couldn't load progress: {error}</p>
          <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
        </div>
      ) : shown && (
        <>
          <p aria-label="Task order progress overall" className="text-lg font-semibold text-gray-900 tabular-nums mb-3">
            {taskOrderHeadline(shown)}
          </p>
          {shown.pay_items.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
              No flags with pay items on these sites yet
            </div>
          ) : (
            <FlagProgressTable payItems={shown.pay_items} label="Task order progress by pay item" />
          )}
          <UnmappedFlagsNote projectId={taskOrder.project_id} entries={shown.unmapped_by_property} />
          {shown.properties.length > 0 && (
            <>
              <h4 className="text-sm font-semibold text-gray-700 mt-6 mb-2">By site</h4>
              <ul aria-label="Progress by site" className="space-y-2">
                {shown.properties.map(site => <SiteProgressRow key={site.property_id} site={site} />)}
              </ul>
              <p className="mt-2 text-xs text-gray-500">{ROUNDING_NOTE}</p>
            </>
          )}
        </>
      ))}
    </section>
  )
}
