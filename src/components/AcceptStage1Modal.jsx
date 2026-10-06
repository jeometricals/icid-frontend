import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from './Modal'

/**
 * Asks the reviewer picking an IDR up at Stage 1 for its IDR number: free text, required. The caller runs the
 * accept: it sets busy while it works, error if it failed, and conflictIdrId when the number is already used by
 * another IDR on the project, which the dialog links to.
 * Props: projectId (for the link), onConfirm(number) (called with the number trimmed), onCancel, busy, error,
 * conflictIdrId.
 */
export default function AcceptStage1Modal({ projectId, onConfirm, onCancel, busy = false, error = null, conflictIdrId = null }) {
  const [number, setNumber] = useState('')
  const trimmed = number.trim()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !trimmed) return
    onConfirm(trimmed)
  }

  return (
    <Modal
      title="Accept for Stage 1"
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="accept-stage1-form" disabled={busy || !trimmed} className="btn-primary">
            {busy ? 'Accepting...' : 'Accept'}
          </button>
        </>
      }
    >
      <form id="accept-stage1-form" onSubmit={handleSubmit}>
        <label htmlFor="accept-stage1-idr-number" className="input-label">IDR #</label>
        <input
          id="accept-stage1-idr-number"
          type="text"
          className="input-field"
          value={number}
          disabled={busy}
          autoFocus
          required
          onChange={(e) => setNumber(e.target.value)}
        />
        <p className="text-sm text-gray-500 mt-2">
          Required. The number stays with this IDR from here on, and can be used once per project.
        </p>
        {conflictIdrId ? (
          <p role="alert" className="text-sm text-red-600 mt-3">
            This number is already in use on{' '}
            <Link to={`/project/${projectId}/idr/${conflictIdrId}`} className="font-medium underline">
              another IDR
            </Link>
            .
          </p>
        ) : error && (
          <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>
        )}
      </form>
    </Modal>
  )
}
