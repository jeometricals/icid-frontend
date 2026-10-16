/**
 * Progress on one project (route param :projectId). First, the sidewalk progress its PIR flags describe
 * (ProjectFlagProgress, with its own Task order and Site filters, ?task_order=&property=). Then the budget view: what
 * the pay-item quantities of its approved IDRs come to against the project's budget (its contract items), by contract
 * value, in three sections, top to bottom: the project total, a card per budget code, and a table with a row per pay
 * item that has quantities.
 * The quantities are those of a range of work dates, or all of them with "Show cumulative" ticked; the budget is
 * always the whole project's. Both live in the URL (?from=&to=, YYYY-MM-DD, and ?cumulative=true), so a view can
 * be linked and reloaded; a URL with no dates means the last 30 days. One request per view.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { format, parseISO, subDays } from 'date-fns'
import { listQuantities } from '../services/api'
import { formatDollars, formatPayItemQuantity, formatPercent } from '../lib/payItemFormat'
import Bar from '../components/Bar'
import BudgetCodeCard from '../components/BudgetCodeCard'
import ProjectFlagProgress from '../components/ProjectFlagProgress'

export const DEFAULT_RANGE_DAYS = 30

// The range a URL without one stands for: the last 30 days, by the viewer's own calendar (not UTC's)
function defaultRange() {
  const today = new Date()
  return { from: format(subDays(today, DEFAULT_RANGE_DAYS), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
}

// "Sep 13", with its year when that isn't this one
function dayLabel(day) {
  const date = parseISO(day)
  return format(date, date.getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy')
}

// Which quantities the figures are of: "Sep 13 – Oct 13", "from Sep 13", "through Oct 13" or "full project"
function actualsLabel({ from, to, cumulative }) {
  if (cumulative || (!from && !to)) return 'full project'
  if (!to) return `from ${dayLabel(from)}`
  if (!from) return `through ${dayLabel(to)}`
  return `${dayLabel(from)} – ${dayLabel(to)}`
}

const dash = <span className="text-gray-400">—</span>

export default function ProgressPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const defaults = useMemo(defaultRange, [])
  // A URL naming either bound is taken as it stands: a bound it leaves out is open
  const ranged = searchParams.has('from') || searchParams.has('to')
  const from = ranged ? searchParams.get('from') || '' : defaults.from
  const to = ranged ? searchParams.get('to') || '' : defaults.to
  const cumulative = searchParams.get('cumulative') === 'true'
  // Cumulative leaves the dates out of the request, so a backwards range is no trouble then
  const backwards = !cumulative && Boolean(from && to && from > to)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  useEffect(() => {
    if (backwards) return // the backend would refuse it; the hint under the pickers says why nothing loads
    let ignore = false
    setLoading(true)
    setError(null)
    listQuantities(cumulative ? { projectId, cumulative: true } : { projectId, from, to })
      .then(found => { if (!ignore) setData(found) })
      .catch(err => { if (!ignore) setError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [projectId, from, to, cumulative, backwards, attempt])

  // Clearing both pickers leaves no dates in the URL, which is the default range again
  const changeRange = (bound, value) => {
    const next = { from, to, [bound]: value }
    const params = new URLSearchParams()
    if (next.from) params.set('from', next.from)
    if (next.to) params.set('to', next.to)
    if (cumulative) params.set('cumulative', 'true')
    // The flag section's filters stay as they are
    for (const key of ['task_order', 'property']) {
      if (searchParams.get(key)) params.set(key, searchParams.get(key))
    }
    setSearchParams(params, { replace: true })
  }

  // The dates in the URL stay as they are, for when the box is unticked again
  const changeCumulative = (on) => {
    const params = new URLSearchParams(searchParams)
    if (on) params.set('cumulative', 'true')
    else params.delete('cumulative')
    setSearchParams(params, { replace: true })
  }

  const shown = !loading && !error && data ? data : null
  const total = shown?.project_total
  // A project with no contract items has no budget codes, and nothing to measure against
  const noBudget = shown ? shown.totals_by_budget_code.length === 0 : false
  const unbudgetedCount = shown ? shown.unbudgeted_total.row_count : 0

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

        <h2 className="text-2xl font-bold text-gray-900 mb-6">Progress — {projectId}</h2>

        <ProjectFlagProgress projectId={projectId} />

        <h3 className="text-lg font-semibold text-gray-900 mb-3">Budget against actual</h3>

        <section aria-label="Date range" className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div>
              <label htmlFor="progress-from" className="input-label">From</label>
              <input
                id="progress-from"
                type="date"
                className="input-field"
                value={from}
                disabled={cumulative}
                onChange={(e) => changeRange('from', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="progress-to" className="input-label">To</label>
              <input
                id="progress-to"
                type="date"
                className="input-field"
                value={to}
                disabled={cumulative}
                onChange={(e) => changeRange('to', e.target.value)}
              />
            </div>
            <label className="inline-flex items-center space-x-2 text-sm text-gray-700 sm:pb-2">
              <input type="checkbox" checked={cumulative} onChange={(e) => changeCumulative(e.target.checked)} />
              <span>Show cumulative</span>
            </label>
          </div>
          {cumulative && (
            <p className="mt-2 text-sm text-gray-500">The date range is off: actuals are for the full project.</p>
          )}
          {backwards && (
            <p role="alert" className="mt-2 text-sm text-red-600">From can't be after To.</p>
          )}
        </section>

        {backwards ? null : loading ? (
          <div className="flex justify-center py-12">
            <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load quantities: {error}</p>
            <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">
              Retry
            </button>
          </div>
        ) : shown && (
          <>
            <section aria-label="Project total" className="bg-white rounded-lg shadow-sm p-6 mb-6">
              {noBudget ? (
                <p className="text-2xl font-bold text-gray-900">No budget set for this project</p>
              ) : (
                <>
                  <p className={`text-5xl font-bold tabular-nums ${total.percent > 100 ? 'text-warn' : 'text-gray-900'}`}>
                    {formatPercent(total.percent)}
                  </p>
                  <p className="mt-2 text-gray-700 tabular-nums">
                    {formatDollars(total.actual_value)} of {formatDollars(total.budgeted_value)} billed
                  </p>
                  <div className="mt-4">
                    <Bar percent={total.percent} tone={total.percent > 100 ? 'warn' : 'default'} label="Project progress" />
                  </div>
                </>
              )}
              {unbudgetedCount > 0 && (
                <p className="mt-3 text-sm text-gray-600">
                  {unbudgetedCount === 1
                    ? '1 unbudgeted pay item has quantities; it has no value here.'
                    : `${unbudgetedCount} unbudgeted pay items have quantities; they have no value here.`}
                </p>
              )}
              <p className="mt-3 text-xs text-gray-500">
                actuals: {actualsLabel({ from, to, cumulative })} · budget: full project
              </p>
            </section>

            {!noBudget && (
              <section aria-label="Budget codes" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-start mb-6">
                {shown.totals_by_budget_code.map(code => (
                  <BudgetCodeCard
                    key={code.budget_code}
                    total={code}
                    items={shown.pay_items.filter(item => item.budget_code === code.budget_code)}
                  />
                ))}
              </section>
            )}

            {shown.pay_items.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
                {cumulative ? 'No approved quantities yet' : 'No approved quantities in this range'}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">Pay Item</th>
                      <th scope="col" className="px-4 py-3">Description</th>
                      <th scope="col" className="px-4 py-3">Budget Code</th>
                      <th scope="col" className="px-4 py-3 text-right">Total Qty</th>
                      <th scope="col" className="px-4 py-3">Unit</th>
                      <th scope="col" className="px-4 py-3 text-right">Budgeted</th>
                      <th scope="col" className="px-4 py-3 text-right">%</th>
                      <th scope="col" className="px-4 py-3">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {shown.pay_items.map(item => {
                      const over = item.percent > 100
                      return (
                        <tr key={JSON.stringify([item.pay_item_ref, item.budget_code, item.unit, item.unbudgeted])}>
                          <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-900">
                            {item.pay_item_ref || <span className="font-normal text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{item.description || dash}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">{item.budget_code || dash}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums text-gray-900">
                            {formatPayItemQuantity(item.actual_quantity)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">{item.unit || dash}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums text-gray-700">
                            {item.unbudgeted ? dash : formatDollars(item.budgeted_value, { cents: true })}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-right tabular-nums ${over ? 'text-warn font-semibold' : 'text-gray-900'}`}>
                            {item.unbudgeted
                              ? <span className="text-xs text-gray-400">— unbudgeted</span>
                              : formatPercent(item.percent)}
                          </td>
                          <td className="px-4 py-3 w-40">
                            {!item.unbudgeted && (
                              <Bar
                                percent={item.percent}
                                tone={over ? 'warn' : 'default'}
                                label={`${item.pay_item_ref} progress`}
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
