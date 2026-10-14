import { useState } from 'react'
import { Crosshair } from 'lucide-react'
import Modal from '../Modal'
import { setPirPageScale } from '../../services/api'
import { distanceBetween } from '../../lib/pageGeometry'

/**
 * Sets a page's scale from two points on it. "Calibrate" toggles the mode (Esc, or the button again, leaves it);
 * in it the canvas takes two clicks (the page holds them, see SketchCanvas). Once both are in, a dialog asks how
 * far apart they are in feet and saves pixel distance / feet as the page's scale (PATCH /pir-pages/{id}/scale);
 * the points are in the page's native pixels, so the rotation doesn't matter. A refusal shows in the dialog.
 * Props: page, active, points ([{x, y}], up to two), onToggle(), onDone(page), onCancel(), disabled.
 */
export default function CalibrateControl({ page, active, points, onToggle, onDone, onCancel, disabled = false }) {
  const [feet, setFeet] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const pixels = points.length === 2 ? distanceBetween(points[0], points[1]) : 0
  const typed = Number(feet)
  const valid = feet.trim() !== '' && Number.isFinite(typed) && typed > 0 && pixels > 0

  const close = () => {
    setFeet('')
    setError(null)
    onCancel()
  }

  const save = async () => {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      const saved = await setPirPageScale(page.pir_page_id, Math.round((pixels / typed) * 10000) / 10000)
      setFeet('')
      setBusy(false)
      onDone(saved)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-pressed={active}
        disabled={disabled}
        onClick={onToggle}
        title="Click two points a known distance apart to set this page's scale"
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
          active ? 'border-construction-600 bg-construction-50 text-construction-800' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Crosshair className="h-4 w-4" />
        <span>Calibrate</span>
      </button>
      {active && points.length < 2 && (
        <span className="text-xs text-gray-600">
          {points.length === 0 ? 'Click the first point.' : 'Click the second point.'} Esc cancels.
        </span>
      )}

      {active && points.length === 2 && (
        <Modal
          title="Calibrate scale"
          onClose={close}
          busy={busy}
          footer={
            <>
              <button type="button" onClick={close} disabled={busy} className="btn-secondary">Cancel</button>
              <button type="button" onClick={save} disabled={busy || !valid} className="btn-primary">
                {busy ? 'Saving...' : 'Set scale'}
              </button>
            </>
          }
        >
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              The points are {pixels.toFixed(1)} px apart on page {page.page_number}.
            </p>
            <label htmlFor="calibrate-feet" className="input-label">Distance between them (ft)</label>
            <input
              id="calibrate-feet"
              type="number"
              min="0"
              step="any"
              autoFocus
              className="input-field w-40"
              value={feet}
              disabled={busy}
              onChange={(e) => setFeet(e.target.value)}
            />
            {valid && <p className="text-sm text-gray-600">Scale: {(pixels / typed).toFixed(2)} px/ft</p>}
            {pixels === 0 && <p role="alert" className="text-sm text-red-600">The two points are the same; cancel and pick two apart.</p>}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          </div>
        </Modal>
      )}
    </>
  )
}
