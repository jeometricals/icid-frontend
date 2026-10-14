import { useState } from 'react'
import Modal from './Modal'
import { setPirPageScale } from '../services/api'

// A scale as typed is usable when it is a finite number above 0
const scaleOf = (typed) => (typed.trim() !== '' && Number.isFinite(Number(typed)) && Number(typed) > 0 ? Number(typed) : null)

/**
 * Sets one PIR page's scale in pixels per foot: a number above 0, the page's own to start (blank when it has none),
 * "Applies to page {n}." under it. Save sends it (PATCH /pir-pages/{id}/scale) and hands the page back; a refusal
 * shows inline and the dialog stays open.
 * Props: page (pir_page_id, page_number, scale_px_per_ft), onSaved(page), onClose.
 */
export default function PageScaleModal({ page, onSaved, onClose }) {
  const [scale, setScale] = useState(page.scale_px_per_ft == null ? '' : String(page.scale_px_per_ft))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const value = scaleOf(scale)
  const changed = value !== null && value !== page.scale_px_per_ft

  const save = async () => {
    if (busy || !changed) return
    setBusy(true)
    setError(null)
    try {
      onSaved(await setPirPageScale(page.pir_page_id, value))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Page scale"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="button" onClick={save} disabled={busy || !changed} className="btn-primary">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-2">
        <label htmlFor="page-scale" className="input-label">Scale (px/ft)</label>
        <input
          id="page-scale"
          type="number"
          min="0"
          step="any"
          className="input-field w-40"
          placeholder="e.g. 15"
          value={scale}
          disabled={busy}
          onChange={(e) => setScale(e.target.value)}
        />
        <p className="text-sm text-gray-600">Applies to page {page.page_number}.</p>
        {scale.trim() !== '' && value === null && (
          <p role="alert" className="text-sm text-red-600">The scale is a number above 0.</p>
        )}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
