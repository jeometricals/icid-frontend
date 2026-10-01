/**
 * The SWCB "Operation" card: a Structural checkbox and the Subcontractor (if any), matching the line under the DDC
 * form's Description of Work. Curb, Sidewalk and Concrete Base aren't asked here; the export ticks them from the
 * Inspection Matrix. Stateless. Props: structural (boolean), subcontractor (string), onChange(field, value),
 * disabled (makes the inputs natively disabled).
 */
export default function SWCBOperationFields({ structural, subcontractor, onChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Operation</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={structural}
            disabled={disabled}
            onChange={(e) => onChange('structural', e.target.checked)}
            className="h-4 w-4 text-construction-600 focus:ring-construction-500 rounded"
          />
          Structural
        </label>
        <div className="md:col-span-2">
          <label htmlFor="swcb-subcontractor" className="input-label">Subcontractor (if any)</label>
          <input
            id="swcb-subcontractor"
            type="text"
            className="input-field"
            value={subcontractor}
            disabled={disabled}
            onChange={(e) => onChange('subcontractor', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
