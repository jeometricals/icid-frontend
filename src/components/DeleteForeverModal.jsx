import { useState } from 'react'
import Modal from './Modal'

/**
 * The confirmation for deleting something for good (an IDR, a user): a red warning, and a box the admin must type
 * a phrase into (the IDR's number, the user's email) before "Delete forever" turns on. The phrase must match
 * exactly as typed: no trimming, and capitals count. The caller runs the delete: it sets busy while it works and
 * error if it failed.
 * Props: title, warning (what will go, in the red box), phrase (what must be typed), note (optional line under the
 * warning), onConfirm, onCancel, busy, error.
 */
export default function DeleteForeverModal({ title, warning, phrase, note = null, onConfirm, onCancel, busy = false, error = null }) {
  const [typed, setTyped] = useState('')
  const matches = typed === phrase

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !matches) return
    onConfirm()
  }

  return (
    <Modal
      title={title}
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="delete-forever-form" disabled={busy || !matches} className="btn-danger">
            {busy ? 'Working...' : 'Delete forever'}
          </button>
        </>
      }
    >
      <form id="delete-forever-form" onSubmit={handleSubmit} noValidate autoComplete="off">
        <p role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md px-4 py-3">
          {warning}
        </p>
        {note && <p className="text-sm text-gray-700 mt-3">{note}</p>}

        <label htmlFor="delete-forever-phrase" className="input-label mt-4">
          Type <span className="font-mono font-semibold break-all">{phrase}</span> to confirm.
        </label>
        <input
          id="delete-forever-phrase"
          type="text"
          className="input-field"
          value={typed}
          disabled={busy}
          autoFocus
          autoComplete="off"
          onChange={(e) => setTyped(e.target.value)}
        />

        {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      </form>
    </Modal>
  )
}
