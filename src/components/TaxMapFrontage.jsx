import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import { refreshTaxMap } from '../services/api'
import { frontageText, taxMapSourceLabel } from '../lib/taxMap'

export const UNAVAILABLE = 'unavailable'

/**
 * A sidewalk's tax-map frontage on Site Info (Slice Y1): "25.00 ft · MapPLUTO 26v2 · fetched 2026-11-05" ("set" for a
 * manual one), or "— · unavailable" while it has none (MapPLUTO is asked after the site is added, so a new site may show
 * that for a moment). An admin also gets Refresh, which asks MapPLUTO again now and hands the result to onRefreshed; a
 * refusal (no usable frontage, MapPLUTO down, ...) shows under it with the backend's words.
 * Props: property, admin, onRefreshed({frontage_ft, source, fetched_at, pages_updated}).
 */
export default function TaxMapFrontage({ property, admin, onRefreshed }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const frontage = frontageText(property.tax_map_frontage_ft)
  const source = taxMapSourceLabel(property.tax_map_source)
  const when = property.tax_map_fetched_at
    ? `${property.tax_map_source === 'manual' ? 'set' : 'fetched'} ${format(parseISO(property.tax_map_fetched_at), 'yyyy-MM-dd')}`
    : null
  const line = frontage ? [frontage, source, when].filter(Boolean).join(' · ') : `— · ${UNAVAILABLE}`

  const refresh = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      onRefreshed(await refreshTaxMap(property.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span>{line}</span>
        {admin && (
          <button type="button" onClick={refresh} disabled={busy}
            className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs">
            <RefreshCw className={`h-3 w-3${busy ? ' animate-spin' : ''}`} aria-hidden="true" />
            <span>{busy ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
