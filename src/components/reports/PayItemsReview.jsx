import { useState } from 'react'
import { useRedline } from '../../contexts/RedlineContext'
import {
  REDLINE_TEXT, REVISED_AFTER_RETURN, displayValue, editsForField, payItemAddEdit, payItemPath, sameValue,
} from '../../lib/fieldEdits'
import RedlinedField, { InitialsBadge } from '../RedlinedField'
import AddPayItemModal from './AddPayItemModal'
import RevisePayItemModal from './RevisePayItemModal'

const HEADER_CLASS = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'
const CELL = 'px-4 py-2 text-sm align-top'

/**
 * A report's pay items once its IDR is past draft, with reviewer edits drawn the pay-item way. An item whose
 * quantity a reviewer revised keeps its inspector row, the quantity crossed out with no initials, and gets a blue
 * row underneath for each revision with the new quantity and the reviser's initials; the last is the quantity that
 * counts. An item a reviewer added is a blue row with the adder's initials. In edit mode, for the stage's reviewer,
 * each item has a Revise button and the table an Add Pay Item button.
 * Reads the edits and the edit calls from the RedlineProvider around it.
 * Props: payItems (the report's saved pay items, each with its id), contractItems (the project's catalog, for the
 * Add Pay Item picker).
 */
export default function PayItemsReview({ payItems, contractItems = [] }) {
  const redline = useRedline()
  const [revising, setRevising] = useState(null) // the item whose quantity is being revised
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const canEdit = Boolean(redline?.canEdit)

  // Runs a revise or an add; its dialog closes on success, and on a conflict (the page has reloaded)
  const run = async (request, close) => {
    setBusy(true)
    setError(null)
    const result = await request()
    setBusy(false)
    if (result.ok || result.conflict) close()
    else setError(result.message)
  }

  const closeDialogs = () => {
    setRevising(null)
    setAdding(false)
    setError(null)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="form-section-title mb-0">Pay Items</h3>
        {canEdit && (
          <button type="button" onClick={() => setAdding(true)} disabled={busy} className="btn-secondary text-sm">
            Add Pay Item
          </button>
        )}
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
              {canEdit && <th className="px-4 py-3"><span className="sr-only">Revise</span></th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payItems.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-gray-500">No pay items.</td>
              </tr>
            ) : (
              payItems.map((item, index) => (
                <PayItemRows
                  key={item.id ?? index}
                  item={item}
                  number={index + 1}
                  edits={redline?.edits}
                  reportId={redline?.reportId}
                  canEdit={canEdit && Boolean(item.id)}
                  showActions={canEdit}
                  onRevise={() => { setError(null); setRevising(item) }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {revising && (
        <RevisePayItemModal
          item={revising}
          onConfirm={quantity => run(() => redline.revise(revising.id, quantity), closeDialogs)}
          onCancel={closeDialogs}
          busy={busy}
          error={error}
        />
      )}
      {adding && (
        <AddPayItemModal
          contractItems={contractItems}
          onConfirm={newItem => run(() => redline.addItem(newItem), closeDialogs)}
          onCancel={closeDialogs}
          busy={busy}
          error={error}
        />
      )}
    </div>
  )
}

// One pay item: its own row, then a blue row per quantity revision, then a note row if its inspector changed the
// quantity after the last revision
function PayItemRows({ item, number, edits, reportId, canEdit, showActions, onRevise }) {
  const revisions = item.id ? editsForField(edits, reportId, payItemPath(item.id, 'payQuantity')) : []
  const added = item.id ? payItemAddEdit(edits, reportId, item.id) : undefined
  const last = revisions[revisions.length - 1]
  const revisedAfter = Boolean(last) && !sameValue(item.payQuantity, last.new_value)
  // The first row shows the quantity the item started with: the inspector's, or the adder's
  const firstQuantity = revisions.length > 0 ? revisions[0].old_value : item.payQuantity
  const tone = added ? `${REDLINE_TEXT} font-medium` : 'text-gray-900'
  const label = `pay item ${number}`

  const field = (name, what) => item.id ? (
    <RedlinedField path={payItemPath(item.id, name)} value={item[name]} label={`${label} ${what}`}>
      <span>{item[name] || ''}</span>
    </RedlinedField>
  ) : (item[name] || '')

  return (
    <>
      <tr data-testid="pay-item-row" className={added ? 'bg-blue-50/40' : undefined}>
        <td className={`${CELL} ${tone}`}>{field('itemNo', 'Item No.')}</td>
        <td className={`${CELL} ${tone}`}>{field('budgetCode', 'Budget Code')}</td>
        <td className={`${CELL} ${tone} whitespace-nowrap`}>
          <span className={revisions.length > 0 ? 'line-through text-gray-500 font-normal' : undefined}>
            {displayValue(firstQuantity)}
          </span>
          {added && <InitialsBadge initials={added.editor_initials} name={added.editor_name} />}
        </td>
        <td className={`${CELL} ${tone}`}>{field('unit', 'Unit')}</td>
        <td className={`${CELL} ${tone}`}>{field('description', 'Description')}</td>
        {showActions && (
          <td className={`${CELL} text-right`}>
            {canEdit && (
              <button
                type="button"
                onClick={onRevise}
                aria-label={`Revise the quantity of ${label}`}
                className="text-sm font-medium text-construction-700 hover:text-construction-800 hover:underline"
              >
                Revise
              </button>
            )}
          </td>
        )}
      </tr>
      {revisions.map(revision => (
        <tr key={revision.edit_id} data-testid="pay-item-revision" className={`bg-blue-50/40 ${REDLINE_TEXT} font-medium`}>
          <td className={CELL}>{item.itemNo || ''}</td>
          <td className={CELL}>{item.budgetCode || ''}</td>
          <td className={`${CELL} whitespace-nowrap`}>
            <span className={revision !== last || revisedAfter ? 'line-through' : undefined}>
              {displayValue(revision.new_value)}
            </span>
            <InitialsBadge initials={revision.editor_initials} name={revision.editor_name} />
          </td>
          <td className={CELL}>{item.unit || ''}</td>
          <td className={CELL}>{item.description || ''}</td>
          {showActions && <td className={CELL}></td>}
        </tr>
      ))}
      {revisedAfter && (
        <tr data-testid="pay-item-revised-after">
          <td className={CELL}>{item.itemNo || ''}</td>
          <td className={CELL}>{item.budgetCode || ''}</td>
          <td className={`${CELL} whitespace-nowrap`}>
            {displayValue(item.payQuantity)}
            <span className="ml-2 text-[11px] text-gray-500">{REVISED_AFTER_RETURN}</span>
          </td>
          <td className={CELL}>{item.unit || ''}</td>
          <td className={CELL}>{item.description || ''}</td>
          {showActions && <td className={CELL}></td>}
        </tr>
      )}
    </>
  )
}
