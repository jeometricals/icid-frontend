/**
 * The Concrete Truck & Mix Info "Location of Use" card: a checkbox each for Curb, Sidewalk, Concrete Base and
 * Structural. Stateless. Props: value ({ curb, sidewalk, concreteBase, structural } booleans),
 * onChange(key, checked), disabled (makes the checkboxes natively disabled).
 * A reviewer's edit of a checkbox reads under it (Yes / No).
 */
import RedlinedField from '../RedlinedField'

const ANSWERS = [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]

const LOCATIONS = [
  { label: 'Curb', key: 'curb' },
  { label: 'Sidewalk', key: 'sidewalk' },
  { label: 'Concrete Base', key: 'concreteBase' },
  { label: 'Structural', key: 'structural' },
]

export default function ConcMixLocationOfUse({ value, onChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Location of Use</h3>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        {LOCATIONS.map(location => (
          <div key={location.key}>
            <label className="flex items-center space-x-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={value[location.key] === true}
                disabled={disabled}
                onChange={(e) => onChange(location.key, e.target.checked)}
                className="h-4 w-4 rounded text-construction-600 focus:ring-construction-500"
              />
              <span>{location.label}</span>
            </label>
            {/* The answer itself is the checkbox; its edits, and the reviewer's pencil, sit here */}
            <RedlinedField
              path={`locationOfUse.${location.key}`}
              value={value[location.key] === true}
              label={location.label}
              type="select"
              options={ANSWERS}
              toRequest={(text) => text === 'true'}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
