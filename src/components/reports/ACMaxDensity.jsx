/**
 * The Asphaltic Concrete "Theoretical Max Density (from A/C Plant)" card: the Top and Binder course densities.
 * Stateless. Props: value ({ top, binder }), onChange(field, value), disabled (makes the inputs natively disabled).
 * A reviewer's edit of a field reads in its place.
 */
import RedlinedField from '../RedlinedField'

const FIELDS = [
  { label: 'Top', key: 'top' },
  { label: 'Binder', key: 'binder' },
]

export default function ACMaxDensity({ value, onChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Theoretical Max Density (from A/C Plant)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map(field => (
          <div key={field.key}>
            <label htmlFor={`ac-max-density-${field.key}`} className="input-label">{field.label}</label>
            <RedlinedField
              path={`maxDensity.${field.key}`}
              value={value[field.key] ?? ''}
              label={`Max Density ${field.label}`}
              type="number"
            >
              <input
                id={`ac-max-density-${field.key}`}
                type="number"
                step="0.01"
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
