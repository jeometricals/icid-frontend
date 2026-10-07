/**
 * The Concrete Truck & Mix Info "Material Usage" card: batch report and ticket numbers plus the quantities
 * dispatched, received, used and wasted. Stateless. Props: value ({ batchReportNo, noOfTickets, firstTicketNo,
 * lastTicketNo, quantityDispatched, quantityReceived, quantityUsed, quantityWasted }), onChange(field, value),
 * disabled (makes the inputs natively disabled). A reviewer's edit of a field reads in its place.
 */
import RedlinedField from '../RedlinedField'

const FIELDS = [
  { label: 'Batch Report No', key: 'batchReportNo', type: 'text' },
  { label: 'No. of Tickets', key: 'noOfTickets', type: 'number' },
  { label: 'First Ticket No', key: 'firstTicketNo', type: 'text' },
  { label: 'Last Ticket No', key: 'lastTicketNo', type: 'text' },
  { label: 'Quantity Dispatched from Plant', key: 'quantityDispatched', type: 'number' },
  { label: 'Quantity Received', key: 'quantityReceived', type: 'number' },
  { label: 'Quantity Used', key: 'quantityUsed', type: 'number' },
  { label: 'Quantity Wasted / Rejected', key: 'quantityWasted', type: 'number' },
]

export default function ConcMixMaterialUsage({ value, onChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Material Usage</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map(field => (
          <div key={field.key}>
            <label htmlFor={`conc-mix-${field.key}`} className="input-label">{field.label}</label>
            <RedlinedField path={`materialUsage.${field.key}`} value={value[field.key] ?? ''} label={field.label} type={field.type}>
              <input
                id={`conc-mix-${field.key}`}
                type={field.type}
                step={field.type === 'number' ? '0.01' : undefined}
                className="input-field"
                value={value[field.key] ?? ''}
                disabled={disabled}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            </RedlinedField>
          </div>
        ))}
      </div>
    </div>
  )
}
