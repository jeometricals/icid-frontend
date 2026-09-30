/**
 * The Asphaltic Concrete requirements checklist: seven AC-specific items, each answered Y / N / N/A with a Remarks
 * input (separate from the shared end-of-day safety checklist). Stateless. Props: value ({ [key]: { value: '' | 'Y' |
 * 'N' | 'NA', remarks } }), onChange(nextValue) with the whole updated object, disabled (makes the inputs natively disabled).
 */
const ITEMS = [
  { label: 'Subgrade Compacted per Spec or Approved Alternative', key: 'subgradeCompacted' },
  { label: 'Roadway Subgrade/Base Surface Sufficiently Clean and Dry', key: 'roadwayCleanDry' },
  { label: 'A/C Roller as per Spec or Approved Plan', key: 'acRollerPerSpec' },
  { label: 'Density Tests Taken', key: 'densityTestsTaken' },
  { label: 'Spot Check A/C Depth', key: 'spotCheckAcDepth' },
  { label: 'Tack Coat Applied as per Spec', key: 'tackCoatPerSpec' },
  { label: 'Tack Coat Applied on All Edges of Hardware', key: 'tackCoatOnEdges' },
]

const OPTIONS = [
  { label: 'Y', value: 'Y' },
  { label: 'N', value: 'N' },
  { label: 'N/A', value: 'NA' },
]

const HEADER_CLASS = 'px-4 py-3 text-xs font-medium text-gray-500 uppercase'

export default function ACRequirementsChecklist({ value, onChange, disabled = false }) {
  const updateItem = (key, field, fieldValue) => {
    onChange({ ...value, [key]: { ...value[key], [field]: fieldValue } })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">AC Requirements Checklist</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className={`${HEADER_CLASS} text-left w-1/2`}>Item</th>
              {OPTIONS.map(option => (
                <th key={option.value} className={`${HEADER_CLASS} text-center`}>{option.label}</th>
              ))}
              <th className={`${HEADER_CLASS} text-left`}>Remarks</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ITEMS.map(item => (
              <tr key={item.key}>
                <td className="px-4 py-3 text-sm text-gray-900">{item.label}</td>
                {OPTIONS.map(option => (
                  <td key={option.value} className="px-4 py-3 text-center">
                    <input
                      type="radio"
                      name={`ac-requirements-${item.key}`}
                      aria-label={`${item.label}: ${option.label}`}
                      checked={value[item.key]?.value === option.value}
                      disabled={disabled}
                      onChange={() => updateItem(item.key, 'value', option.value)}
                      className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                    />
                  </td>
                ))}
                <td className="px-4 py-3">
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Remarks"
                    aria-label={`${item.label} Remarks`}
                    value={value[item.key]?.remarks ?? ''}
                    disabled={disabled}
                    onChange={(e) => updateItem(item.key, 'remarks', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
