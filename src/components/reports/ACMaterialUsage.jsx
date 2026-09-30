/**
 * An Asphaltic Concrete "Material Usage" card, mounted once for the Top course and once for the Binder: ticket count
 * and range plus the quantities received, used and wasted. Stateless. Props: heading (e.g. 'Material Usage — Top'),
 * value ({ noOfTickets, firstTicketNo, lastTicketNo, qtyReceived, qtyUsed, qtyWasted }), onChange(field, value),
 * disabled (makes the inputs natively disabled).
 */
import { useId } from 'react'

const FIELDS = [
  { label: 'No. of Tickets', key: 'noOfTickets', type: 'number' },
  { label: 'First Ticket No.', key: 'firstTicketNo', type: 'text' },
  { label: 'Last Ticket No.', key: 'lastTicketNo', type: 'text' },
  { label: 'Qty Received', key: 'qtyReceived', type: 'number' },
  { label: 'Qty Used', key: 'qtyUsed', type: 'number' },
  { label: 'Qty Wasted/Rejected', key: 'qtyWasted', type: 'number' },
]

export default function ACMaterialUsage({ heading, value, onChange, disabled = false }) {
  // Mounted twice on one page, so the label / input ids can't be fixed strings
  const idPrefix = useId()
  return (
    <section aria-label={heading} className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">{heading}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map(field => (
          <div key={field.key}>
            <label htmlFor={`${idPrefix}-${field.key}`} className="input-label">{field.label}</label>
            <input
              id={`${idPrefix}-${field.key}`}
              type={field.type}
              step={field.type === 'number' ? '0.01' : undefined}
              className="input-field"
              value={value[field.key] ?? ''}
              disabled={disabled}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
