import { useState } from 'react'
import Modal from './Modal'
import { formErrors } from '../lib/formErrors'

// The longest initials the backend takes
export const MAX_INITIALS_LENGTH = 16

export const PIR_TAKEN = 'This site already has a PIR. Cancel to see it.'

const KEYS = ['inspector_initials', 'inspector_sign_date']

// What the form starts with: the PIR being edited, or nothing
const startingValues = (initial) => Object.fromEntries(KEYS.map(key => [key, initial?.[key] ?? '']))

const cleaned = (values) => ({
  inspector_initials: values.inspector_initials.trim(),
  inspector_sign_date: values.inspector_sign_date,
})

/**
 * Lets an admin digitize a property's PIR, or edit one: the inspector's initials and the date they signed it, both
 * required. Save is off until both are in and, when editing, until something has changed. Adding passes on both;
 * editing only what changed. The initials are trimmed. The caller runs the save: it sets busy while it works and
 * error (the thrown error) if it failed, and the form keeps what was typed. A 409 (the property got a PIR
 * meanwhile) and a 400 read below the form, a 422's messages under the fields they name.
 * Props: mode ('add' | 'edit'), initial (the PIR being edited; none when adding), onSave(values), onCancel, busy,
 * error.
 */
export default function PirFormModal({ mode = 'add', initial, onSave, onCancel, busy = false, error = null }) {
  const [values, setValues] = useState(() => startingValues(initial))

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const adding = mode === 'add'
  const sending = cleaned(values)
  const before = cleaned(startingValues(initial))
  const changes = Object.fromEntries(KEYS.filter(key => sending[key] !== before[key]).map(key => [key, sending[key]]))
  const ready = KEYS.every(key => Boolean(sending[key])) && (adding || Object.keys(changes).length > 0)
  const { fields, general } = formErrors(error, KEYS, { field: null, message: PIR_TAKEN })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !ready) return
    onSave(adding ? sending : changes)
  }

  const fieldError = (key) => fields[key] && (
    <p id={`pir-${key}-error`} role="alert" className="text-sm text-red-600 mt-1">{fields[key]}</p>
  )
  const described = (key) => (fields[key] ? `pir-${key}-error` : undefined)

  return (
    <Modal
      title={adding ? 'Add PIR' : 'Edit PIR'}
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="pir-form" disabled={busy || !ready} className="btn-primary">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="pir-form" onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4">
        <div>
          <label htmlFor="pir-inspector-initials" className="input-label">Inspector initials</label>
          <input
            id="pir-inspector-initials"
            type="text"
            className="input-field"
            value={values.inspector_initials}
            maxLength={MAX_INITIALS_LENGTH}
            disabled={busy}
            autoFocus
            aria-invalid={Boolean(fields.inspector_initials)}
            aria-describedby={described('inspector_initials')}
            onChange={(e) => set('inspector_initials', e.target.value)}
          />
          {fieldError('inspector_initials')}
        </div>

        <div>
          <label htmlFor="pir-inspector-sign-date" className="input-label">Inspector sign date</label>
          <input
            id="pir-inspector-sign-date"
            type="date"
            className="input-field"
            value={values.inspector_sign_date}
            disabled={busy}
            aria-invalid={Boolean(fields.inspector_sign_date)}
            aria-describedby={described('inspector_sign_date')}
            onChange={(e) => set('inspector_sign_date', e.target.value)}
          />
          {fieldError('inspector_sign_date')}
        </div>

        {general && <p role="alert" className="text-sm text-red-600">{general}</p>}
      </form>
    </Modal>
  )
}
