/**
 * The IDR's shared header inputs: work and inspector times, daily temperature range, AM/PM weather.
 * Presentational only. Props: values (form strings keyed by header field, see lib/idrHeader), onChange(field, value),
 * disabled (makes the inputs natively disabled). Each field's reviewer edits are drawn as a redline, and its reviewer
 * edits it through the pencil, when a RedlineProvider is around the form.
 */
import RedlinedField from './RedlinedField'

// How a header value reads and is sent: a time without its seconds, an empty input as nothing
const timeFormat = (value) => (value ? String(value).slice(0, 5) : value)
const orNull = (text) => (text === '' ? null : text)
const numberOrNull = (text) => (text === '' ? null : Number(text))

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

export default function IdrHeaderForm({ values, onChange, disabled = false }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {TIME_INPUTS.map(([field, label]) => (
        <div key={field}>
          <label htmlFor={field} className="input-label">{label}</label>
          <RedlinedField path={`header.${field}`} value={values[field]} label={label} type="time" format={timeFormat} toRequest={orNull}>
            <input
              id={field}
              type="time"
              className="input-field"
              value={values[field]}
              disabled={disabled}
              onChange={e => onChange(field, e.target.value)}
            />
          </RedlinedField>
        </div>
      ))}
      {TEMP_INPUTS.map(([field, label]) => (
        <div key={field}>
          <label htmlFor={field} className="input-label">{label}</label>
          <RedlinedField path={`header.${field}`} value={values[field]} label={label} type="number" toRequest={numberOrNull}>
            <input
              id={field}
              type="number"
              step="0.1"
              className="input-field"
              value={values[field]}
              disabled={disabled}
              onChange={e => onChange(field, e.target.value)}
            />
          </RedlinedField>
        </div>
      ))}
      {WEATHER_INPUTS.map(([field, label]) => (
        <div key={field}>
          <label htmlFor={field} className="input-label">{label}</label>
          <RedlinedField
            path={`header.${field}`}
            value={values[field]}
            label={label}
            type="select"
            options={weatherChoices(values[field]).map(option => ({ value: option, label: option }))}
            toRequest={orNull}
          >
            <select
              id={field}
              className="input-field"
              value={values[field]}
              disabled={disabled}
              onChange={e => onChange(field, e.target.value)}
            >
              <option value="">Select...</option>
              {weatherChoices(values[field]).map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </RedlinedField>
        </div>
      ))}
    </div>
  )
}

// A saved value outside the standard list (e.g. "Partly cloudy") is kept as an extra choice so it still shows
function weatherChoices(current) {
  return current && !WEATHER_OPTIONS.includes(current) ? [...WEATHER_OPTIONS, current] : WEATHER_OPTIONS
}
