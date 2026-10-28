import { useEffect, useState } from 'react'
import { Pencil, Unlink } from 'lucide-react'
import { getMeasurement, unbundleMeasurement, updateMeasurement } from '../../services/api'
import { shortDate } from '../../lib/shortDate'
import ConfirmDialog from '../ConfirmDialog'
import RectanglesEditor, { parseRectangles } from './RectanglesEditor'

export const FROZEN_UNBUNDLE = (idr) => `Frozen: a member is claimed by IDR ${idr ?? ''}`.trim()
export const UNBUNDLE_MESSAGE = 'Each flag goes back to a measurement of its own (its own shape and area). The bundle is '
  + 'kept, retired, for the record.'

const sf = (value) => `${Number(value).toFixed(2)} SF`
const letter = (index) => String.fromCharCode(65 + index)
const words = (type) => (type === 'subtract_feature' ? 'Subtracted feature' : 'Non-assessable area')

/**
 * A bundle's panel (Slice Y4a), for an OE or RE on the project, or an admin: its number (M1, the workspace's),
 * outline (each rectangle) and outer area, its deductions (each with the flag it came from), its members with their
 * shares and quantities, who formed it and when, whether it needs re-measuring and whether it is frozen. "Mark
 * re-measured" (when it needs it), "Edit outline" (a new outline is the re-measurement; not on a frozen bundle) and
 * "Unbundle" (asked first; disabled with the reason on a frozen bundle).
 * Props: measurementId, number, flags (the PIR's, for the members' numbers), onChanged(measurement), onUnbundled().
 */
export default function BundlePanel({ measurementId, number, flags, onChanged, onUnbundled }) {
  const [bundle, setBundle] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [editing, setEditing] = useState(null) // the outline being typed, or null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(null) // {error} while the unbundle is asked

  useEffect(() => {
    let ignore = false
    setBundle(null)
    setLoadError(null)
    getMeasurement(measurementId)
      .then(found => { if (!ignore) setBundle(found) })
      .catch(err => { if (!ignore) setLoadError(err.message) })
    return () => { ignore = true }
  }, [measurementId])

  if (loadError) return <p role="alert" className="text-sm text-red-600">Couldn't load the bundle: {loadError}</p>
  if (!bundle) return <p role="status" className="text-sm text-gray-600">Loading the bundle...</p>

  const flagNumber = (id) => flags.find(flag => flag.id === id)?.display_order ?? '?'
  const rectangles = bundle.outer_dimensions?.rectangles ?? []

  const save = async (data) => {
    setBusy(true)
    setError(null)
    try {
      const saved = await updateMeasurement(bundle.measurement_id, data)
      setBundle(saved)
      setEditing(null)
      onChanged?.(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const unbundle = async () => {
    setBusy(true)
    try {
      await unbundleMeasurement(bundle.measurement_id)
    } catch (err) {
      setConfirming({ error: err.message })
      setBusy(false)
      return
    }
    setBusy(false)
    setConfirming(null)
    onUnbundled?.()
  }

  return (
    <div className="space-y-4" data-testid="bundle-panel">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Bundle M{number}</h3>
        <p className="text-xs text-gray-600">
          {bundle.members.length} flags · {bundle.surveyed_thickness === '7in' ? '7"' : '4"'}
          {bundle.surveyed_is_assessable ? ', assessable' : ', not assessable'}
          {bundle.created_by_name ? ` · formed by ${bundle.created_by_name}` : ''} {shortDate(bundle.created_at)}
        </p>
        {bundle.frozen && (
          <p className="mt-1 text-xs font-medium text-emerald-700">Frozen: claimed by IDR {bundle.claimed_by_idr_number}</p>
        )}
      </div>

      {bundle.needs_remeasure && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
          <p>Needs re-measuring: its flags changed since it was measured.</p>
          <button type="button" onClick={() => save({ needs_remeasure: false })} disabled={busy}
            className="btn-secondary mt-2 text-sm">Mark re-measured</button>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800">Outline</h4>
          {!editing && (
            <span title={bundle.frozen ? FROZEN_UNBUNDLE(bundle.claimed_by_idr_number) : undefined} className="inline-flex">
              <button type="button" disabled={bundle.frozen || busy}
                onClick={() => setEditing(rectangles.map(({ L, W }) => ({ L: String(L), W: String(W) })))}
                className="inline-flex items-center gap-1 text-sm font-medium text-construction-700 hover:underline disabled:text-gray-400">
                <Pencil className="h-3.5 w-3.5" />Edit outline
              </button>
            </span>
          )}
        </div>
        {editing ? (
          <div className="mt-2">
            <RectanglesEditor rectangles={editing} onChange={setEditing} disabled={busy} />
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={busy || editing.some(({ L, W }) => !(Number(L) > 0 && Number(W) > 0))}
                onClick={() => save({ outer_dimensions: { rectangles: parseRectangles(editing) } })}
                className="btn-primary text-sm">{busy ? 'Saving...' : 'Save outline'}</button>
              <button type="button" onClick={() => setEditing(null)} disabled={busy} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <ul className="mt-1 text-sm text-gray-700">
            {rectangles.map(({ L, W }, index) => (
              <li key={index}>{rectangles.length > 1 ? `${letter(index)}: ` : ''}{Number(L).toFixed(2)} x {Number(W).toFixed(2)} ft</li>
            ))}
            <li className="font-medium" data-testid="bundle-outer-area">Outer area {sf(bundle.outer_area)}</li>
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-800">Deductions</h4>
        {bundle.deductions.length === 0 ? (
          <p className="text-sm text-gray-600">None (covers under 1 SF stay on their flags).</p>
        ) : (
          <ul className="text-sm text-gray-700">
            {bundle.deductions.map((d, index) => (
              <li key={index}>{words(d.type)} (flag #{flagNumber(d.source_flag_id)}) {sf(d.area_sf)}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-800">Members</h4>
        <table className="mt-1 w-full text-sm text-gray-700">
          <thead><tr className="text-left text-xs text-gray-500"><th>Flag</th><th>Share</th><th className="text-right">Quantity</th></tr></thead>
          <tbody>
            {bundle.members.map(member => (
              <tr key={member.flag_id} data-member={member.flag_id}>
                <td>#{member.display_order}{member.claimed_by_idr_id ? ' (claimed)' : ''}</td>
                <td>{Number(member.area_share_fraction).toFixed(4)}</td>
                <td className="text-right">{sf(member.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <span title={bundle.frozen ? FROZEN_UNBUNDLE(bundle.claimed_by_idr_number) : undefined} className="inline-flex">
        <button type="button" disabled={bundle.frozen || busy} onClick={() => setConfirming({ error: null })}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed">
          <Unlink className="h-4 w-4" />Unbundle
        </button>
      </span>

      {confirming && (
        <ConfirmDialog
          title={`Unbundle M${number}?`}
          message={UNBUNDLE_MESSAGE}
          confirmLabel="Unbundle"
          cancelLabel="Keep it"
          onConfirm={unbundle}
          onCancel={() => setConfirming(null)}
          busy={busy}
          error={confirming.error}
        />
      )}
    </div>
  )
}
