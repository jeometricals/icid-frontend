import { useState } from 'react'
import Modal from '../Modal'

/**
 * Asks a reviewer for a pay item's new quantity. The caller runs the revision: it sets busy while it works and
 * error if it failed. Revise stays disabled until a number other than the current quantity is typed.
 * Props: item (the pay item: itemNo, description, payQuantity, unit), onConfirm(quantity) (the number as typed),
 * onCancel, busy, error.
 */
export default function RevisePayItemModal({ item, onConfirm, onCancel, busy = false, error = null }) {
  const [quantity, setQuantity] = useState('')
  const typed = quantity.trim()
  const unchanged = typed !== '' && Number(typed) === Number(item.payQuantity) && String(item.payQuantity).trim() !== ''

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !typed || unchanged) return
    onConfirm(typed)
  }

  return (
    <Modal
      title="Revise quantity"
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="revise-pay-item-form" disabled={busy || !typed || unchanged} className="btn-primary">
            {busy ? 'Revising...' : 'Revise'}
          </button>
        </>
      }
    >
      <form id="revise-pay-item-form" onSubmit={handleSubmit}>
        <p className="text-sm text-gray-700 mb-3">
          {[item.itemNo, item.description].filter(Boolean).join(' — ') || 'Pay item'}
          {' · '}now {item.payQuantity || '(blank)'}{item.unit ? ` ${item.unit}` : ''}
        </p>
        <label htmlFor="revised-quantity" className="input-label">New quantity</label>
        <input
          id="revised-quantity"
          type="number"
          step="any"
          className="input-field"
          value={quantity}
          disabled={busy}
          autoFocus
          required
          onChange={(e) => setQuantity(e.target.value)}
        />
        <p className="text-sm text-gray-500 mt-2">
          The inspector's quantity stays on the report, crossed out; yours is the one that counts.
        </p>
        {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      </form>
    </Modal>
  )
}
