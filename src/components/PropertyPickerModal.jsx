import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import Modal from './Modal'
import { bundleProperty, listProperties } from '../services/api'
import { propertyTypeLabel } from '../data/propertyTypes'
import { rampTypeLabel } from '../data/propertyKinds'
import { propertyCount } from '../lib/taskOrders'
import { siteLabel } from '../lib/properties'

// Whether a property matches the search: a sidewalk's block, lot, CB or address, a site's CB, or a ped ramp's display_address (its
// intersection), holds the text, any case
const matches = (property, text) => {
  const needle = text.trim().toLowerCase()
  return !needle || [property.block, property.lot, property.community_board, property.display_address]
    .some(text => text?.toLowerCase().includes(needle))
}

/**
 * Lets an admin pick properties of the task order's project to bundle into it: the project's live properties that
 * aren't in the task order already (read when the dialog opens), each a checkbox row with its block and lot ("Ped
 * ramp" for a ped ramp), address and type. A search box narrows the rows to a block, lot or address holding the text; "Select all shown" ticks every row shown
 * (a ticked row stays ticked when the search hides it). Add bundles the ticked ones one at a time, in the order
 * shown unfiltered, and stops at the first refusal, so nothing after it is tried; then it hands over what happened.
 * Props: taskOrder (with project_id and its properties), onClose, onDone({added, failed, taskOrder}) — added is how
 * many went in, failed {property, message} for the refusal that stopped it (or null), taskOrder the last one the
 * backend returned (or null when none went in).
 */
export default function PropertyPickerModal({ taskOrder, onClose, onDone }) {
  const [available, setAvailable] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [progress, setProgress] = useState(null) // while adding: how many have gone in

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setLoadError(null)
    const bundled = new Set(taskOrder.properties.map(property => property.id))
    listProperties(taskOrder.project_id)
      .then(found => { if (!ignore) setAvailable(found.filter(property => !bundled.has(property.id))) })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [taskOrder, attempt])

  const shown = useMemo(() => available.filter(property => matches(property, search)), [available, search])
  const busy = progress !== null
  const allShownSelected = shown.length > 0 && shown.every(property => selected.has(property.id))

  const toggle = (id) => setSelected(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const selectAllShown = () => setSelected(current => new Set([...current, ...shown.map(property => property.id)]))

  // One at a time, so a refusal stops the batch with everything before it in and nothing after it tried
  const add = async () => {
    const picked = available.filter(property => selected.has(property.id))
    let latest = null
    setProgress(0)
    for (const [index, property] of picked.entries()) {
      try {
        latest = await bundleProperty(taskOrder.id, property.id)
      } catch (err) {
        onDone({ added: index, failed: { property, message: err.message }, taskOrder: latest })
        return
      }
      setProgress(index + 1)
    }
    onDone({ added: picked.length, failed: null, taskOrder: latest })
  }

  return (
    <Modal
      title="Add sites"
      onClose={onClose}
      busy={busy}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="button" onClick={add} disabled={busy || selected.size === 0} className="btn-primary">
            {busy ? `Adding ${progress} of ${selected.size}...` : selected.size > 0 ? `Add ${propertyCount(selected.size)}` : 'Add'}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <div role="status" className="animate-spin rounded-full h-10 w-10 border-b-2 border-construction-600"></div>
        </div>
      ) : loadError ? (
        <div className="text-center py-4">
          <p className="text-red-600 mb-4">Couldn't load the project's sites: {loadError}</p>
          <button type="button" onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
        </div>
      ) : available.length === 0 ? (
        <p className="text-gray-600 py-4 text-center">
          Every site of this project is already in this task order, or the project has none yet.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              aria-label="Search by block, lot or address"
              placeholder="Search by block, lot or address"
              className="input-field pl-9"
              value={search}
              disabled={busy}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
            <span>{selected.size} selected · {shown.length} of {propertyCount(available.length)} shown</span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={selectAllShown}
                disabled={busy || allShownSelected || shown.length === 0}
                className="underline font-medium text-construction-700 disabled:text-gray-400 disabled:no-underline"
              >
                Select all shown
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                disabled={busy || selected.size === 0}
                className="underline font-medium text-construction-700 disabled:text-gray-400 disabled:no-underline"
              >
                Clear selection
              </button>
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="text-gray-600 py-4 text-center">No sites match "{search.trim()}".</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-200 border border-gray-200 rounded-md">
              {shown.map(property => (
                <li key={property.id}>
                  <label className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(property.id)}
                      disabled={busy}
                      onChange={() => toggle(property.id)}
                    />
                    <span className="font-medium text-gray-900 whitespace-nowrap">{siteLabel(property)}</span>
                    {property.community_board && (
                      <span className="text-gray-500 whitespace-nowrap">CB {property.community_board}</span>
                    )}
                    <span className="flex-1 text-gray-700">{property.display_address}</span>
                    <span className="text-gray-500 whitespace-nowrap">{property.kind === 'ped_ramp' ? rampTypeLabel(property.ramp_type) : propertyTypeLabel(property.property_type)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}
