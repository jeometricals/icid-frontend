/**
 * The SWCB "Inspection Matrix" card: seven inspection items answered separately for Base, Sidewalk and Curb, laid out
 * like the DDC form. Most items take Y / N / N/A per cell (one radio group each); "Sidewalk 6" Foundation" takes only
 * Sidewalk and "Roadway Stone Base" only Base (the other cells are greyed out), and "Other Curing Methods" is a short
 * text entry per column. Stateless. Props: matrix ({ [rowKey]: { base, sidewalk, curb } }: 'Y' | 'N' | 'NA' | null for
 * answer rows, text for the text row), onChange(rowKey, column, value), disabled (makes every input natively disabled).
 */

export const COLUMNS = [
  { label: 'Base', key: 'base' },
  { label: 'Sidewalk', key: 'sidewalk' },
  { label: 'Curb', key: 'curb' },
]

const ALL_COLUMNS = COLUMNS.map(column => column.key)

// Each item's columns that take an answer (the DDC form has no box for the others), and whether it's free text
export const MATRIX_ROWS = [
  { label: 'Subgrade Compacted', key: 'subgradeCompacted', columns: ALL_COLUMNS },
  { label: 'Compaction Test Taken', key: 'compactionTestTaken', columns: ALL_COLUMNS },
  { label: 'Sidewalk 6" Foundation Material Placed and Compacted', key: 'sidewalkFoundationPlaced', columns: ['sidewalk'] },
  { label: 'Roadway Stone Base Placed and Compacted', key: 'roadwayStoneBasePlaced', columns: ['base'] },
  { label: 'Curing Compound Applied', key: 'curingCompoundApplied', columns: ALL_COLUMNS },
  { label: 'Other Curing Methods', key: 'otherCuringMethods', columns: ALL_COLUMNS, text: true },
  { label: 'Rebar Installed per Approved Shop Drawings and Bending Schedule?', key: 'rebarInstalled', columns: ALL_COLUMNS },
]

const OPTIONS = [
  { label: 'Y', value: 'Y' },
  { label: 'N', value: 'N' },
  { label: 'N/A', value: 'NA' },
]

export default function SWCBInspectionMatrix({ matrix, onChange, disabled = false }) {
  const answerCell = (row, column) => {
    const applies = row.columns.includes(column.key)
    return (
      <td key={column.key} className={`px-4 py-3 ${applies ? '' : 'bg-gray-100'}`}>
        <div className={`flex justify-center gap-3 ${applies ? '' : 'opacity-40'}`}>
          {OPTIONS.map(option => (
            <label key={option.value} className="flex items-center gap-1 text-xs text-gray-600">
              <input
                type="radio"
                name={`${row.key}-${column.key}`}
                aria-label={`${row.label}, ${column.label}: ${option.label}`}
                checked={applies && matrix[row.key]?.[column.key] === option.value}
                disabled={disabled || !applies}
                onChange={() => onChange(row.key, column.key, option.value)}
                className="h-4 w-4 text-construction-600 focus:ring-construction-500"
              />
              {option.label}
            </label>
          ))}
        </div>
      </td>
    )
  }

  const textCell = (row, column) => (
    <td key={column.key} className="px-4 py-3">
      <input
        type="text"
        className="input-field"
        aria-label={`${row.label}, ${column.label}`}
        value={matrix[row.key]?.[column.key] ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(row.key, column.key, e.target.value)}
      />
    </td>
  )

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
                {COLUMNS.map(column => (row.text ? textCell(row, column) : answerCell(row, column)))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
