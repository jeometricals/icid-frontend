import { useState } from 'react'
import Modal from './Modal'

// The longest value the backend takes for each text field
export const MAX_PAY_ITEM_REF_LENGTH = 32
export const MAX_BUDGET_CODE_LENGTH = 50
export const MAX_PAY_ITEM_DESCRIPTION_LENGTH = 500
export const MAX_UNIT_LENGTH = 16

const TEXT_KEYS = ['pay_item_ref', 'budget_code', 'description', 'unit']
const AMOUNT_KEYS = ['quantity', 'unit_price']

// What the form starts with: the item being edited, or nothing
function startingValues(initial) {
  const text = (key) => (initial?.[key] ?? '')
  const amount = (key) => (initial?.[key] === undefined || initial?.[key] === null ? '' : String(initial[key]))
  return {
    ...Object.fromEntries(TEXT_KEYS.map(key => [key, text(key)])),
    ...Object.fromEntries(AMOUNT_KEYS.map(key => [key, amount(key)])),
  }
}

// An amount as typed is usable when it is a number that isn't negative
const isAmount = (typed) => typed.trim() !== '' && Number.isFinite(Number(typed)) && Number(typed) >= 0

/**
 * Lets an admin add a pay item to a project, or edit one: pay item ref, budget code, description, unit, quantity
 * and unit price, all required. The unit goes into capitals when its field is left. Save is off until every field
 * is in and both amounts are numbers that aren't negative. The text is passed on trimmed and the amounts as
 * numbers. The caller runs the save: it sets busy while it works and error if it failed (a ref the project already
 * has under that budget code included), and the form keeps what was typed.
 * Props: mode ('add' | 'edit'), initial (the pay item being edited; none when adding), onSave(values) (called with
 * {pay_item_ref, budget_code, description, unit, quantity, unit_price}), onCancel, busy, error.
 */
export default function PayItemFormModal({ mode = 'add', initial, onSave, onCancel, busy = false, error = null }) {
  const [values, setValues] = useState(() => startingValues(initial))

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const ready = TEXT_KEYS.every(key => Boolean(values[key].trim())) && AMOUNT_KEYS.every(key => isAmount(values[key]))
  const adding = mode === 'add'

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !ready) return
    onSave({
      pay_item_ref: values.pay_item_ref.trim(),
      budget_code: values.budget_code.trim(),
      description: values.description.trim(),
      unit: values.unit.trim().toUpperCase(),
      quantity: Number(values.quantity),
      unit_price: Number(values.unit_price),
    })
  }

  return (
    <Modal
      title={adding ? 'Add Pay Item' : 'Edit Pay Item'}
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="pay-item-form" disabled={busy || !ready} className="btn-primary">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="pay-item-form" onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4">
        <div>
          <label htmlFor="pay-item-ref" className="input-label">Pay Item Ref</label>
          <input
            id="pay-item-ref"
            type="text"
            className="input-field"
            value={values.pay_item_ref}
            maxLength={MAX_PAY_ITEM_REF_LENGTH}
            disabled={busy}
            autoFocus
            aria-describedby="pay-item-ref-help"
            onChange={(e) => set('pay_item_ref', e.target.value)}
          />
          <p id="pay-item-ref-help" className="text-sm text-gray-500 mt-1">e.g. 4.13 AAS or UTL-6.01.1.</p>
        </div>

        <div>
          <label htmlFor="pay-item-budget-code" className="input-label">Budget Code</label>
          <input
            id="pay-item-budget-code"
            type="text"
            className="input-field"
            value={values.budget_code}
            maxLength={MAX_BUDGET_CODE_LENGTH}
            disabled={busy}
            aria-describedby="pay-item-budget-code-help"
            onChange={(e) => set('budget_code', e.target.value)}
          />
          <p id="pay-item-budget-code-help" className="text-sm text-gray-500 mt-1">e.g. EP0007-CONS or HW0001Q-CONS.</p>
        </div>

        <div>
          <label htmlFor="pay-item-description" className="input-label">Description</label>
          <textarea
            id="pay-item-description"
            rows={3}
            className="input-field"
            value={values.description}
            maxLength={MAX_PAY_ITEM_DESCRIPTION_LENGTH}
            disabled={busy}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="pay-item-unit" className="input-label">Unit</label>
          <input
            id="pay-item-unit"
            type="text"
            className="input-field"
            value={values.unit}
            maxLength={MAX_UNIT_LENGTH}
            disabled={busy}
            aria-describedby="pay-item-unit-help"
            onChange={(e) => set('unit', e.target.value)}
            onBlur={() => set('unit', values.unit.toUpperCase())}
          />
          <p id="pay-item-unit-help" className="text-sm text-gray-500 mt-1">
            LF, SF, SY, EA, CY, TN, LS, FS, MONTH, HR, LB.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="pay-item-quantity" className="input-label">Quantity</label>
            <input
              id="pay-item-quantity"
              type="number"
              min="0"
              step="0.001"
              className="input-field"
              value={values.quantity}
              disabled={busy}
              onChange={(e) => set('quantity', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pay-item-unit-price" className="input-label">Unit Price</label>
            <div className="relative">
              <span aria-hidden="true" className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">$</span>
              <input
                id="pay-item-unit-price"
                type="number"
                min="0"
                step="0.01"
                className="input-field pl-7"
                value={values.unit_price}
                disabled={busy}
                onChange={(e) => set('unit_price', e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  )
}
