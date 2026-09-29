/**
 * The "Work Force" half of a report's workforce/equipment card: a headcount input per default role, then any added
 * trades (each removable) and an "Add trade" picker. Stateless. Props: workforce ({ superintendent, foremen, operators,
 * laborers, flaggers }), onChange(role, value), additionalWorkforce ([{ label, count }]), onAddTrade(label),
 * onChangeAdditional(index, field, value), onRemoveAdditional(index), disabled (makes the inputs natively disabled).
 */
import AddRowPicker, { OTHER_OPTION } from './AddRowPicker'
import RemoveRowButton from './RemoveRowButton'

const WORKFORCE_EXTRAS = ['Chauffeurs', 'Surveyors', 'Masons', 'Carpenters', 'Timbermen', 'Teamsters', OTHER_OPTION]

export default function WorkforceSection({
  workforce,
  onChange,
  additionalWorkforce,
  onAddTrade,
  onChangeAdditional,
  onRemoveAdditional,
  disabled = false,
}) {
  return (
    <div>
      <h4 className="text-md font-semibold text-gray-900 mb-3">Work Force</h4>
      <div className="space-y-3">
        {['Superintendent', 'Foremen', 'Operators', 'Laborers', 'Flaggers'].map((role) => (
          <div key={role} className="grid grid-cols-2 gap-2">
            <div className="flex items-center px-3 py-2 bg-gray-50 rounded">
              <span className="text-sm font-medium text-gray-700">{role}</span>
            </div>
            <input
              type="number"
              className="input-field"
              placeholder="No."
              value={workforce[role.toLowerCase()]}
              disabled={disabled}
              onChange={(e) => onChange(role.toLowerCase(), e.target.value)}
            />
          </div>
        ))}
        {additionalWorkforce.map((row, index) => (
          <div key={index} className="grid grid-cols-2 gap-2">
            <div className="flex items-center px-3 py-2 bg-gray-50 rounded">
              <span className="text-sm font-medium text-gray-700">{row.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input-field"
                placeholder="No."
                value={row.count}
                disabled={disabled}
                onChange={(e) => onChangeAdditional(index, 'count', e.target.value)}
              />
              <RemoveRowButton onClick={() => onRemoveAdditional(index)} disabled={disabled} ariaLabel={`Remove ${row.label}`} />
            </div>
          </div>
        ))}
      </div>
      <AddRowPicker
        options={WORKFORCE_EXTRAS}
        usedLabels={additionalWorkforce.map(r => r.label)}
        onPick={onAddTrade}
        placeholder="Add trade"
        disabled={disabled}
      />
    </div>
  )
}
