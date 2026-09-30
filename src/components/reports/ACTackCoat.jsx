/**
 * The Asphaltic Concrete "Tack Coat" card: gallons applied, gallons per square yard and the application method / type.
 * Stateless. Props: value ({ noOfGallons, gallonsPerSy, applicationMethod }), onChange(field, value),
 * disabled (makes the inputs natively disabled).
 */
const QUANTITY_FIELDS = [
  { label: 'No. of Gallons', key: 'noOfGallons' },
  { label: 'Gallons per S.Y.', key: 'gallonsPerSy' },
]

export default function ACTackCoat({ value, onChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Tack Coat</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUANTITY_FIELDS.map(field => (
          <div key={field.key}>
            <label htmlFor={`ac-tack-${field.key}`} className="input-label">{field.label}</label>
            <input
              id={`ac-tack-${field.key}`}
              type="number"
              step="0.01"
              className="input-field"
              value={value[field.key] ?? ''}
              disabled={disabled}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          </div>
        ))}
        <div className="md:col-span-2">
          <label htmlFor="ac-tack-applicationMethod" className="input-label">Tack Coat Application Method / Type</label>
          <input
            id="ac-tack-applicationMethod"
            type="text"
            className="input-field"
            value={value.applicationMethod ?? ''}
            disabled={disabled}
            onChange={(e) => onChange('applicationMethod', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
