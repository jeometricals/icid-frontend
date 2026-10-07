/**
 * The Concrete Truck & Mix Info "Trucks" card: an Add Truck button and one editable row per truck (ticket, inspection
 * sticker Y / N / N/A, load, batch, revolutions, discharge times, slump, air, temperature, cylinders), each removable.
 * Stateless on a draft. Props: trucks (array of truck rows), onAddTruck(), onTruckChange(index, field, value),
 * onRemoveTruck(index), disabled (makes the button and inputs natively disabled).
 * A reviewer's edit of a cell reads in the cell (a truck is addressed by its position); one of the sticker, under
 * its radios. In edit mode Add Truck is the reviewer's: it opens a blank row with Save / Cancel under the table and
 * adds the truck through the RedlineProvider around it. A truck a reviewer added is a blue row with the adder's
 * initials after its truck or ticket number. A reviewer never removes a truck (the × stays disabled in review).
 */
import { useState } from 'react'
import { useRedline } from '../../contexts/RedlineContext'
import { REDLINE_TEXT, truckAddEdit } from '../../lib/fieldEdits'
import RemoveRowButton from './RemoveRowButton'
import RedlinedField, { InitialsBadge } from '../RedlinedField'

// The text / number columns, in table order; the Inspection Sticker radios sit after the first one
const FIELDS = [
  { label: 'Truck or Ticket No', key: 'truckOrTicketNo', type: 'text' },
  { label: 'Load Size C.Y.', key: 'loadSizeCy', type: 'number' },
  { label: 'End Batch', key: 'endBatch', type: 'text' },
  { label: 'Mixing Revs', key: 'mixingRevs', type: 'number' },
  { label: 'Start Disch. Time', key: 'startDischTime', type: 'text' },
  { label: 'End Disch. Time', key: 'endDischTime', type: 'text' },
  { label: 'Slump', key: 'slump', type: 'number' },
  { label: 'Air Content', key: 'airContent', type: 'number' },
  { label: 'Conc. Temp', key: 'concTemp', type: 'number' },
  { label: 'Cylinder Numbers', key: 'cylinderNumbers', type: 'text' },
]
const [TICKET_FIELD, ...OTHER_FIELDS] = FIELDS

const STICKER_OPTIONS = [
  { label: 'Y', value: 'Y' },
  { label: 'N', value: 'N' },
  { label: 'N/A', value: 'NA' },
]
const stickerLabel = (value) => STICKER_OPTIONS.find(o => o.value === value)?.label ?? value

const HEADER_CLASS = 'px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap'
const ADDED_TEXT = `${REDLINE_TEXT} font-medium`

// The truck a reviewer starts from: every field blank, the sticker unanswered
const blankTruck = () => ({ ...Object.fromEntries(FIELDS.map(field => [field.key, ''])), inspectionSticker: null })
const filled = (value) => String(value ?? '').trim() !== ''

