/**
 * The Concrete Cylinder Data "Delivery & Casting" card: date of delivery, cubic yards poured, date cast and job
 * location, in a 2-column grid. Stateless. Props: value ({ dateOfDelivery, cyPoured, dateCast, jobLocation }),
 * onChange(field, value), disabled (makes the inputs natively disabled).
 */
const FIELDS = [
  { label: 'Date of Delivery', key: 'dateOfDelivery', type: 'date' },
  { label: 'C.Y. Poured', key: 'cyPoured', type: 'number' },
  { label: 'Date Cast', key: 'dateCast', type: 'date' },
  { label: 'Job Location', key: 'jobLocation', type: 'text' },
]

export default function ConcCylDeliveryCasting({ value, onChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Delivery &amp; Casting</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map(field => (
          <div key={field.key}>
            <label htmlFor={`conc-cyl-${field.key}`} className="input-label">{field.label}</label>
            <input
              id={`conc-cyl-${field.key}`}
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
    </div>
  )
}
