import { useCallback, useEffect, useState } from 'react'
import { getPayItemSources } from '../services/api'

/**
 * Loads an IDR's pay items by source for one report (Slice V1) and reloads them on demand.
 * Takes the IDR's and the report's ids.
 * Returns {status ('loading' | 'ready' | 'error'), error, data, reload()}; a reload keeps the old data until the new arrives.
 */
export default function usePayItemSources(idrId, reportId) {
  const [state, setState] = useState({ status: 'loading', error: null, data: null })
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    let ignore = false
    getPayItemSources(idrId, reportId)
      .then(data => { if (!ignore) setState({ status: 'ready', error: null, data }) })
      .catch(err => { if (!ignore) setState(s => ({ ...s, status: s.data ? 'ready' : 'error', error: err.message })) })
    return () => { ignore = true }
  }, [idrId, reportId, generation])

  const reload = useCallback(() => setGeneration(g => g + 1), [])

  return { ...state, reload }
}
