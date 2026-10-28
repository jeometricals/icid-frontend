import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteSegment, updateSegment } from '../../services/api'
import { SEGMENT_TYPES, segmentTypeLabel } from '../../data/flagEnums'
import ConfirmDialog from '../ConfirmDialog'
import { contractItemLabel } from '../../lib/segmentItems'

const text = (value) => (value === null || value === undefined ? '' : String(Number(value)))
const feet = (value) => (value === null || value === undefined ? '—' : `${Number(value).toFixed(2)} LF`)

/**
 * A curb run's panel (Slice Y4a): its type, pay item (the project's LF items), its drawn length, a reported length
 * overriding it for billing (blank for none) with its reason, Save and Delete (asked first). Its points aren't edited
 * here: delete it and draw it again. A reader sees it all disabled, without Delete.
 * Props: segment, lfItems, writer, onSaved(segment), onDeleted(segment).
 */
export default function SegmentPanel({ segment, lfItems, writer, onSaved, onDeleted }) {
  const [draft, setDraft] = useState({
    segment_type: segment.segment_type, pay_item_id: segment.pay_item_id ?? '',
    reported_length_ft: text(segment.reported_length_ft), length_delta_reason: segment.length_delta_reason ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const set = (key) => (e) => setDraft(current => ({ ...current, [key]: e.target.value }))
  const reported = draft.reported_length_ft.trim()
  const badLength = reported !== '' && !(Number(reported) >= 0)

  const changes = () => {
    const out = {}
    if (draft.segment_type !== segment.segment_type) out.segment_type = draft.segment_type
    if ((draft.pay_item_id || null) !== (segment.pay_item_id ?? null)) out.pay_item_id = draft.pay_item_id || null
    const length = reported === '' ? null : Number(reported)
    if (length !== (segment.reported_length_ft === null || segment.reported_length_ft === undefined ? null : Number(segment.reported_length_ft))) {
      out.reported_length_ft = length
    }
    if (length !== null && (draft.length_delta_reason.trim() || null) !== (segment.length_delta_reason ?? null)) {
      out.length_delta_reason = draft.length_delta_reason.trim() || null
    }
    return out
  }

  const save = async () => {
    const data = changes()
    if (Object.keys(data).length === 0) return
    setBusy(true)
    setError(null)
    try {
      onSaved(await updateSegment(segment.segment_id, data))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteSegment(segment.segment_id)
    } catch (err) {
      setConfirming({ error: err.message })
      setBusy(false)
      return
    }
    setConfirming(null)
    onDeleted(segment)
  }

  const disabled = !writer || busy
  return (
    <div className="space-y-3" data-testid="segment-panel">
      <h3 className="text-base font-semibold text-gray-900">{segmentTypeLabel(segment.segment_type)}</h3>
      <p className="text-sm text-gray-700">Drawn length {feet(segment.length_ft)} · {segment.points.length} points</p>
      <label className="block text-sm text-gray-700">Type
        <select value={draft.segment_type} onChange={set('segment_type')} disabled={disabled} className="input-field mt-1 w-full">
          {SEGMENT_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="block text-sm text-gray-700">Pay item
        <select value={draft.pay_item_id} onChange={set('pay_item_id')} disabled={disabled} className="input-field mt-1 w-full">
          <option value="">No pay item</option>
          {lfItems.map(item => <option key={item.contract_item_id} value={item.contract_item_id}>{contractItemLabel(item)}</option>)}
        </select>
      </label>
      <label className="block text-sm text-gray-700">Reported length (LF, blank for the drawn one)
        <input type="number" min="0" step="0.01" value={draft.reported_length_ft} onChange={set('reported_length_ft')}
          disabled={disabled} className="input-field mt-1 w-full" />
      </label>
      {reported !== '' && (
        <label className="block text-sm text-gray-700">Why it differs
          <input type="text" value={draft.length_delta_reason} onChange={set('length_delta_reason')} disabled={disabled}
            className="input-field mt-1 w-full" />
        </label>
      )}
      {badLength && <p className="text-sm text-gray-700">A reported length is 0 or more.</p>}
      {error && <p role="alert" className="text-sm text-red-600">Couldn't save the curb: {error}</p>}
      {writer && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={busy || badLength || Object.keys(changes()).length === 0}
            className="btn-primary text-sm">{busy ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => setConfirming({ error: null })} disabled={busy}
            className="inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:underline">
            <Trash2 className="h-4 w-4" />Delete curb
          </button>
        </div>
      )}
      {confirming && (
        <ConfirmDialog title="Delete this curb?" message="It is removed from the sketch and from what IDRs bill. Draw it again to replace it."
          confirmLabel="Delete curb" cancelLabel="Keep it" onConfirm={remove} onCancel={() => setConfirming(null)}
          busy={busy} error={confirming.error} />
      )}
    </div>
  )
}
