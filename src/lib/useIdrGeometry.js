import { useCallback, useEffect, useState } from 'react'
import { getIdrFlags, getIdrSegments } from '../services/api'

/**
 * Loads an IDR's attributed flags and curb segments together (Slice X), for the SWCB's imported sites' Pay items
 * column, and reloads them on demand (after a site is imported or removed). Takes the IDR's id.
 * Returns {status ('loading' | 'ready' | 'error'), error, flags, segments, reload()}; a reload keeps the old lists until
 * the new arrive.
 */
export default function useIdrGeometry(idrId) {
  const [state, setState] = useState({ status: 'loading', error: null, flags: [], segments: [] })
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    let ignore = false
    Promise.all([getIdrFlags(idrId), getIdrSegments(idrId)])
      .then(([flags, segments]) => {
        if (!ignore) setState({ status: 'ready', error: null, flags: flags?.flags ?? [], segments: segments?.segments ?? [] })
      })
      .catch(err => { if (!ignore) setState(s => ({ ...s, status: s.status === 'ready' ? 'ready' : 'error', error: err.message })) })
    return () => { ignore = true }
  }, [idrId, generation])

  const reload = useCallback(() => setGeneration(g => g + 1), [])

  return { ...state, reload }
}
