/**
 * The Concrete Cylinder Data "Cylinders" card: an Add Cylinder button and one editable row per cylinder (class of
 * concrete, cylinder number, slump), each removable; the lab fills the remaining template columns after testing.
 * Stateless. Props: cylinders (array of { class, cylinderNo, slump }), onAddCylinder(),
 * onCylinderChange(index, field, value), onRemoveCylinder(index), disabled (makes the button and inputs natively disabled).
 */
import RemoveRowButton from './RemoveRowButton'

const FIELDS = [
  { label: 'Class of Concrete', key: 'class', type: 'text' },
  { label: 'Cylinder #', key: 'cylinderNo', type: 'text' },
  { label: 'Slump', key: 'slump', type: 'number' },
]

export default function ConcCylCylindersTable({ cylinders, onAddCylinder, onCylinderChange, onRemoveCylinder, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="form-section-title mb-0">Cylinders</h3>
        <button type="button" onClick={onAddCylinder} disabled={disabled} className="btn-secondary text-sm">
          Add Cylinder
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Inspector completes Class, Cylinder #, and Slump. Lab fills remaining columns after testing.
      </p>
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
          {cylinders.length === 0 ? (
            <tr>
              <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                No cylinders added yet. Click Add Cylinder to record one.
              </td>
            </tr>
          ) : (
            cylinders.map((cylinder, index) => (
              <tr key={index}>
                {FIELDS.map(field => (
                  <td key={field.key} className="px-4 py-2">
                    <input
                      type={field.type}
                      step={field.type === 'number' ? '0.01' : undefined}
                      className="input-field"
                      aria-label={`Cylinder ${index + 1} ${field.label}`}
                      value={cylinder[field.key] ?? ''}
                      disabled={disabled}
                      onChange={(e) => onCylinderChange(index, field.key, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-4 py-2">
                  <RemoveRowButton
                    onClick={() => onRemoveCylinder(index)}
                    disabled={disabled}
                    ariaLabel={`Remove cylinder ${index + 1}`}
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
