import { Eye, EyeOff, Spline, Trash2 } from 'lucide-react'

export const STRIP_NO_SCALE = "Set this page's scale to draw its sidewalk strip."
export const STRIP_NO_ROLE = 'Only an OE, an RE or an admin draws the sidewalk strip.'
export const STRIP_HINT = 'Click the property line first, then round the strip to the curb. Enter or double-click to finish, Esc to cancel.'

const BUTTON = 'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium '
  + 'disabled:opacity-50 disabled:cursor-not-allowed'
const PLAIN = `${BUTTON} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`
const ACTIVE = `${BUTTON} border-red-600 bg-red-50 text-red-700`

/**
 * The sketch toolbar's sidewalk strip (Slice Y1.5): "Sidewalk strip" starts drawing it (or redraws it), with a hint and
 * Finish / Cancel while drawing, how many flags the points so far would mark non-assessable, the saved strip's
 * frontage, "Clear strip" and a show / hide toggle. Disabled, with its reason as a tooltip, for anyone who may not draw
 * it or on a page without a scale; a reader still gets the toggle.
 * Props: strip (the saved points, or null), drawing, points (drawn so far), wouldFlip (how many flags the points would
 * mark), frontageFt (the saved strip's), canDraw, disabledReason, busy, shown, onStart, onFinish, onCancel, onClear,
 * onToggleShown.
 */
export default function StripControl({
  strip, drawing, points, wouldFlip, frontageFt, canDraw, disabledReason, busy, shown, onStart, onFinish, onCancel,
  onClear, onToggleShown,
}) {
  if (drawing) {
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="strip-drawing">
        <span className={ACTIVE}><Spline className="h-4 w-4" />Drawing the sidewalk strip</span>
        <span className="text-xs text-gray-600 max-w-xs">{STRIP_HINT}</span>
        <span className="text-xs text-gray-700" aria-live="polite">
          {points.length} point{points.length === 1 ? '' : 's'}
          {points.length >= 3 ? ` · ${wouldFlip} flag${wouldFlip === 1 ? '' : 's'} would be marked non-assessable` : ''}
        </span>
        <button type="button" onClick={onFinish} disabled={busy || points.length < 3} className="btn-primary text-sm">
          {busy ? 'Saving...' : 'Finish'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary text-sm">Cancel</button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span title={canDraw ? undefined : disabledReason} className="inline-flex">
        <button type="button" onClick={onStart} disabled={!canDraw || busy} title={canDraw ? undefined : disabledReason}
          className={PLAIN}>
          <Spline className="h-4 w-4 text-red-600" />
          <span>{strip ? 'Redraw sidewalk strip' : 'Sidewalk strip'}</span>
        </button>
      </span>
      {strip && (
        <>
          {frontageFt != null && <span className="text-xs text-gray-700">Strip frontage {frontageFt.toFixed(2)} ft</span>}
          <button type="button" onClick={onToggleShown} className={PLAIN} aria-pressed={shown}>
            {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{shown ? 'Hide strip' : 'Show strip'}</span>
          </button>
          {canDraw && (
            <button type="button" onClick={onClear} disabled={busy} className={`${PLAIN} text-red-600`}>
              <Trash2 className="h-4 w-4" />
              <span>Clear strip</span>
            </button>
          )}
        </>
      )}
    </div>
  )
}
