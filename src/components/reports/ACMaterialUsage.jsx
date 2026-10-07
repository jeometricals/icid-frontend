/**
 * An Asphaltic Concrete "Material Usage" card, mounted once for the Top course and once for the Binder: ticket count
 * and range plus the quantities received, used and wasted. Stateless. Props: heading (e.g. 'Material Usage — Top'),
 * value ({ noOfTickets, firstTicketNo, lastTicketNo, qtyReceived, qtyUsed, qtyWasted }), onChange(field, value),
 * disabled (makes the inputs natively disabled), path (the report key this card is saved under: 'materialUsageTop'
 * or 'materialUsageBinder', for its reviewer edits, which read in a field's place).
 */
import { useId } from 'react'
import RedlinedField from '../RedlinedField'

const FIELDS = [
  { label: 'No. of Tickets', key: 'noOfTickets', type: 'number' },
  { label: 'First Ticket No.', key: 'firstTicketNo', type: 'text' },
  { label: 'Last Ticket No.', key: 'lastTicketNo', type: 'text' },
  { label: 'Qty Received', key: 'qtyReceived', type: 'number' },
  { label: 'Qty Used', key: 'qtyUsed', type: 'number' },
  { label: 'Qty Wasted/Rejected', key: 'qtyWasted', type: 'number' },
]

export default function ACMaterialUsage({ heading, value, onChange, disabled = false, path }) {
  // Mounted twice on one page, so the label / input ids can't be fixed strings
  const idPrefix = useId()
  return (
    <section aria-label={heading} className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">{heading}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map(field => (
          <div key={field.key}>
            <label htmlFor={`${idPrefix}-${field.key}`} className="input-label">{field.label}</label>
            <RedlinedField
              path={`${path}.${field.key}`}
              value={value[field.key] ?? ''}
              label={`${heading}: ${field.label}`}
              type={field.type}
            >
              <input
                id={`${idPrefix}-${field.key}`}
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
    </section>
  )
}
