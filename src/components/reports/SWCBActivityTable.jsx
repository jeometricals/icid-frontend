/**
 * The SWCB "Detailed Activity" card: From Station / To Station / Remarks inputs for Excavation, Form / Prep and Pour.
 * Stateless. Props: activity ({ excavation, formPrep, pour }, each { fromStation, toStation, remarks }),
 * onChange(row, field, value), disabled (makes the inputs natively disabled).
 * A reviewer's edit of a cell reads in its place.
 */
import RedlinedField from '../RedlinedField'

const ACTIVITY_ROWS = [
  { label: 'Excavation', key: 'excavation' },
  { label: 'Form / Prep', key: 'formPrep' },
  { label: 'Pour', key: 'pour' },
]

const FIELDS = [
  { label: 'From Station', key: 'fromStation' },
  { label: 'To Station', key: 'toStation' },
  { label: 'Remarks', key: 'remarks' },
]

export default function SWCBActivityTable({ activity, onChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Detailed Activity</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detailed Activity</th>
              {FIELDS.map(field => (
                <th key={field.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ACTIVITY_ROWS.map(row => (
              <tr key={row.key}>
                <td className="px-4 py-2">
                  <div className="flex items-center px-3 py-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium text-gray-700">{row.label}</span>
                  </div>
                </td>
                {FIELDS.map(field => (
                  <td key={field.key} className="px-4 py-2">
                    <RedlinedField
                      path={`activity.${row.key}.${field.key}`}
                      value={activity[row.key]?.[field.key] ?? ''}
                      label={`${row.label} ${field.label}`}
                    >
                      <input
                        type="text"
                        className="input-field"
                        placeholder={field.label}
                        aria-label={`${row.label} ${field.label}`}
                        value={activity[row.key]?.[field.key] ?? ''}
                        disabled={disabled}
                        onChange={(e) => onChange(row.key, field.key, e.target.value)}
                      />
                    </RedlinedField>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
