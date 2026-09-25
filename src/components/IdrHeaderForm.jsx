/**
 * The IDR's shared header inputs: work and inspector times, daily temperature range, AM/PM weather.
 * Presentational only; wrap it in <fieldset disabled> for read-only.
 * Props: values (form strings keyed by header field, see lib/idrHeader), onChange(field, value).
 */

const WEATHER_OPTIONS = ['Clear', 'Cloudy', 'Rainy', 'Snowy']

const TIME_INPUTS = [
  ['work_start_time', 'Work Activity Start'],
  ['work_end_time', 'Work Activity End'],
  ['inspector_start_time', 'Inspector Time Start'],
  ['inspector_end_time', 'Inspector Time End'],
]

const TEMP_INPUTS = [
  ['temp_low', 'Daily Temp Low (°F)'],
  ['temp_high', 'Daily Temp High (°F)'],
]

const WEATHER_INPUTS = [
  ['weather_am', 'Weather AM'],
  ['weather_pm', 'Weather PM'],
]

export default function IdrHeaderForm({ values, onChange }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {TIME_INPUTS.map(([field, label]) => (
        <div key={field}>
          <label htmlFor={field} className="input-label">{label}</label>
          <input
            id={field}
            type="time"
            className="input-field"
            value={values[field]}
            onChange={e => onChange(field, e.target.value)}
          />
        </div>
      ))}
      {TEMP_INPUTS.map(([field, label]) => (
        <div key={field}>
          <label htmlFor={field} className="input-label">{label}</label>
          <input
            id={field}
            type="number"
            step="0.1"
            className="input-field"
            value={values[field]}
            onChange={e => onChange(field, e.target.value)}
          />
        </div>
      ))}
      {WEATHER_INPUTS.map(([field, label]) => (
        <div key={field}>
          <label htmlFor={field} className="input-label">{label}</label>
          <select
            id={field}
            className="input-field"
            value={values[field]}
            onChange={e => onChange(field, e.target.value)}
          >
            <option value="">Select...</option>
            {weatherChoices(values[field]).map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}

// A saved value outside the standard list (e.g. "Partly cloudy") is kept as an extra choice so it still shows
function weatherChoices(current) {
  return current && !WEATHER_OPTIONS.includes(current) ? [...WEATHER_OPTIONS, current] : WEATHER_OPTIONS
}
