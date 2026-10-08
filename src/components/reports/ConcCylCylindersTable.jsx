/**
 * The Concrete Cylinder Data "Cylinders" card: an Add Cylinder button (off once the sheet's 18 rows are used) and one
 * row per cylinder, each removable. The inspector fills class of concrete, cylinder number and slump; the five
 * columns the lab fills after testing show as disabled "— lab —" placeholders, as on the paper form.
 * Stateless. Props: cylinders (array of { class, cylinderNo, slump }, plus an id once the backend gave one),
 * onAddCylinder(), onCylinderChange(index, field, value), onRemoveCylinder(index),
 * disabled (makes the button and inputs natively disabled).
 */
import RemoveRowButton from './RemoveRowButton'

// The DDC sheet has 18 cylinder rows; a pour with more takes a second addendum
export const MAX_CYLINDERS = 18

const FIELDS = [
  { label: 'Class of Concrete', key: 'class' },
  { label: 'Cylinder #', key: 'cylinderNo' },
  { label: 'Slump', key: 'slump' },
]

// Filled in by the lab on the printed sheet, never in ICID
const LAB_COLUMNS = ['Age Day', 'Date Tested', 'Total Load Lbs (x1000)', 'PSI', 'Page Cyl Reg.']

const COLUMN_COUNT = FIELDS.length + LAB_COLUMNS.length + 1

export default function ConcCylCylindersTable({ cylinders, onAddCylinder, onCylinderChange, onRemoveCylinder, disabled = false }) {
  const isFull = cylinders.length >= MAX_CYLINDERS

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="form-section-title mb-0">Cylinders</h3>
        <button type="button" onClick={onAddCylinder} disabled={disabled || isFull} className="btn-secondary text-sm">
          Add Cylinder
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Inspector completes Class, Cylinder #, and Slump. Lab fills remaining columns after testing.
        {isFull && ` This sheet holds ${MAX_CYLINDERS} cylinders: add another Concrete Cylinder Data addendum for more.`}
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {[...FIELDS.map(field => field.label), ...LAB_COLUMNS].map(label => (
                <th key={label} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {label}
                </th>
              ))}
              <th className="px-4 py-3 w-12"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cylinders.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-8 text-center text-gray-500">
                  No cylinders added yet. Click Add Cylinder to record one.
                </td>
              </tr>
            ) : (
              cylinders.map((cylinder, index) => (
                <tr key={index}>
                  {FIELDS.map(field => (
                    <td key={field.key} className="px-4 py-2">
                      <input
                        type="text"
                        className="input-field min-w-[7rem]"
                        aria-label={`Cylinder ${index + 1} ${field.label}`}
                        value={cylinder[field.key] ?? ''}
                        disabled={disabled}
                        onChange={(e) => onCylinderChange(index, field.key, e.target.value)}
                      />
                    </td>
                  ))}
                  {LAB_COLUMNS.map(label => (
                    <td key={label} className="px-4 py-2">
                      <input
                        type="text"
                        className="input-field min-w-[5rem] bg-gray-100 text-center"
                        aria-label={`Cylinder ${index + 1} ${label} (filled by the lab)`}
                        placeholder="— lab —"
                        value=""
                        disabled
                        readOnly
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
    </div>
  )
}
