import { useState } from 'react'
import Modal from './Modal'

/**
 * Asks a reviewer why they are sending an IDR back; used for every return (to the inspector, to the OE). The
 * comment is required: Return stays disabled until something other than spaces is typed. The caller runs the return:
 * it sets busy while it works and error if it failed.
 * Props: title, recipient (who gets the IDR back, e.g. 'the inspector'), onConfirm(comment) (called with the comment trimmed),
 * onCancel, busy, error.
 */
export default function ReturnCommentModal({ title, recipient, onConfirm, onCancel, busy = false, error = null }) {
  const [comment, setComment] = useState('')
  const trimmed = comment.trim()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !trimmed) return
    onConfirm(trimmed)
  }

  return (
    <Modal
      title={title}
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="return-comment-form" disabled={busy || !trimmed} className="btn-primary">
            {busy ? 'Returning...' : 'Return'}
          </button>
        </>
      }
    >
      <form id="return-comment-form" onSubmit={handleSubmit}>
        <label htmlFor="return-comment" className="input-label">Comment for {recipient}</label>
        <textarea
          id="return-comment"
          className="input-field"
          rows={3}
          value={comment}
          disabled={busy}
          autoFocus
          required
          onChange={(e) => setComment(e.target.value)}
        />
        <p className="text-sm text-gray-500 mt-2">Required. Say what needs to change before this IDR comes back.</p>
        {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      </form>
    </Modal>
  )
}
