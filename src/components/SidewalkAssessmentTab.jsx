import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  downloadAssessmentSummary, downloadConstructionReport, downloadTailoredAssessmentSummary, getAssessmentSites,
  listTaskOrders,
} from '../services/api'
import { formatDollars } from '../lib/payItemFormat'
import DownloadFileButton from './DownloadFileButton'

// The figures a row and the totals row show, in column order: square feet, and the amounts (null without a rate)
const SF = ['four_assessable', 'four_non_assessable', 'four_total']
const SF_7 = ['seven_assessable', 'seven_non_assessable', 'seven_total']
export const FIGURES = [...SF, 'four_amount', ...SF_7, 'seven_amount', 'grand_total']
const AMOUNTS = new Set(['four_amount', 'seven_amount', 'grand_total'])
const HEADINGS = [
  'Property Address', 'CB', '4" Assessable (SF)', '4" Non-Assessable (SF)', '4" Total (SF)', '4" Amount ($)',
  '7" Assessable (SF)', '7" Non-Assessable (SF)', '7" Total (SF)', '7" Amount ($)', 'Grand Total ($)', 'Remarks',
  'Construction Report',
]

// Square feet: two decimals, thousands separated, a dash for none (as the workbook shows them)
const squareFeet = (value) => (value
  ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '—')
const figure = (name, value) => (AMOUNTS.has(name)
  ? (value === null || value === undefined ? '—' : formatDollars(value, { cents: true }))
  : squareFeet(value))

// A sidewalk's place on the tax map, and its violation, under its address: "Block 123 Lot 45 · V-77"
function siteDetails(site) {
  const parts = []
  if (site.block || site.lot) parts.push(`Block ${site.block ?? '—'} Lot ${site.lot ?? '—'}`)
  if (site.violation_no) parts.push(site.violation_no)
  return parts.join(' · ')
}

// Whether a site matches the search: its block, lot, block and lot together ("123 45", "123/45"), address or violation
export function matchesSearch(site, text) {
  const needle = text.trim().toLowerCase()
  if (!needle) return true
  const blockLot = `${site.block ?? ''} ${site.lot ?? ''}`
  const fields = [site.display_address, site.violation_no, site.block, site.lot, blockLot,
    `${site.block ?? ''}/${site.lot ?? ''}`, `${site.block ?? ''}-${site.lot ?? ''}`]
  return fields.some(field => field?.toLowerCase().includes(needle))
}

// What each download comes as (the polish slice's CSV mirror)
export const DOWNLOAD_FORMATS = ['xlsx', 'csv']

// The shown rows' totals: each figure summed to the cent; an amount stays null when no row has one
function totalsOf(sites) {
  return Object.fromEntries(FIGURES.map(name => {
    const known = sites.map(site => site[name]).filter(value => value !== null && value !== undefined)
    if (AMOUNTS.has(name) && known.length === 0) return [name, null]
    return [name, Math.round(known.reduce((sum, value) => sum + value, 0) * 100) / 100]
  }))
}

/**
 * The Sidewalk Assessment Summary tab of As-Builts & Assessments: a project's constructed sites, a row each (a site
 * approved over several months is one row, its figures summed over the range). From and To (the date-constructed
 * period, ?from=&to=, YYYY-MM-DD; a flag counts on its site's Date Constructed, else its IDR's approval day) ask the
 * backend again; From after To says so and asks nothing. Task order (?task_order=, the project's task orders, "All task
 * orders" to start) asks again for its sites only, and narrows both downloads too. The search box (?q=) narrows the
 * rows in the page by block, lot, address or violation no. The table: the address (a link to the site's page, its
 * block, lot and violation under it), CB, the workbook's 4" and 7" columns, Grand Total, Remarks and a Construction
 * Report download (the most recently approved IDR's); a totals row of the rows shown. Below it "Download tailored
 * report" (the rows shown, one tab, off when none is) and "Download accumulative report" (the project's workbook, a tab
 * per month), each XLSX or CSV from its menu.
 * Props: projectId.
 */
