import { useState } from 'react'
import { setAssessmentRates } from '../services/api'

// The backend's bounds on a rate: at least 0, under a million, at most 4 decimal places
const MAX_RATE = 1_000_000
const MAX_DECIMALS = 4

const RATES = [
  { key: 'cost_per_sf_4in', label: '4" cost / SF', id: 'rate-4in' },
  { key: 'cost_per_sf_7in', label: '7" cost / SF', id: 'rate-7in' },
]

const asText = (value) => (value == null ? '' : String(value))

/**
 * What a typed rate means: {valid, value}, value the number to send, or null for a blank box (which clears the
 * rate). Not valid when it isn't a number, is negative, is a million or more, or has more than 4 decimal places.
 */
export function rateOf(text) {
  const trimmed = text.trim()
  if (trimmed === '') return { valid: true, value: null }
  const value = Number(trimmed)
  const decimals = trimmed.includes('.') ? trimmed.split('.')[1].length : 0
  const valid = Number.isFinite(value) && !/e/i.test(trimmed) && value >= 0 && value < MAX_RATE && decimals <= MAX_DECIMALS
  return { valid, value: valid ? value : null }
}

/**
 * The "Assessment rates" section of the admin's pay-items page: the project's DOT assessment rates per square foot,
 * 4" and 7", each a number box (blank clears it), and Save, which is off until a rate has changed and both are
 * valid (0 or more, under a million, 4 decimal places at most). Save PATCHes only the rates that changed; a refusal
 * shows inline as the backend worded it and the boxes keep what was typed; a success says so until the next edit.
 * Props: project ({project_id, cost_per_sf_4in, cost_per_sf_7in}), onSaved(project) (the project the backend
 * returned).
 */
export default function AssessmentRatesCard({ project, onSaved }) {
  const [typed, setTyped] = useState(() => Object.fromEntries(RATES.map(({ key }) => [key, asText(project[key])])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const parsed = Object.fromEntries(RATES.map(({ key }) => [key, rateOf(typed[key])]))
  const changed = RATES.filter(({ key }) => parsed[key].valid && parsed[key].value !== (project[key] ?? null))
  const valid = RATES.every(({ key }) => parsed[key].valid)
  const ready = valid && changed.length > 0 && !busy

  const type = (key) => (e) => {
    setTyped(current => ({ ...current, [key]: e.target.value }))
    setSaved(false)
    setError(null)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      const updated = await setAssessmentRates(
        project.project_id,
        Object.fromEntries(changed.map(({ key }) => [key, parsed[key].value])),
      )
      setTyped(Object.fromEntries(RATES.map(({ key }) => [key, asText(updated[key])])))
      setSaved(true)
      onSaved(updated)
    } catch (err) {
      setError(`Couldn't save the rates: ${err.message}`)
    }
    setBusy(false)
  }

  return (
    <section aria-labelledby="assessment-rates-heading" className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 id="assessment-rates-heading" className="text-lg font-semibold text-gray-900">Assessment rates</h3>
      <p className="text-sm text-gray-600 mb-4">The DOT's rates per square foot for this project. Leave a box blank to clear it.</p>
      {/* Checked by rateOf, not the browser (whose step check trips on floating point) */}
      <form onSubmit={save} noValidate className="flex flex-wrap items-end gap-4">
        {RATES.map(({ key, label, id }) => (
          <div key={key}>
            <label htmlFor={id} className="input-label">{label}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
              <input
                id={id}
                type="number"
                min="0"
                step="0.0001"
                inputMode="decimal"
                value={typed[key]}
                onChange={type(key)}
                disabled={busy}
                className="input-field w-40 pl-7"
              />
            </div>
          </div>
        ))}
        <button type="submit" disabled={!ready} className="btn-primary">{busy ? 'Saving...' : 'Save'}</button>
      </form>
      {!valid && (
        <p role="alert" className="text-sm text-red-600 mt-2">
          A rate is a number from 0 up to (not including) 1,000,000, with at most 4 decimal places.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>}
      {saved && <p role="status" className="text-sm text-green-700 mt-2">Assessment rates saved.</p>}
    </section>
  )
}
