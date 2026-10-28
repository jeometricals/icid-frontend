import { Route } from 'lucide-react'
import { SEGMENT_TYPES } from '../../data/flagEnums'
import { contractItemLabel } from '../../lib/segmentItems'

export const CURB_HINT = 'Click along the curb. Enter or double-click to finish, Esc to cancel.'
export const CURB_NO_ROLE = 'Only the project\'s members draw curbs (not demo users).'
export const CURB_NO_SCALE = "Set this page's scale to draw curbs."

const BUTTON = 'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium '
  + 'disabled:opacity-50 disabled:cursor-not-allowed'
const PLAIN = `${BUTTON} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`
const ACTIVE = `${BUTTON} border-gray-700 bg-gray-100 text-gray-900`
const SELECT = 'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 disabled:opacity-50'

/**
 * The sketch toolbar's curb tool (Slice Y4a), as the sidewalk strip's: the curb's type and pay item (the project's LF
 * items; none to leave it unmapped), then "Draw curb"; while drawing, the hint, how many points, Finish (two points or
 * more) and Cancel. Disabled, with its reason as a tooltip, for anyone who may not draw or on a page without a scale.
 * Props: drawing, points (drawn so far), canDraw, disabledReason, busy, type, onType, payItemId, onPayItem, lfItems,
 * onStart, onFinish, onCancel.
 */
export default function CurbControl({
  drawing, points, canDraw, disabledReason, busy, type, onType, payItemId, onPayItem, lfItems, onStart, onFinish,
  onCancel,
}) {
  const pickers = (
    <>
      <select aria-label="Curb type" value={type} onChange={(e) => onType(e.target.value)} disabled={!canDraw || busy}
        className={SELECT}>
        {SEGMENT_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="Curb pay item" value={payItemId ?? ''} onChange={(e) => onPayItem(e.target.value || null)}
        disabled={!canDraw || busy} className={`${SELECT} max-w-[14rem]`}>
        <option value="">No pay item</option>
        {lfItems.map(item => <option key={item.contract_item_id} value={item.contract_item_id}>{contractItemLabel(item)}</option>)}
      </select>
    </>
  )
  if (drawing) {
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="curb-drawing">
        <span className={ACTIVE}><Route className="h-4 w-4" />Drawing a curb</span>
        {pickers}
        <span className="text-xs text-gray-600 max-w-xs">{CURB_HINT}</span>
        <span className="text-xs text-gray-700" aria-live="polite">{points.length} point{points.length === 1 ? '' : 's'}</span>
        <button type="button" onClick={onFinish} disabled={busy || points.length < 2} className="btn-primary text-sm">
          {busy ? 'Saving...' : 'Finish'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary text-sm">Cancel</button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pickers}
      <span title={canDraw ? undefined : disabledReason} className="inline-flex">
        <button type="button" onClick={onStart} disabled={!canDraw || busy} title={canDraw ? undefined : disabledReason}
          className={PLAIN}>
          <Route className="h-4 w-4" /><span>Draw curb</span>
        </button>
      </span>
    </div>
  )
}
