/**
 * The Asphaltic Concrete "Temperature" card: surface and ambient temperatures at the start and finish of paving, in
 * °F, as a 2 × 2 grid. Stateless. Props: value ({ surfaceStart, surfaceFinish, ambientStart, ambientFinish }),
 * onChange(field, value), disabled (makes the inputs natively disabled).
 */
const ROWS = [
  { label: 'Surface', start: 'surfaceStart', finish: 'surfaceFinish' },
  { label: 'Ambient', start: 'ambientStart', finish: 'ambientFinish' },
]

export default function ACTemperature({ value, onChange, disabled = false }) {
  const temperatureInput = (field, label) => (
    <div key={field} className="flex items-center gap-2">
      <input
        type="number"
        step="0.01"
        className="input-field"
        aria-label={label}
        value={value[field] ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(field, e.target.value)}
      />
      <span className="text-sm text-gray-500">°F</span>
    </div>
  )

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="form-section-title">Temperature</h3>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-3 items-center max-w-xl">
        <span />
        <span className="text-xs font-medium text-gray-500 uppercase">Start</span>
        <span className="text-xs font-medium text-gray-500 uppercase">Finish</span>
        {ROWS.flatMap(row => [
          <span key={row.label} className="text-sm font-medium text-gray-700">{row.label}</span>,
          temperatureInput(row.start, `${row.label} Start`),
          temperatureInput(row.finish, `${row.label} Finish`),
        ])}
      </div>
    </div>
  )
}
