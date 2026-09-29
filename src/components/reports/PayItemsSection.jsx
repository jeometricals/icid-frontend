/**
 * The "Pay Items" card on a report form: an Add Item button and a table with one editable row per pay item.
 * Stateless. Props: payItems (array of { itemNo, budgetCode, payQuantity, description }),
 * onAddItem(), onItemChange(index, field, value), disabled (makes the button and inputs natively disabled).
 */
export default function PayItemsSection({ payItems, onAddItem, onItemChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="form-section-title mb-0">Pay Items</h3>
        <button onClick={onAddItem} disabled={disabled} className="btn-secondary text-sm">
          Add Item
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item No.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pay Quantity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payItems.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                  No pay items added. Click "Add Item" to begin.
                </td>
              </tr>
            ) : (
              payItems.map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Item No."
                      value={item.itemNo}
                      disabled={disabled}
                      onChange={(e) => onItemChange(index, 'itemNo', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Code"
                      value={item.budgetCode}
                      disabled={disabled}
                      onChange={(e) => onItemChange(index, 'budgetCode', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Qty"
                      value={item.payQuantity}
                      disabled={disabled}
                      onChange={(e) => onItemChange(index, 'payQuantity', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Description"
                      value={item.description}
                      disabled={disabled}
                      onChange={(e) => onItemChange(index, 'description', e.target.value)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
