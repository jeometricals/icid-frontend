/**
 * The Concrete Truck & Mix Info "Concrete Specifications" card: Class of Concrete, and Min / Max for Slump and Air.
 * Stateless. Props: value ({ classOfConcrete, slumpMin, slumpMax, airMin, airMax }), onChange(field, value),
 * disabled (makes the inputs natively disabled).
 */
const RANGES = [
  { label: 'Slump', min: 'slumpMin', max: 'slumpMax' },
  { label: 'Air', min: 'airMin', max: 'airMax' },
]

export default function ConcMixConcreteSpecs({ value, onChange, disabled = false }) {
  const numberInput = (field, label) => (
    <div className="flex-1">
      <label htmlFor={`conc-mix-${field}`} className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        id={`conc-mix-${field}`}
        type="number"
        step="0.01"
        className="input-field"
        value={value[field] ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(field, e.target.value)}
      />
    </div>
  )

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Concrete Specifications</h3>
      <div className="space-y-4">
        <div className="max-w-md">
          <label htmlFor="conc-mix-classOfConcrete" className="input-label">Class of Concrete</label>
          <input
            id="conc-mix-classOfConcrete"
            type="text"
            className="input-field"
            value={value.classOfConcrete ?? ''}
            disabled={disabled}
            onChange={(e) => onChange('classOfConcrete', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {RANGES.map(range => (
            <fieldset key={range.label} className="min-w-0">
              <legend className="input-label">{range.label}</legend>
              <div className="flex gap-3">
                {numberInput(range.min, `${range.label} Min`)}
                {numberInput(range.max, `${range.label} Max`)}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    </div>
  )
}
