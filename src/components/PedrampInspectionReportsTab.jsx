import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import {
  LISTING_PAGE_SIZE, bulkDownloadPedRampInspections, downloadFile, getInspectionDotPdf, listPedRampInspections, listUsers,
} from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { personName } from '../lib/personName'
import { shortDate } from '../lib/shortDate'
import StatusBadge from './StatusBadge'

// How long the search box waits after the last keystroke before it asks again
export const SEARCH_DEBOUNCE_MS = 300
// The URL's names for the filters (the tab's own; ?tab= is the page's)
const FILTER_KEYS = ['status', 'inspector', 're', 'from', 'to', 'has_tif', 'q', 'page']
const STATUSES = [['draft', 'Draft'], ['submitted', 'Submitted'], ['approved', 'Approved']]
const HEADINGS = ['Corner', 'Ramps', 'Status', 'Inspector', 'RE', 'Approved', 'TIFs', 'Actions']

/** The filters as the service takes them, read off the URL. */
function filtersFrom(searchParams) {
  return {
    status: searchParams.get('status') || '', inspectorUuid: searchParams.get('inspector') || '',
    reUuid: searchParams.get('re') || '', from: searchParams.get('from') || '', to: searchParams.get('to') || '',
    hasTif: searchParams.get('has_tif') || '', q: searchParams.get('q') || '',
  }
}

// One row's Download: signs the stored DOT PDF's URL and opens it; a failure under the button
function DotPdfButton({ inspectionId }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      const { url, file_name: fileName } = await getInspectionDotPdf(inspectionId)
      downloadFile(url, fileName)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button type="button" onClick={download} disabled={busy} className="btn-secondary flex items-center gap-1 text-sm">
        <Download className="h-4 w-4" /><span>{busy ? 'Preparing...' : 'Download'}</span>
      </button>
      {error && <p role="alert" className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  )
}

/**
 * The Pedramp Inspection Reports tab of As-Builts & Assessments: a project's corners with an inspection, a row each
 * (the corner, a link to its As-Built Inspection Form; its live ramps; status; inspector; RE; the approval's day; its
 * TIFs; and Download for one with a stored DOT PDF), approved newest first, 30 a page. Filters in the URL: approved
 * from / to (?from=&to=), status, inspector and RE (?inspector=&re=; not for a demo user, who has no user list),
 * has a TIF (?has_tif=yes|no), a search on the streets or a ramp's Ramp ID (?q=, 300 ms after the last keystroke) and
 * ?page=. "Download all (zip)" asks the backend for the approved ones' DOT PDFs under the same filters and opens the
 * link. Every refusal reads as the backend words it. Props: projectId.
 */
