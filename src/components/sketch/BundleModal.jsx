import { useState } from 'react'
import { bundleFlags } from '../../services/api'
import { bundleProblem, outerArea, rectanglesProblem } from '../../lib/bundleGeometry'
import Modal from '../Modal'
import RectanglesEditor, { BLANK_RECTANGLE, parseRectangles } from './RectanglesEditor'

/**
 * Bundling the selected flags (Slice Y4a): the flags, the outline the OE measured (RectanglesEditor), the flags' own
 * areas beside the outline's, and Bundle. The backend's checks run here first (lib/bundleGeometry.js `bundleProblem`:
 * claimed, already bundled, unplaced, another classification, not one chain), so Bundle is disabled with the reason;
 * the server's refusal, if any, shows above the buttons.
 * Props: page (pir_page_id, scale_px_per_ft), flags (the selected ones), onClose, onBundled(measurement).
 */
export default function BundleModal({ page, flags, onClose, onBundled }) {
  const [rectangles, setRectangles] = useState([BLANK_RECTANGLE])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const ordered = [...flags].sort((a, b) => a.display_order - b.display_order)
  const problem = bundleProblem(ordered, page.scale_px_per_ft) ?? rectanglesProblem(rectangles)
  const own = ordered.reduce((sum, flag) => sum + Number(flag.computed_quantity ?? 0), 0)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      onBundled(await bundleFlags(page.pir_page_id, ordered.map(flag => flag.id), parseRectangles(rectangles)))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Bundle ${ordered.length} flags`}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="button" onClick={submit} disabled={busy || Boolean(problem)} className="btn-primary">
            {busy ? 'Bundling...' : 'Bundle'}
          </button>
        </>
      )}
    >
      <p className="text-sm text-gray-700 mb-2">
        Flags {ordered.map(flag => `#${flag.display_order}`).join(', ')} · their own areas {own.toFixed(2)} SF
      </p>
      <p className="text-sm text-gray-600 mb-3">
        Enter the outline as measured on site: 1 to 3 rectangles (an L or a T takes 2 or 3). The bundle is measured from
        it; each flag takes a share by its own area.
      </p>
      <RectanglesEditor rectangles={rectangles} onChange={setRectangles} disabled={busy} />
      {!problem && Math.abs(outerArea(rectangles) - own) >= 0.005 && (
        <p className="mt-2 text-xs text-amber-700" data-testid="outline-differs">
          The outline differs from the flags' own areas by {(outerArea(rectangles) - own).toFixed(2)} SF: the bundle's
          quantities follow the outline.
        </p>
      )}
      {problem && <p className="mt-3 text-sm text-gray-700" data-testid="bundle-problem">{problem}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">Couldn't bundle the flags: {error}</p>}
    </Modal>
  )
}