export default function SidewalkAssessmentTab({ projectId }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''
  const search = searchParams.get('q') || ''
  const taskOrderId = searchParams.get('task_order') || ''
  const backwards = Boolean(from && to && from > to)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [taskOrders, setTaskOrders] = useState([])

  // The project's task orders, for the filter; without them the filter offers "All task orders" alone
  useEffect(() => {
    let ignore = false
    listTaskOrders(projectId)
      .then(found => { if (!ignore) setTaskOrders(found ?? []) })
      .catch(() => { if (!ignore) setTaskOrders([]) })
    return () => { ignore = true }
  }, [projectId])

  useEffect(() => {
    if (backwards) return // the backend would refuse it; the hint under the pickers says why nothing loads
    let ignore = false
    setLoading(true)
    setError(null)
    getAssessmentSites(projectId, { from, to, taskOrderId: taskOrderId || undefined })
      .then(found => { if (!ignore) setData(found) })
      .catch(err => { if (!ignore) setError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [projectId, from, to, taskOrderId, backwards, attempt])

  // Written with replace, so typing doesn't pile up history; an emptied value leaves the URL
  const change = (key, value) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    setSearchParams(params, { replace: true })
  }

  const sites = useMemo(() => (data?.sites ?? []).filter(site => matchesSearch(site, search)), [data, search])
  const totals = useMemo(() => totalsOf(sites), [sites])
  const shown = !backwards && !loading && !error && data
  const searching = Boolean(search.trim())

  return (
    <section aria-label="Sidewalk Assessment Summary">
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div>
            <label htmlFor="assessment-from" className="input-label">Constructed from</label>
            <input id="assessment-from" type="date" className="input-field" value={from}
              onChange={(e) => change('from', e.target.value)} />
          </div>
          <div>
            <label htmlFor="assessment-to" className="input-label">Constructed to</label>
            <input id="assessment-to" type="date" className="input-field" value={to}
              onChange={(e) => change('to', e.target.value)} />
          </div>
          <div>
            <label htmlFor="assessment-task-order" className="input-label">Task order</label>
            <select id="assessment-task-order" className="input-field" value={taskOrderId}
              onChange={(e) => change('task_order', e.target.value)}>
              <option value="">All task orders</option>
              {taskOrders.map(order => <option key={order.id} value={order.id}>{order.task_order_number}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="assessment-search" className="input-label">Search</label>
            <input
              id="assessment-search"
              type="search"
              className="input-field"
              placeholder="Block/lot, address or violation #"
              value={search}
              onChange={(e) => change('q', e.target.value)}
            />
          </div>
        </div>
        {backwards && <p role="alert" className="mt-2 text-sm text-red-600">From can't be after To.</p>}
      </div>

      {backwards ? null : loading ? (
        <div className="flex justify-center py-12">
          <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
        </div>
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-red-600 mb-4">Couldn't load the constructed sites: {error}</p>
          <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
        </div>
      ) : shown && (
        <>
          <p className="text-sm text-gray-600 mb-3">
            {sites.length === 1 ? '1 site' : `${sites.length} sites`}
            {searching && ` of ${data.sites.length}`}
          </p>
          {sites.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
              {searching ? `No constructed sites match "${search.trim()}".`
                : from || to ? 'No sites were constructed in this period.' : 'No constructed sites yet.'}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
              <table aria-label="Constructed sites" className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    {HEADINGS.map(heading => (
                      <th key={heading} scope="col" className="px-3 py-3 align-bottom">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sites.map(site => (
                    <tr key={site.property_id}>
                      <td className="px-3 py-3 min-w-48">
                        <Link
                          to={`/project/${projectId}/properties/${site.property_id}`}
                          className="font-medium text-construction-700 hover:underline"
                        >
                          {site.display_address}
                        </Link>
                        {siteDetails(site) && <p className="text-xs text-gray-500">{siteDetails(site)}</p>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-gray-700">{site.community_board || '—'}</td>
                      {FIGURES.map(name => (
                        <td key={name} className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-gray-900">
                          {figure(name, site[name])}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-gray-600 min-w-40">{site.remarks.join('; ') || '—'}</td>
                      <td className="px-3 py-3">
                        <DownloadFileButton
                          label="PDF"
                          download={() => downloadConstructionReport(site.property_id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-semibold text-gray-900">
                  <tr>
                    <th scope="row" className="px-3 py-3 text-left">Totals</th>
                    <td className="px-3 py-3"></td>
                    {FIGURES.map(name => (
                      <td key={name} className="px-3 py-3 whitespace-nowrap text-right tabular-nums">
                        {figure(name, totals[name])}
                      </td>
                    ))}
                    <td className="px-3 py-3" colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap justify-end gap-4 mt-6">
        <DownloadFileButton
          label="Download tailored report"
          formats={DOWNLOAD_FORMATS}
          enabled={Boolean(shown) && sites.length > 0}
          disabledTitle="No sites in this view"
          download={(format) => downloadTailoredAssessmentSummary(projectId, {
            from, to, format, taskOrderId: taskOrderId || undefined,
            propertyIds: searching ? sites.map(site => site.property_id) : undefined,
          })}
        />
        <DownloadFileButton
          label="Download accumulative report"
          formats={DOWNLOAD_FORMATS}
          download={(format) => downloadAssessmentSummary(projectId, { format, taskOrderId: taskOrderId || undefined })}
        />
      </div>
    </section>
  )
}