export default function PedrampInspectionReportsTab({ projectId }) {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = filtersFrom(searchParams)
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1)
  const [text, setText] = useState(filters.q)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [users, setUsers] = useState([])
  const [usersError, setUsersError] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState(null)
  const [bulkNote, setBulkNote] = useState(null)
  const showPeople = Boolean(user) && !user.is_demo

  // Writes filters to the URL (and back to page 1, unless the page is what changed), keeping ?tab=
  const latestSearch = useRef(searchParams)
  latestSearch.current = searchParams
  const change = (patch, { replace = false } = {}) => {
    const next = new URLSearchParams(latestSearch.current)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, String(value))
      else next.delete(key)
    }
    if (!('page' in patch)) next.delete('page')
    setSearchParams(next, { replace })
  }
  const latestChange = useRef(change)
  latestChange.current = change

  // The search changed from outside (Clear, Back, a pasted link): show it, unless it is what's already typed
  useEffect(() => {
    setText((current) => (current.trim() === filters.q ? current : filters.q))
  }, [filters.q])

  useEffect(() => {
    const q = text.trim()
    if (q === filters.q) return
    const timer = setTimeout(() => latestChange.current({ q }, { replace: true }), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, filters.q])

  useEffect(() => {
    if (!showPeople) return
    let ignore = false
    listUsers()
      .then((found) => { if (!ignore) setUsers([...found].sort((a, b) => personName(a).localeCompare(personName(b)))) })
      .catch((err) => { if (!ignore) setUsersError(err.message) })
    return () => { ignore = true }
  }, [showPeople])

  const query = searchParams.toString()
  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    listPedRampInspections(projectId, { ...filtersFrom(new URLSearchParams(query)), page, pageSize: LISTING_PAGE_SIZE })
      .then((found) => { if (!ignore) setData(found) })
      .catch((err) => { if (!ignore) setError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [projectId, query, page, attempt])

  const downloadAll = async () => {
    setBulkBusy(true)
    setBulkError(null)
    setBulkNote(null)
    try {
      const { url, file_name: fileName, corner_count: count } = await bulkDownloadPedRampInspections(projectId, filters)
      downloadFile(url, fileName)
      setBulkNote(`${count} corner${count === 1 ? '' : 's'} in ${fileName}`)
    } catch (err) {
      setBulkError(err.message)
    } finally {
      setBulkBusy(false)
    }
  }

  const clear = () => {
    setText('')
    change(Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])))
  }
  const anySet = FILTER_KEYS.some((key) => searchParams.get(key)) || Boolean(text)
  const pages = data ? Math.max(1, Math.ceil(data.total / LISTING_PAGE_SIZE)) : 1

  const personSelect = (id, label, key, value) => (
    <div>
      <label htmlFor={id} className="input-label">{label}</label>
      <select id={id} className="input-field" value={value} onChange={(e) => change({ [key]: e.target.value })}>
        <option value="">Anyone</option>
        {users.map((person) => (
          <option key={person.user_id} value={person.user_id}>{personName(person)}</option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="space-y-4">
      <section aria-label="Filters" className="bg-white rounded-lg shadow-sm p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="pedramp-search" className="input-label">Search</label>
            <input id="pedramp-search" type="search" className="input-field" placeholder="Street or Ramp ID"
              value={text} onChange={(e) => setText(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label htmlFor="pedramp-from" className="input-label">Approved from</label>
            <input id="pedramp-from" type="date" className="input-field" value={filters.from} max={filters.to || undefined}
              onChange={(e) => change({ from: e.target.value })} />
          </div>
          <div>
            <label htmlFor="pedramp-to" className="input-label">Approved to</label>
            <input id="pedramp-to" type="date" className="input-field" value={filters.to} min={filters.from || undefined}
              onChange={(e) => change({ to: e.target.value })} />
          </div>
          <div>
            <label htmlFor="pedramp-status" className="input-label">Status</label>
            <select id="pedramp-status" className="input-field" value={filters.status} onChange={(e) => change({ status: e.target.value })}>
              <option value="">Any</option>
              {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {showPeople && personSelect('pedramp-inspector', 'Inspector', 'inspector', filters.inspectorUuid)}
          {showPeople && personSelect('pedramp-re', 'RE', 're', filters.reUuid)}
          <div>
            <label htmlFor="pedramp-has-tif" className="input-label">Has a TIF</label>
            <select id="pedramp-has-tif" className="input-field" value={filters.hasTif} onChange={(e) => change({ has_tif: e.target.value })}>
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
        {usersError && <p className="text-sm text-red-700 mt-2">Couldn't load the user list: {usersError}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
          <button type="button" onClick={clear} disabled={!anySet} className="btn-secondary text-sm">Clear filters</button>
          <div className="text-right">
            <button type="button" onClick={downloadAll} disabled={bulkBusy} className="btn-primary flex items-center gap-1">
              <Download className="h-4 w-4" /><span>{bulkBusy ? 'Preparing zip...' : 'Download all (zip)'}</span>
            </button>
            {bulkError && <p role="alert" className="text-sm text-red-700 mt-1">{bulkError}</p>}
            {bulkNote && <p className="text-sm text-gray-600 mt-1">{bulkNote}</p>}
          </div>
        </div>
      </section>

      {loading && !data && <p role="status" className="text-gray-600">Loading inspections...</p>}
      {error && (
        <div role="alert" className="bg-red-50 text-red-800 rounded-lg p-4">
          Couldn't load the inspections: {error}{' '}
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="underline">Retry</button>
        </div>
      )}
      {data && !error && (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          {data.rows.length === 0 ? (
            <p className="p-8 text-center text-gray-600">
              {anySet ? 'No inspections match these filters.' : 'No corner has an inspection yet.'}
            </p>
          ) : (
            <table aria-label="Ped ramp inspections" className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>{HEADINGS.map((heading) => <th key={heading} scope="col" className="px-4 py-2 font-medium">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((row) => (
                  <tr key={row.inspection_id}>
                    <td className="px-4 py-2">
                      <Link to={`/project/${projectId}/ped-ramp-corners/${row.corner_id}/inspection`} className="text-construction-700 hover:underline font-medium">
                        {row.corner_name}{row.corner_direction ? ` (${row.corner_direction})` : ''}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{row.ramp_count}</td>
                    <td className="px-4 py-2"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-2">{row.inspector_name || '—'}</td>
                    <td className="px-4 py-2">{row.re_name || '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{row.approved_at ? shortDate(row.approved_at) : '—'}</td>
                    <td className="px-4 py-2">{row.tif_count}</td>
                    <td className="px-4 py-2">{row.has_dot_pdf ? <DotPdfButton inspectionId={row.inspection_id} /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <nav aria-label="Pages" className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
            <span>{data.total} corner{data.total === 1 ? '' : 's'} · page {page} of {pages}</span>
            <span className="flex gap-2">
              <button type="button" className="btn-secondary text-sm" disabled={page <= 1 || loading}
                onClick={() => change({ page: page - 1 > 1 ? page - 1 : '' })}>Previous</button>
              <button type="button" className="btn-secondary text-sm" disabled={page >= pages || loading}
                onClick={() => change({ page: page + 1 })}>Next</button>
            </span>
          </nav>
        </div>
      )}
    </div>
  )
}