export default function ConcMixTrucksTable({ trucks, onAddTruck, onTruckChange, onRemoveTruck, disabled = false }) {
  const redline = useRedline()
  const reviewing = Boolean(redline?.canEdit) // edit mode, for the stage's reviewer: Add Truck is theirs
  const [draft, setDraft] = useState(null) // the truck the reviewer is adding; null when not
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const addedBy = (truck) => (truck.id ? truckAddEdit(redline?.edits, redline?.reportId, truck.id) : undefined)

  const startAdding = () => {
    setDraft(blankTruck())
    setError(null)
  }

  // Adds the reviewer's truck; the row closes on success, and on a conflict (the page has reloaded and said so)
  const saveDraft = async () => {
    setSaving(true)
    setError(null)
    const result = await redline.addTruck(draft)
    setSaving(false)
    if (result.ok || result.conflict) setDraft(null)
    else setError(result.message)
  }

  const fieldCell = (truck, index, field, added) => (
    <td key={field.key} className="px-3 py-2">
      <div className="flex items-center">
        <div className="flex-1 min-w-0">
          <RedlinedField
            path={`trucks[${index}].${field.key}`}
            value={truck[field.key] ?? ''}
            label={`Truck ${index + 1} ${field.label}`}
            type={field.type}
          >
            <input
              type={field.type}
              step={field.type === 'number' ? '0.01' : undefined}
              className={`input-field min-w-[6rem] ${added ? ADDED_TEXT : ''}`.trim()}
              aria-label={`Truck ${index + 1} ${field.label}`}
              value={truck[field.key] ?? ''}
              disabled={disabled}
              onChange={(e) => onTruckChange(index, field.key, e.target.value)}
            />
          </RedlinedField>
        </div>
        {field === TICKET_FIELD && added && <InitialsBadge initials={added.editor_initials} name={added.editor_name} />}
      </div>
    </td>
  )

  const draftCell = (field) => (
    <td key={field.key} className="px-3 py-2">
      <input
        type={field.type}
        step={field.type === 'number' ? '0.01' : undefined}
        className="input-field min-w-[6rem]"
        aria-label={`New truck ${field.label}`}
        value={draft[field.key]}
        disabled={saving}
        autoFocus={field === TICKET_FIELD}
        onChange={(e) => setDraft(prev => ({ ...prev, [field.key]: e.target.value }))}
      />
    </td>
  )

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="form-section-title mb-0">Trucks</h3>
        <button
          type="button"
          onClick={reviewing ? startAdding : onAddTruck}
          disabled={reviewing ? draft !== null : disabled}
          className="btn-secondary text-sm"
        >
          Add Truck
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className={HEADER_CLASS}>{TICKET_FIELD.label}</th>
              <th className={HEADER_CLASS}>Inspection Sticker</th>
              {OTHER_FIELDS.map(field => <th key={field.key} className={HEADER_CLASS}>{field.label}</th>)}
              <th className="px-3 py-3"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {trucks.length === 0 && !draft ? (
              <tr>
                <td colSpan="12" className="px-4 py-8 text-center text-gray-500">
                  No trucks yet. Click 'Add Truck' to begin.
                </td>
              </tr>
            ) : (
              trucks.map((truck, index) => {
                const added = addedBy(truck)
                return (
                  <tr key={index} data-testid="truck-row" data-added={added ? true : undefined} className={added ? 'bg-blue-50/40' : undefined}>
                    {fieldCell(truck, index, TICKET_FIELD, added)}
                    <td className="px-3 py-2">
                      <div className="flex gap-3">
                        {STICKER_OPTIONS.map(option => (
                          <label
                            key={option.value}
                            className={`flex items-center gap-1 text-xs ${added ? ADDED_TEXT : 'text-gray-600'}`}
                          >
                            <input
                              type="radio"
                              name={`truck-${index}-sticker`}
                              aria-label={`Truck ${index + 1} Inspection Sticker: ${option.label}`}
                              checked={truck.inspectionSticker === option.value}
                              disabled={disabled}
                              onChange={() => onTruckChange(index, 'inspectionSticker', option.value)}
                              className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      {/* The answer itself is the three radios; its edits, and the reviewer's pencil, sit here */}
                      <RedlinedField
                        path={`trucks[${index}].inspectionSticker`}
                        value={truck.inspectionSticker}
                        label={`Truck ${index + 1} Inspection Sticker`}
                        type="select"
                        options={STICKER_OPTIONS}
                        format={stickerLabel}
                        toRequest={(text) => (text === '' ? null : text)}
                      />
                    </td>
                    {OTHER_FIELDS.map(field => fieldCell(truck, index, field, added))}
                    <td className="px-3 py-2">
                      {/* Only the inspector removes a truck, on a draft: in review this stays disabled */}
                      <RemoveRowButton
                        onClick={() => onRemoveTruck(index)}
                        disabled={disabled}
                        ariaLabel={`Remove truck ${index + 1}`}
                      />
                    </td>
                  </tr>
                )
              })
            )}
            {draft && (
              <tr data-testid="new-truck-row" className="bg-blue-50/40">
                {draftCell(TICKET_FIELD)}
                <td className="px-3 py-2">
                  <div className="flex gap-3">
                    {STICKER_OPTIONS.map(option => (
                      <label key={option.value} className="flex items-center gap-1 text-xs text-gray-600">
                        <input
                          type="radio"
                          name="new-truck-sticker"
                          aria-label={`New truck Inspection Sticker: ${option.label}`}
                          checked={draft.inspectionSticker === option.value}
                          disabled={saving}
                          onChange={() => setDraft(prev => ({ ...prev, inspectionSticker: option.value }))}
                          className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </td>
                {OTHER_FIELDS.map(draftCell)}
                <td className="px-3 py-2"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {draft && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveDraft}
            disabled={saving || !(filled(draft.truckOrTicketNo) || filled(draft.slump))}
            className="btn-primary text-sm py-1"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => setDraft(null)} disabled={saving} className="btn-secondary text-sm py-1">
            Cancel
          </button>
          <span className="text-xs text-gray-500">A new truck needs a truck or ticket number or a slump.</span>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
