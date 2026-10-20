import { useEffect, useId, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { RAMP_COMMENTS_MAX, RAMP_FIELDS, rampKeys } from '../data/pedRampForm'
import { rampTypeLabel } from '../data/propertyKinds'
import { getRampAttributes, saveRampAttributes } from '../services/api'

export const NOT_ENTERED = 'Not entered yet.'
export const WITHIN = 'Every value entered is within the ADA advisories.'
const UNITS = { pct: '%', in: 'in' }

// A stored value as the form holds it: text, '' for none, 'true' / 'false' for a yes or no
const shown = (value) => (value === null || value === undefined ? '' : String(value))

// The form's values for a ramp type's fields, from its attributes (none: every field empty)
const valuesOf = (rampType, attributes) =>
  Object.fromEntries(rampKeys(rampType).map(key => [key, shown(attributes?.[key])]))

// What the form sends for a field: '' as null, a yes or no as a boolean, a measurement as a number, text trimmed
function sent(type, text) {
  const value = text.trim()
  if (value === '') return null
  if (type === 'yesno') return value === 'true'
  if (type === 'pct' || type === 'in') return Number(value)
  return value
}

/**
 * A ped ramp's attributes, the DOT form's section 5 for its ramp type, on the ramp's page (pedramp 2a): its answers on
 * the left and its measurements on the right, as the form lays them out, then comments. Slopes are in percent, lengths
 * in inches. The backend's ADA warnings are listed above the fields and mark the fields they name; they never stop a
 * save. A writer (canEdit) saves the whole set (Save, off until something changed or while a measurement isn't a
 * number); anyone else reads it. A cut-through's two ramps are two sites: each carries its own attributes.
 * Props: property (a ped ramp), canEdit.
 */
export default function RampAttributesSection({ property, canEdit }) {
  const uid = useId() // one form per ramp: an inspection form shows several
  const fields = RAMP_FIELDS[property.ramp_type]
  const keys = rampKeys(property.ramp_type)
  const types = Object.fromEntries([...fields.answers, ...fields.measurements].map(([key, , type]) => [key, type]))

  const [saved, setSaved] = useState(undefined) // undefined while loading, null when none entered
  const [values, setValues] = useState({})
  const [loadError, setLoadError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  const startFrom = (attributes) => {
    setSaved(attributes)
    setValues(valuesOf(property.ramp_type, attributes))
  }

  useEffect(() => {
    let ignore = false
    setLoadError(null)
    getRampAttributes(property.id)
      .then(found => {
        if (ignore) return
        setSaved(found)
        setValues(valuesOf(property.ramp_type, found))
      })
      .catch(err => { if (!ignore) setLoadError(err.message) })
    return () => { ignore = true }
  }, [property.id, property.ramp_type, attempt])

  const sending = Object.fromEntries(keys.map(key => [key, sent(types[key] ?? 'text', values[key] ?? '')]))
  const before = Object.fromEntries(keys.map(key => [key, sent(types[key] ?? 'text', shown(saved?.[key]))]))
  const changed = keys.some(key => sending[key] !== before[key])
  const badNumber = keys.some(key => (types[key] === 'pct' || types[key] === 'in') && sending[key] !== null
    && !Number.isFinite(sending[key]))
  const warnings = saved?.warnings ?? []
  const warned = new Set(warnings.map(warning => warning.field))

  const save = async () => {
    setBusy(true)
    setSaveError(null)
    try {
      startFrom(await saveRampAttributes(property.id, sending))
    } catch (err) {
      setSaveError(err.message)
    }
    setBusy(false)
  }

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const input = ([key, label, type, choices]) => {
    const common = {
      id: `${uid}-ramp-${key}`, value: values[key] ?? '', disabled: !canEdit || busy,
      'aria-invalid': warned.has(key) || undefined, onChange: (e) => set(key, e.target.value),
      className: `input-field ${warned.has(key) ? 'border-red-500 text-red-700' : ''}`,
    }
    let control
    if (type === 'yesno') {
      control = (
        <select {...common}>
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      )
    } else if (type === 'select') {
      control = (
        <select {...common}>
          <option value="">—</option>
          {choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      )
    } else if (UNITS[type]) {
      control = (
        <div className="flex items-center gap-2">
          <input type="text" inputMode="decimal" {...common} />
          <span className="text-sm text-gray-500 w-6">{UNITS[type]}</span>
        </div>
      )
    } else {
      control = <input type="text" maxLength={50} {...common} />
    }
    return (
      <div key={key}>
        <label htmlFor={`${uid}-ramp-${key}`} className={`input-label ${warned.has(key) ? 'text-red-700' : ''}`}>
          {label}{warned.has(key) && <span className="ml-1 text-xs font-semibold">(ADA)</span>}
        </label>
        {control}
      </div>
    )
  }

  return (
    <section aria-labelledby={`${uid}-ramp-attributes-heading`} className="bg-white rounded-lg shadow-sm p-6 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 id={`${uid}-ramp-attributes-heading`} className="text-lg font-semibold text-gray-900">
          Ramp Attributes <span className="text-sm font-normal text-gray-500">— {rampTypeLabel(property.ramp_type)}</span>
        </h3>
        {canEdit && saved !== undefined && (
          <button type="button" onClick={save} disabled={busy || !changed || badNumber} className="btn-primary">
            {busy ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-red-600">
          Couldn't load the ramp's attributes: {loadError}{' '}
          <button type="button" onClick={() => setAttempt(a => a + 1)} className="underline font-medium">Retry</button>
        </p>
      ) : saved === undefined ? (
        <div role="status" className="animate-spin rounded-full h-6 w-6 border-b-2 border-construction-600"></div>
      ) : (
        <>
          <div className="mb-4 text-sm">
            {saved === null ? (
              <p className="text-gray-500">{NOT_ENTERED}</p>
            ) : warnings.length === 0 ? (
              <p className="text-green-700">{WITHIN}</p>
            ) : (
              <div role="status" aria-label="ADA warnings" className="rounded-md border border-amber-300 bg-amber-50 p-3">
                <p className="flex items-center gap-2 font-medium text-amber-800">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  {warnings.length} ADA warning{warnings.length === 1 ? '' : 's'} (saved anyway)
                </p>
                <ul className="mt-2 list-disc pl-6 text-amber-900">
                  {warnings.map(warning => <li key={warning.field}>{warning.message}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">{fields.answers.map(input)}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">{fields.measurements.map(input)}</div>
          </div>
          <div className="mt-4">
            <label htmlFor={`${uid}-ramp-comments`} className="input-label">Comments</label>
            <textarea
              id={`${uid}-ramp-comments`}
              rows={3}
              maxLength={RAMP_COMMENTS_MAX}
              className="input-field"
              value={values.comments ?? ''}
              disabled={!canEdit || busy}
              onChange={(e) => set('comments', e.target.value)}
            />
          </div>
          {badNumber && <p role="alert" className="text-sm text-red-600 mt-2">Slopes and lengths must be numbers.</p>}
          {saveError && <p role="alert" className="text-sm text-red-600 mt-2">{saveError}</p>}
        </>
      )}
    </section>
  )
}
