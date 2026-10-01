/**
 * The "Pay Items" card on a report form: an Add Item button and a table with one editable, removable row per pay item
 * (Item No., Budget Code, Pay Quantity, Unit, Description).
 * With the project's contract items loaded, Add Item opens the pay-item picker on the new row, and clicking a row's
 * Item No. or Description opens it there; picking fills Item No., Description and Unit, plus Budget Code when the
 * item has only one. An item under several budget codes gets a Budget Code dropdown of just those codes. Every field
 * stays editable after a pick. While the catalog loads Add Item is disabled; if it failed to load, rows are typed by hand.
 * Props: payItems (array of { itemNo, budgetCode, payQuantity, unit, description }), onAddItem(),
 * onItemChange(index, field, value), onRemoveItem(index), contractItems, contractItemsLoading, contractItemsError,
 * disabled (makes the buttons and inputs natively disabled).
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import PayItemPicker, { catalogEntries } from './PayItemPicker'
import RemoveRowButton from './RemoveRowButton'

export const CATALOG_UNAVAILABLE = 'Catalog unavailable — enter items manually.'

const HEADER_CLASS = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'

export default function PayItemsSection({
  payItems,
  onAddItem,
  onItemChange,
  onRemoveItem,
  contractItems = [],
  contractItemsLoading = false,
  contractItemsError = null,
  disabled = false,
}) {
  // The open picker: which row and cell it hangs off, and whether it takes focus (nonce remounts it to refocus)
  const [picker, setPicker] = useState(null) // { index, field, focusSearch, nonce } | null
  const cellRefs = useRef({})

  const entries = useMemo(() => catalogEntries(contractItems), [contractItems])
  const budgetCodesByItemNo = useMemo(
    () => Object.fromEntries(entries.map(entry => [entry.itemNo, entry.budgetCodes])),
    [entries]
  )

  const pickerAvailable = !disabled && !contractItemsLoading && !contractItemsError

  const openPicker = (index, field, focusSearch) => {
    if (!pickerAvailable) return
    setPicker(prev => ({ index, field, focusSearch, nonce: (prev?.nonce ?? 0) + 1 }))
  }
  const closePicker = useCallback(() => setPicker(null), [])

  const handleAddItem = () => {
    onAddItem()
    openPicker(payItems.length, 'itemNo', true)
  }

  const handlePick = (index, entry) => {
    onItemChange(index, 'itemNo', entry.itemNo)
    onItemChange(index, 'description', entry.description)
    onItemChange(index, 'unit', entry.payUnit)
    onItemChange(index, 'budgetCode', entry.budgetCodes.length === 1 ? entry.budgetCodes[0] : '')
    setPicker(null)
  }

  // Closes the picker and leaves the row for typing, focused on the cell the picker hung off
  const handleAddManual = () => {
    const anchorInput = cellRefs.current[`${picker.index}-${picker.field}`]?.querySelector('input')
    setPicker(null)
    anchorInput?.focus()
  }

  const handleRemove = (index) => {
    setPicker(null)
    onRemoveItem(index)
  }

  const getAnchor = useCallback(
    () => (picker ? cellRefs.current[`${picker.index}-${picker.field}`] : null),
    [picker]
  )

  // Item No. and Description open the picker on click; ArrowDown opens it with the search box focused
  const pickerCell = (item, index, field, label, placeholder) => {
    const isOpen = picker?.index === index && picker?.field === field
    return (
      <td className="px-4 py-2" ref={el => { cellRefs.current[`${index}-${field}`] = el }}>
        <input
          type="text"
          className="input-field"
          placeholder={placeholder}
          aria-label={`Pay item ${index + 1} ${label}`}
          aria-haspopup={pickerAvailable ? 'listbox' : undefined}
          aria-expanded={pickerAvailable ? isOpen : undefined}
          value={item[field] ?? ''}
          disabled={disabled}
          onClick={() => { if (!isOpen) openPicker(index, field, false) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && pickerAvailable) {
              e.preventDefault()
              openPicker(index, field, true)
            } else if (e.key === 'Escape' && isOpen) {
              closePicker()
            }
          }}
          onChange={(e) => onItemChange(index, field, e.target.value)}
        />
      </td>
    )
  }

  const textCell = (item, index, field, label, placeholder) => (
    <td className="px-4 py-2">
      <input
        type="text"
        className="input-field"
        placeholder={placeholder}
        aria-label={`Pay item ${index + 1} ${label}`}
        value={item[field] ?? ''}
        disabled={disabled}
        onChange={(e) => onItemChange(index, field, e.target.value)}
      />
    </td>
  )

  // A dropdown of the item's budget codes when the catalog has it under several; a text input otherwise
  const budgetCodeCell = (item, index) => {
    const codes = budgetCodesByItemNo[item.itemNo] ?? []
    if (codes.length < 2) return textCell(item, index, 'budgetCode', 'Budget Code', 'Code')
    // A typed-in code outside the catalog's stays selectable rather than silently disappearing
    const options = item.budgetCode && !codes.includes(item.budgetCode) ? [...codes, item.budgetCode] : codes
    return (
      <td className="px-4 py-2">
        <select
          className="input-field"
          aria-label={`Pay item ${index + 1} Budget Code`}
          value={item.budgetCode ?? ''}
          disabled={disabled}
          onChange={(e) => onItemChange(index, 'budgetCode', e.target.value)}
        >
          <option value="">Select code</option>
          {options.map(code => <option key={code} value={code}>{code}</option>)}
        </select>
      </td>
    )
  }

  const addLabel = contractItemsLoading ? 'Add Item (loading catalog…)' : 'Add Item'

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="form-section-title mb-0">Pay Items</h3>
        <div className="flex items-center gap-3">
          {contractItemsError && !disabled && (
            <span className="text-sm text-gray-500">{CATALOG_UNAVAILABLE}</span>
          )}
          <button
            type="button"
            onClick={handleAddItem}
            disabled={disabled || contractItemsLoading}
            className="btn-secondary text-sm"
          >
            {addLabel}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className={HEADER_CLASS}>Item No.</th>
              <th className={HEADER_CLASS}>Budget Code</th>
              <th className={HEADER_CLASS}>Pay Quantity</th>
              <th className={HEADER_CLASS}>Unit</th>
              <th className={HEADER_CLASS}>Description</th>
              <th className="px-4 py-3"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payItems.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                  No pay items added. Click "Add Item" to begin.
                </td>
              </tr>
            ) : (
              payItems.map((item, index) => (
                <tr key={index}>
                  {pickerCell(item, index, 'itemNo', 'Item No.', 'Item No.')}
                  {budgetCodeCell(item, index)}
                  {textCell(item, index, 'payQuantity', 'Pay Quantity', 'Qty')}
                  {textCell(item, index, 'unit', 'Unit', 'Unit')}
                  {pickerCell(item, index, 'description', 'Description', 'Description')}
                  <td className="px-4 py-2">
                    <RemoveRowButton
                      onClick={() => handleRemove(index)}
                      disabled={disabled}
                      ariaLabel={`Remove pay item ${index + 1}`}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {picker && pickerAvailable && picker.index < payItems.length && (
        <PayItemPicker
          key={`${picker.index}-${picker.field}-${picker.nonce}`}
          items={contractItems}
          autoFocus={picker.focusSearch}
          getAnchor={getAnchor}
          onPick={(entry) => handlePick(picker.index, entry)}
          onAddManual={handleAddManual}
          onClose={closePicker}
        />
      )}
    </div>
  )
}
