import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { getPropertyWorkHistory } from '../services/api'
import { WORK_TYPES } from '../lib/reportSites'

/** One import's work, as the history words it: the type's label, or the text of 'other' in quotes. */
export function workLabel(entry) {
  if (entry.work_type === 'other') return `"${entry.work_type_other ?? 'Other'}"`
  return WORK_TYPES.find(type => type.value === entry.work_type)?.label ?? entry.work_type
}

/**
 * A property's Work history (Slice V2): every time an IDR's report imported it, newest work date first, as
 * "Excavation on 10/19/26 reported by Genghis Khan, IDR# 123AB" ("Draft" for an IDR nobody has accepted). A deleted
 * IDR's line is struck through and marked (deleted); a returned one is marked (returned). Read-only, for everyone on
 * the project. Props: propertyId.
 */
export default function WorkHistorySection({ propertyId }) {
  const [state, setState] = useState({ status: 'loading', error: null, rows: [] })

  useEffect(() => {
    let ignore = false
    setState({ status: 'loading', error: null, rows: [] })
    getPropertyWorkHistory(propertyId)
      .then(rows => { if (!ignore) setState({ status: 'ready', error: null, rows }) })
      .catch(err => { if (!ignore) setState({ status: 'error', error: err.message, rows: [] }) })
    return () => { ignore = true }
  }, [propertyId])

  return (
    <section aria-labelledby="work-history-heading" className="bg-white rounded-lg shadow-sm p-6 mt-8">
      <h3 id="work-history-heading" className="text-lg font-semibold text-gray-900 mb-3">Work history</h3>
      {state.status === 'loading' ? (
        <p className="text-sm text-gray-500">Loading work history…</p>
      ) : state.status === 'error' ? (
        <p className="text-sm text-red-600">Couldn't load the work history: {state.error}</p>
      ) : state.rows.length === 0 ? (
        <p className="text-sm text-gray-500">No IDR has reported work here yet.</p>
      ) : (
        <ul className="space-y-1 text-sm text-gray-900">
          {state.rows.map(entry => {
            const deleted = Boolean(entry.deleted_at)
            const returned = !deleted && entry.status === 'draft' && Boolean(entry.return_reason)
            return (
              <li key={entry.id}>
                <span className={deleted ? 'line-through text-gray-500' : ''}>
                  {workLabel(entry)} on {format(parseISO(entry.report_date), 'M/d/yy')} reported by{' '}
                  {entry.reporter_name ?? 'an unknown inspector'}, IDR# {entry.idr_number ?? 'Draft'}
                </span>
                {deleted && <span className="ml-2 text-gray-500">(deleted)</span>}
                {returned && <span className="ml-2 text-amber-700">(returned)</span>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
