/**
 * The "Work Force" half of a report's workforce/equipment card: a headcount input per role. Stateless.
 * Props: workforce ({ superintendent, foreman, operator, flagger }), onChange(role, value) with the
 * lowercased role key, disabled (makes the inputs natively disabled).
 */
export default function WorkforceSection({ workforce, onChange, disabled = false }) {
  return (
    <div>
      <h4 className="text-md font-semibold text-gray-900 mb-3">Work Force</h4>
      <div className="space-y-3">
        {['Superintendent', 'Foreman', 'Operator', 'Flagger'].map((role) => (
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
      </div>
    </div>
  )
}
