import { useCallback, useEffect, useState } from 'react'
import { listReportSites } from '../services/api'

/**
 * Loads a report's imported sites (Slice U2) and keeps them as they change on the page.
 * Takes the IDR's and the report's ids.
 * Returns {status ('loading' | 'ready' | 'error'), error, rows, added(sites), changed(site), removed(siteId)}.
 */
export default function useReportSites(idrId, reportId) {
  const [state, setState] = useState({ status: 'loading', error: null, rows: [] })

  useEffect(() => {
    let ignore = false
    setState({ status: 'loading', error: null, rows: [] })
    listReportSites(idrId, reportId)
      .then(rows => { if (!ignore) setState({ status: 'ready', error: null, rows }) })
      .catch(err => { if (!ignore) setState({ status: 'error', error: err.message, rows: [] }) })
    return () => { ignore = true }
  }, [idrId, reportId])

  const added = useCallback(sites => setState(s => ({ ...s, rows: [...s.rows, ...sites] })), [])
  const changed = useCallback(site => setState(s => ({ ...s, rows: s.rows.map(row => (row.id === site.id ? site : row)) })), [])
  const removed = useCallback(siteId => setState(s => ({ ...s, rows: s.rows.filter(row => row.id !== siteId) })), [])

  return { ...state, added, changed, removed }
}
