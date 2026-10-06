import { useMemo, useState } from 'react'
import Modal from '../Modal'
import { catalogEntries } from './PayItemPicker'

const MANUAL = '__manual__'

/**
 * A reviewer's "Add Pay Item" form: pick the item from the project's catalog (which fills its description, unit and,
 * when it has only one, its budget code) or enter it by hand, then give the quantity. The caller runs the add: it
 * sets busy while it works and error if it failed. Add stays disabled until there is a quantity and either an item
 * number or a description.
 * Props: contractItems (the project's catalog rows; may be empty, leaving manual entry),
 * onConfirm({ itemNo, budgetCode, quantity, unit, description }), onCancel, busy, error.
 */
export default function AddPayItemModal({ contractItems = [], onConfirm, onCancel, busy = false, error = null }) {
  const entries = useMemo(() => catalogEntries(contractItems), [contractItems])
  const [picked, setPicked] = useState(entries.length > 0 ? '' : MANUAL)
  const [item, setItem] = useState({ itemNo: '', budgetCode: '', quantity: '', unit: '', description: '' })

  const entry = entries.find(e => e.itemNo === picked)
  const codes = entry?.budgetCodes ?? []
  const set = (field) => (e) => setItem(prev => ({ ...prev, [field]: e.target.value }))

  const pick = (e) => {
    const choice = e.target.value
    setPicked(choice)
    const chosen = entries.find(x => x.itemNo === choice)
    if (chosen) {
      setItem(prev => ({
        ...prev,
        itemNo: chosen.itemNo,
        description: chosen.description,
        unit: chosen.payUnit,
        budgetCode: chosen.budgetCodes.length === 1 ? chosen.budgetCodes[0] : '',
      }))
    }
  }

  const ready = item.quantity.trim() !== '' && (item.itemNo.trim() !== '' || item.description.trim() !== '')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !ready) return
    onConfirm({
      itemNo: item.itemNo.trim(), budgetCode: item.budgetCode.trim(), quantity: item.quantity.trim(),
      unit: item.unit.trim(), description: item.description.trim(),
    })
  }

  return (
    <Modal
      title="Add Pay Item"
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="add-pay-item-form" disabled={busy || !ready} className="btn-primary">
            {busy ? 'Adding...' : 'Add'}
          </button>
        </>
      }
    >
      <form id="add-pay-item-form" onSubmit={handleSubmit} className="space-y-3">
        {entries.length > 0 && (
          <div>
            <label htmlFor="add-pay-item-pick" className="input-label">Item</label>
            <select id="add-pay-item-pick" className="input-field" value={picked} disabled={busy} onChange={pick}>
              <option value="">Choose an item…</option>
              {entries.map(e => <option key={e.itemNo} value={e.itemNo}>{e.itemNo} — {e.description}</option>)}
              <option value={MANUAL}>Enter manually</option>
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="add-pay-item-no" className="input-label">Item No.</label>
            <input id="add-pay-item-no" type="text" className="input-field" value={item.itemNo} disabled={busy} onChange={set('itemNo')} />
          </div>
          <div>
            <label htmlFor="add-pay-item-code" className="input-label">Budget Code</label>
            {codes.length > 1 ? (
              <select id="add-pay-item-code" className="input-field" value={item.budgetCode} disabled={busy} onChange={set('budgetCode')}>
                <option value="">Select code</option>
                {codes.map(code => <option key={code} value={code}>{code}</option>)}
              </select>
            ) : (
              <input id="add-pay-item-code" type="text" className="input-field" value={item.budgetCode} disabled={busy} onChange={set('budgetCode')} />
            )}
          </div>
          <div>
            <label htmlFor="add-pay-item-quantity" className="input-label">Quantity</label>
            <input id="add-pay-item-quantity" type="number" step="any" className="input-field" value={item.quantity} disabled={busy} required onChange={set('quantity')} />
          </div>
          <div>
            <label htmlFor="add-pay-item-unit" className="input-label">Unit</label>
            <input id="add-pay-item-unit" type="text" className="input-field" value={item.unit} disabled={busy} onChange={set('unit')} />
          </div>
        </div>
        <div>
          <label htmlFor="add-pay-item-description" className="input-label">Description</label>
          <input id="add-pay-item-description" type="text" className="input-field" value={item.description} disabled={busy} onChange={set('description')} />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  )
}
