/**
 * The Concrete Truck & Mix Info "Trucks" card: an Add Truck button and one editable row per truck (ticket, inspection
 * sticker Y / N / N/A, load, batch, revolutions, discharge times, slump, air, temperature, cylinders), each removable.
 * Stateless. Props: trucks (array of truck rows), onAddTruck(), onTruckChange(index, field, value),
 * onRemoveTruck(index), disabled (makes the button and inputs natively disabled).
 */
import RemoveRowButton from './RemoveRowButton'

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

const HEADER_CLASS = 'px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap'

export default function ConcMixTrucksTable({ trucks, onAddTruck, onTruckChange, onRemoveTruck, disabled = false }) {
  const fieldCell = (truck, index, field) => (
    <td key={field.key} className="px-3 py-2">
      <input
        type={field.type}
        step={field.type === 'number' ? '0.01' : undefined}
        className="input-field min-w-[6rem]"
        aria-label={`Truck ${index + 1} ${field.label}`}
        value={truck[field.key] ?? ''}
        disabled={disabled}
        onChange={(e) => onTruckChange(index, field.key, e.target.value)}
      />
    </td>
  )

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="form-section-title mb-0">Trucks</h3>
        <button type="button" onClick={onAddTruck} disabled={disabled} className="btn-secondary text-sm">
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
            {trucks.length === 0 ? (
              <tr>
                <td colSpan="12" className="px-4 py-8 text-center text-gray-500">
                  No trucks yet. Click 'Add Truck' to begin.
                </td>
              </tr>
            ) : (
              trucks.map((truck, index) => (
                <tr key={index}>
                  {fieldCell(truck, index, TICKET_FIELD)}
                  <td className="px-3 py-2">
                    <div className="flex gap-3">
                      {STICKER_OPTIONS.map(option => (
                        <label key={option.value} className="flex items-center gap-1 text-xs text-gray-600">
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
                  </td>
                  {OTHER_FIELDS.map(field => fieldCell(truck, index, field))}
                  <td className="px-3 py-2">
                    <RemoveRowButton
                      onClick={() => onRemoveTruck(index)}
                      disabled={disabled}
                      ariaLabel={`Remove truck ${index + 1}`}
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
