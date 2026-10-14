import { useState } from 'react'
import Modal from './Modal'
import { PROPERTY_TYPES } from '../data/propertyTypes'
import { formErrors } from '../lib/formErrors'

// The longest value the backend takes for each text field
export const MAX_BBL_LENGTH = 32
export const MAX_ADDRESS_LENGTH = 200
export const MAX_NOTES_LENGTH = 2000

export const BBL_TAKEN = 'A property with this BBL already exists in this project.'

const KEYS = ['bbl', 'address', 'property_type', 'notes']
const REQUIRED = ['bbl', 'address', 'property_type']

// What the form starts with: the property being edited, or nothing
const startingValues = (initial) => Object.fromEntries(KEYS.map(key => [key, initial?.[key] ?? '']))

// The values as they are sent: text trimmed, blank notes as null
const cleaned = (values) => ({
  bbl: values.bbl.trim(),
  address: values.address.trim(),
  property_type: values.property_type,
  notes: values.notes.trim() || null,
})

/**
 * Lets an admin add a property to a project, or edit one: BBL, address and property type (required) and notes
 * (optional). Save is off until the three required fields are in and, when editing, until something has changed.
 * Adding passes on all four; editing only what changed. Text is trimmed and blank notes are null. The caller runs
 * the save: it sets busy while it works and error (the thrown error) if it failed, and the form keeps what was
 * typed. A 409 reads above the BBL field, a 422's messages under the fields they name.
 * Props: mode ('add' | 'edit'), initial (the property being edited; none when adding), onSave(values), onCancel,
 * busy, error.
 */
export default function PropertyFormModal({ mode = 'add', initial, onSave, onCancel, busy = false, error = null }) {
  const [values, setValues] = useState(() => startingValues(initial))

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const adding = mode === 'add'
  const sending = cleaned(values)
  const before = cleaned(startingValues(initial))
  const changes = Object.fromEntries(KEYS.filter(key => sending[key] !== before[key]).map(key => [key, sending[key]]))
  const ready = REQUIRED.every(key => Boolean(sending[key])) && (adding || Object.keys(changes).length > 0)
  const { fields, general } = formErrors(error, KEYS, { field: 'bbl', message: BBL_TAKEN })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !ready) return
    onSave(adding ? sending : changes)
  }

  const fieldError = (key) => fields[key] && (
    <p id={`property-${key}-error`} role="alert" className="text-sm text-red-600 mt-1">{fields[key]}</p>
  )

  return (
    <Modal
      title={adding ? 'Add property' : 'Edit property'}
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="property-form" disabled={busy || !ready} className="btn-primary">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="property-form" onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4">
        <div>
          {fields.bbl && (
            <p id="property-bbl-error" role="alert" className="text-sm text-red-600 mb-2">{fields.bbl}</p>
          )}
          <label htmlFor="property-bbl" className="input-label">BBL</label>
          <input
            id="property-bbl"
            type="text"
            className="input-field"
            value={values.bbl}
            maxLength={MAX_BBL_LENGTH}
            disabled={busy}
            autoFocus
            aria-invalid={Boolean(fields.bbl)}
            aria-describedby={fields.bbl ? 'property-bbl-error' : undefined}
            onChange={(e) => set('bbl', e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="property-address" className="input-label">Address</label>
          <input
            id="property-address"
            type="text"
            className="input-field"
            value={values.address}
            maxLength={MAX_ADDRESS_LENGTH}
            disabled={busy}
            aria-invalid={Boolean(fields.address)}
            aria-describedby={fields.address ? 'property-address-error' : undefined}
            onChange={(e) => set('address', e.target.value)}
          />
          {fieldError('address')}
        </div>

        <div>
          <label htmlFor="property-type" className="input-label">Property type</label>
          <select
            id="property-type"
            className="input-field"
            value={values.property_type}
            disabled={busy}
            aria-invalid={Boolean(fields.property_type)}
            aria-describedby={fields.property_type ? 'property-property_type-error' : undefined}
            onChange={(e) => set('property_type', e.target.value)}
          >
            <option value="" disabled>Choose a type</option>
            {PROPERTY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          {fieldError('property_type')}
        </div>

        <div>
          <label htmlFor="property-notes" className="input-label">Notes <span className="text-gray-500 font-normal">(optional)</span></label>
          <textarea
            id="property-notes"
            rows={3}
            className="input-field"
            value={values.notes}
            maxLength={MAX_NOTES_LENGTH}
            disabled={busy}
            aria-invalid={Boolean(fields.notes)}
            aria-describedby={fields.notes ? 'property-notes-error' : undefined}
            onChange={(e) => set('notes', e.target.value)}
          />
          {fieldError('notes')}
        </div>

        {general && <p role="alert" className="text-sm text-red-600">{general}</p>}
      </form>
    </Modal>
  )
}
