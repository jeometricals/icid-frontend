/**
 * The SWCB "Inspection Matrix" card: seven inspection items, each answered Y / N / N/A separately for Base, Sidewalk
 * and Curb (one radio group per cell). Stateless. Props: matrix ({ [rowKey]: { base, sidewalk, curb } }, each
 * 'Y' | 'N' | 'NA' | null), onChange(rowKey, column, value), disabled (makes the radios natively disabled).
 */
const MATRIX_ROWS = [
  { label: 'Subgrade Compacted', key: 'subgradeCompacted' },
  { label: 'Compaction Test Taken', key: 'compactionTestTaken' },
  { label: 'Sidewalk 6" Foundation Material Placed and Compacted', key: 'sidewalkFoundationPlaced' },
  { label: 'Roadway Stone Base Placed and Compacted', key: 'roadwayStoneBasePlaced' },
  { label: 'Curing Compound Applied', key: 'curingCompoundApplied' },
  { label: 'Other Curing Methods', key: 'otherCuringMethods' },
  { label: 'Rebar Installed per Approved Shop Drawings and Bending Schedule?', key: 'rebarInstalled' },
]

const COLUMNS = [
  { label: 'Base', key: 'base' },
  { label: 'Sidewalk', key: 'sidewalk' },
  { label: 'Curb', key: 'curb' },
]

const OPTIONS = [
  { label: 'Y', value: 'Y' },
  { label: 'N', value: 'N' },
  { label: 'N/A', value: 'NA' },
]

export default function SWCBInspectionMatrix({ matrix, onChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Inspection Matrix</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-2/5">Item</th>
              {COLUMNS.map(column => (
                <th key={column.key} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {MATRIX_ROWS.map(row => (
              <tr key={row.key}>
                <td className="px-4 py-3 text-sm text-gray-900">{row.label}</td>
                {COLUMNS.map(column => (
                  <td key={column.key} className="px-4 py-3">
                    <div className="flex justify-center gap-3">
                      {OPTIONS.map(option => (
                        <label key={option.value} className="flex items-center gap-1 text-xs text-gray-600">
                          <input
                            type="radio"
                            name={`${row.key}-${column.key}`}
                            aria-label={`${row.label}, ${column.label}: ${option.label}`}
                            checked={matrix[row.key]?.[column.key] === option.value}
                            disabled={disabled}
                            onChange={() => onChange(row.key, column.key, option.value)}
                            className="h-4 w-4 text-construction-600 focus:ring-construction-500"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
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
