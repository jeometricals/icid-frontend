import { useState } from 'react'
import Modal from './Modal'
import { BOROUGHS } from '../data/propertyKinds'
import { CORNER_COMMENTS_MAX, CORNER_REQUIRED, CORNER_SECTIONS } from '../data/pedRampForm'
import { formErrors } from '../lib/formErrors'

const FIELDS = CORNER_SECTIONS.flatMap(section => section.fields)
const KEYS = [...FIELDS.map(([key]) => key), 'comments']
const TYPES = Object.fromEntries(FIELDS.map(([key, , type]) => [key, type]))

// A stored value as the form holds it: text, '' for none, 'true' / 'false' for a yes or no
function shown(value) {
  return value === null || value === undefined ? '' : String(value)
}

// What the form sends for a field: text trimmed, '' as null, a yes or no as a boolean, the ramp count as a number
function sent(key, text) {
  const value = text.trim()
  if (value === '') return null
  if (TYPES[key] === 'yesno') return value === 'true'
  if (TYPES[key] === 'ramps') return Number(value)
  return value
}

const startingValues = (initial) => Object.fromEntries(KEYS.map(key => [key, shown(initial?.[key])]))
const cleaned = (values) => Object.fromEntries(KEYS.map(key => [key, sent(key, values[key])]))

/**
 * Lets a member add a ped ramp corner to a project, or edit one: the DOT form's sections 1 to 3 (inspection, location,
 * construction) and comments. Borough and the two streets are required; everything else is optional, and a choice can
 * be put back to none. Save is off until the three are in and, when editing, until something has changed. Adding sends
 * every field; editing only what changed (a field emptied is sent as null, which clears it). The caller runs the save:
 * busy while it works, error (the thrown error) when it failed; a 422's messages read under the fields they name,
 * anything else below the form.
 * Props: mode ('add' | 'edit'), initial (the corner being edited), onSave(values), onCancel, busy, error.
 */
export default function PedRampCornerFormModal({ mode = 'add', initial, onSave, onCancel, busy = false, error = null }) {
  const [values, setValues] = useState(() => startingValues(initial))
  const adding = mode === 'add'
  const sending = cleaned(values)
  const before = cleaned(startingValues(initial))
  const changes = Object.fromEntries(KEYS.filter(key => sending[key] !== before[key]).map(key => [key, sending[key]]))
  const complete = CORNER_REQUIRED.every(key => sending[key] !== null)
  const ready = complete && (adding || Object.keys(changes).length > 0)
  const { fields, general } = formErrors(error, KEYS, {})

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !ready) return
    onSave(adding ? sending : changes)
  }

  const control = (key) => ({
    id: `corner-${key}`,
    className: 'input-field',
    value: values[key],
    disabled: busy,
    'aria-invalid': Boolean(fields[key]),
    'aria-describedby': fields[key] ? `corner-${key}-error` : undefined,
    onChange: (e) => set(key, e.target.value),
  })
  const choice = (key, choices, required) => (
    <select {...control(key)}>
      <option value="" disabled={required}>{required ? 'Choose…' : '—'}</option>
      {choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
  const input = (key, type, extra) => {
    const required = CORNER_REQUIRED.includes(key)
    if (type === 'boro') return choice(key, BOROUGHS.map(name => ({ value: name, label: name })), true)
    if (type === 'select') return choice(key, extra, required)
    if (type === 'yesno') return choice(key, [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }])
    if (type === 'ramps') return choice(key, [1, 2, 3].map(n => ({ value: String(n), label: String(n) })))
    if (type === 'date') return <input type="date" {...control(key)} />
    return <input type="text" maxLength={extra} {...control(key)} />
  }

  return (
    <Modal
      title={`${adding ? 'Add' : 'Edit'} ped ramp corner`}
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="corner-form" disabled={busy || !ready} className="btn-primary">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="corner-form" onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-6">
        {CORNER_SECTIONS.map(section => (
          <fieldset key={section.title} className="space-y-3">
            <legend className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">{section.title}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {section.fields.map(([key, label, type, extra]) => (
                <div key={key}>
                  <label htmlFor={`corner-${key}`} className="input-label">
                    {label}
                    {!CORNER_REQUIRED.includes(key) && <span className="text-gray-500 font-normal"> (optional)</span>}
                  </label>
                  {input(key, type, extra)}
                  {fields[key] && <p id={`corner-${key}-error`} role="alert" className="text-sm text-red-600 mt-1">{fields[key]}</p>}
                </div>
              ))}
            </div>
          </fieldset>
        ))}
        <div>
          <label htmlFor="corner-comments" className="input-label">Comments <span className="text-gray-500 font-normal">(optional)</span></label>
          <textarea rows={3} maxLength={CORNER_COMMENTS_MAX} {...control('comments')} />
        </div>
        {general && <p role="alert" className="text-sm text-red-600">{general}</p>}
      </form>
    </Modal>
  )
}
