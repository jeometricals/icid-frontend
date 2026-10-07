/**
 * The Asphaltic Concrete "Delivery Ticket Log" card: an Add Ticket button and one editable row per delivery ticket
 * (location, ticket number, temperature in °F), each removable. Stateless. Props: tickets (array of
 * { location, ticketNo, temperature }), onAddTicket(), onTicketChange(index, field, value), onRemoveTicket(index),
 * disabled (makes the button and inputs natively disabled).
 * A reviewer's edit of a cell reads in the cell (a ticket is addressed by its position). A reviewer neither adds nor
 * removes a ticket.
 */
import RemoveRowButton from './RemoveRowButton'
import RedlinedField from '../RedlinedField'

const FIELDS = [
  { label: 'Location', key: 'location', type: 'text' },
  { label: 'Ticket No.', key: 'ticketNo', type: 'text' },
  { label: 'Temperature', key: 'temperature', type: 'number', suffix: '°F' },
]

export default function ACDeliveryTicketLog({ tickets, onAddTicket, onTicketChange, onRemoveTicket, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="form-section-title mb-0">Delivery Ticket Log</h3>
        <button type="button" onClick={onAddTicket} disabled={disabled} className="btn-secondary text-sm">
          Add Ticket
        </button>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {FIELDS.map(field => (
              <th key={field.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {field.label}
              </th>
            ))}
            <th className="px-4 py-3 w-12"><span className="sr-only">Remove</span></th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tickets.length === 0 ? (
            <tr>
              <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                No tickets added yet. Click Add Ticket to record one.
              </td>
            </tr>
          ) : (
            tickets.map((ticket, index) => (
              <tr key={index}>
                {FIELDS.map(field => (
                  <td key={field.key} className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <RedlinedField
                          path={`deliveryTickets[${index}].${field.key}`}
                          value={ticket[field.key] ?? ''}
                          label={`Ticket ${index + 1} ${field.label}`}
                          type={field.type}
                        >
                          <input
                            type={field.type}
                            step={field.type === 'number' ? '0.01' : undefined}
                            className="input-field"
                            aria-label={`Ticket ${index + 1} ${field.label}`}
                            value={ticket[field.key] ?? ''}
                            disabled={disabled}
                            onChange={(e) => onTicketChange(index, field.key, e.target.value)}
                          />
                        </RedlinedField>
                      </div>
                      {field.suffix && <span className="text-sm text-gray-500">{field.suffix}</span>}
                    </div>
                  </td>
                ))}
                <td className="px-4 py-2">
                  <RemoveRowButton
                    onClick={() => onRemoveTicket(index)}
                    disabled={disabled}
                    ariaLabel={`Remove ticket ${index + 1}`}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
