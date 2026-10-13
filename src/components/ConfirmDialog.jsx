import Modal from './Modal'

/**
 * Yes/No confirmation for a destructive action, e.g. "Delete this attachment?". The caller runs the action:
 * it sets busy while it works (buttons disabled, dialog can't be dismissed) and error if it failed (shown above the buttons).
 * Props: title, message, items (optional list of lines under the message, e.g. the changes being confirmed), note (optional second paragraph under the message), confirmLabel (default 'Yes'), cancelLabel (default 'No'), confirmClassName (default 'btn-danger';
 * pass 'btn-primary' for a non-destructive confirm), onConfirm, onCancel, busy, error.
 */
export default function ConfirmDialog({
  title,
  message,
  items = null,
  note = null,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  confirmClassName = 'btn-danger',
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
          <button type="button" onClick={onConfirm} disabled={busy} className={confirmClassName}>
            {busy ? 'Working...' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-gray-700">{message}</p>
      {items && items.length > 0 && (
        <ul className="list-disc pl-5 mt-3 space-y-2 text-gray-700">
          {items.map(item => <li key={item}>{item}</li>)}
        </ul>
      )}
      {note && <p className="text-gray-700 mt-3">{note}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>
      )}
    </Modal>
  )
}
