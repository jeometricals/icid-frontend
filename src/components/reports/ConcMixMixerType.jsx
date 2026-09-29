/**
 * The Concrete Truck & Mix Info "Mixer Type" card: Ready Mix or Other, with a text box for the specific type once
 * Other is picked. Stateless. Props: value ({ type: 'readyMix' | 'other' | '', otherLabel }),
 * onChange(nextValue) with the whole updated value, disabled (makes the inputs natively disabled).
 */
export default function ConcMixMixerType({ value, onChange, disabled = false }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Mixer Type</h3>
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center space-x-2 text-sm text-gray-700">
          <input
            type="radio"
            name="mixer-type"
            checked={value.type === 'readyMix'}
            disabled={disabled}
            onChange={() => onChange({ ...value, type: 'readyMix' })}
            className="h-4 w-4 text-construction-600 focus:ring-construction-500"
          />
          <span>Ready Mix</span>
        </label>
        <div className="flex items-center gap-3">
          <label className="flex items-center space-x-2 text-sm text-gray-700">
            <input
              type="radio"
              name="mixer-type"
              checked={value.type === 'other'}
              disabled={disabled}
              onChange={() => onChange({ ...value, type: 'other' })}
              className="h-4 w-4 text-construction-600 focus:ring-construction-500"
            />
            <span>Other</span>
          </label>
          {value.type === 'other' && (
            <input
              type="text"
              className="input-field w-56"
              placeholder="Specify mixer type"
              aria-label="Other mixer type"
              value={value.otherLabel}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, otherLabel: e.target.value })}
            />
          )}
        </div>
      </div>
    </div>
  )
}
