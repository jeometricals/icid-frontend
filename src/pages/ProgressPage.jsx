/**
 * Progress on one project (route param :projectId): the pay-item quantities of its approved IDRs over a range of
 * work dates. A total per unit as tiles, then one row per pay item with its summed quantity.
 * The range lives in the URL (?from=&to=, YYYY-MM-DD), so a view can be linked and reloaded; a URL with neither
 * means the last 30 days. One request per range; the rows are rolled up here.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { listQuantities } from '../services/api'
import { formatQuantity, rollupByItem, unitTiles } from '../lib/progressRollup'

export const DEFAULT_RANGE_DAYS = 30

// The range a URL without one stands for: the last 30 days, by the viewer's own calendar (not UTC's)
function defaultRange() {
  const today = new Date()
  return { from: format(subDays(today, DEFAULT_RANGE_DAYS), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
}

export default function ProgressPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const defaults = useMemo(defaultRange, [])
  // A URL naming either bound is taken as it stands: a bound it leaves out is open
  const ranged = searchParams.has('from') || searchParams.has('to')
  const from = ranged ? searchParams.get('from') || '' : defaults.from
  const to = ranged ? searchParams.get('to') || '' : defaults.to
  const backwards = Boolean(from && to && from > to)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  useEffect(() => {
    if (backwards) return // the backend would refuse it; the hint under the pickers says why nothing loads
    let ignore = false
    setLoading(true)
    setError(null)
    listQuantities({ projectId, from, to })
      .then(found => { if (!ignore) setData(found) })
      .catch(err => { if (!ignore) setError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [projectId, from, to, backwards, attempt])

  // Clearing both pickers leaves a bare URL, which is the default range again
  const changeRange = (bound, value) => {
    const next = { from, to, [bound]: value }
    const params = new URLSearchParams()
    if (next.from) params.set('from', next.from)
    if (next.to) params.set('to', next.to)
    setSearchParams(params, { replace: true })
  }

  const shown = !loading && !error && data ? data : null
  const items = useMemo(() => (shown ? rollupByItem(shown.rows) : []), [shown])

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

        <section aria-label="Date range" className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="progress-from" className="input-label">From</label>
              <input
                id="progress-from"
                type="date"
                className="input-field"
                value={from}
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
                onChange={(e) => changeRange('to', e.target.value)}
              />
            </div>
          </div>
          {backwards && (
            <p role="alert" className="mt-2 text-sm text-red-600">From can't be after To.</p>
          )}
        </section>

        {backwards ? null : (
          <>
            <section aria-label="Totals by unit" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {unitTiles(shown?.totals_by_unit).map(({ unit, total }) => (
                <div key={unit} role="group" aria-label={`${unit} total`} className="bg-white rounded-lg shadow-sm p-4">
                  <div className="text-2xl font-bold text-construction-700">{unit}</div>
                  <div className="text-lg text-gray-900 tabular-nums">{total === null ? '—' : formatQuantity(total)}</div>
                </div>
              ))}
            </section>

            {loading ? (
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
            ) : items.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
                No approved quantities in this range
              </div>
            ) : (
              <>
                {shown.truncated && (
                  <div role="alert" className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-sm mb-4">
                    Showing the first 10,000 rows — narrow the date range for a full view.
                  </div>
                )}
                <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th scope="col" className="px-4 py-3">Pay Item</th>
                        <th scope="col" className="px-4 py-3">Description</th>
                        <th scope="col" className="px-4 py-3">Budget Code</th>
                        <th scope="col" className="px-4 py-3 text-right">Total Qty</th>
                        <th scope="col" className="px-4 py-3">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map(item => (
                        <tr key={JSON.stringify([item.pay_item_ref, item.budget_code, item.unit, item.description])}>
                          <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-900">
                            {item.pay_item_ref || <span className="font-normal text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{item.description || <span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                            {item.budget_code || <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums text-gray-900">
                            {formatQuantity(item.total_qty)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                            {item.unit || <span className="text-gray-400">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
