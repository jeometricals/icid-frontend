import Modal from './Modal'

/**
 * Yes/No confirmation for a destructive action, e.g. "Delete this attachment?". The caller runs the action:
 * it sets busy while it works (buttons disabled, dialog can't be dismissed) and error if it failed (shown above the buttons).
 * Props: title, message, confirmLabel (default 'Yes'), cancelLabel (default 'No'), onConfirm, onCancel, busy, error.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm,
  onCancel,
  busy = false,
  error = null,
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="btn-danger">
            {busy ? 'Working...' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-gray-700">{message}</p>
      {error && (
        <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>
      )}
    </Modal>
  )
}
