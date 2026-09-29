/**
 * The Concrete Cylinder Data "Testing Laboratory" card: lab name, address and two phone numbers, stacked.
 * Stateless. Props: value ({ labName, labAddress, labPhonePrimary, labPhoneAlt }), onChange(field, value),
 * disabled (makes the inputs natively disabled).
 */
const FIELDS = [
  { label: 'Laboratory Name', key: 'labName' },
  { label: 'Address', key: 'labAddress', multiline: true },
  { label: 'Phone', key: 'labPhonePrimary' },
  { label: 'Phone (alt)', key: 'labPhoneAlt' },
]

export default function ConcCylTestingLab({ value, onChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Testing Laboratory</h3>
      <div className="space-y-4 max-w-xl">
        {FIELDS.map(field => {
          const props = {
            id: `conc-cyl-${field.key}`,
            className: 'input-field',
            value: value[field.key] ?? '',
            disabled,
            onChange: (e) => onChange(field.key, e.target.value),
          }
          return (
            <div key={field.key}>
              <label htmlFor={props.id} className="input-label">{field.label}</label>
              {field.multiline ? <textarea rows={2} {...props} /> : <input type="text" {...props} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
