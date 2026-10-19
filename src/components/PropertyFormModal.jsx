import { useState } from 'react'
import Modal from './Modal'
import { PROPERTY_TYPES } from '../data/propertyTypes'
import {
  BOROUGHS, MAX_BLOCK_DIGITS, MAX_LOT_DIGITS, QUADRANTS, RAMP_TYPES, propertyKindLabel, withoutLeadingZeros,
} from '../data/propertyKinds'
import { formErrors } from '../lib/formErrors'

// The longest value the backend takes for each text field
export const MAX_ADDRESS_LENGTH = 200
export const MAX_VIOLATION_LENGTH = 200
export const MAX_STREET_LENGTH = 200
export const MAX_COMMUNITY_BOARD_LENGTH = 10
export const MAX_NOTES_LENGTH = 2000

export const BLOCK_LOT_TAKEN = 'A site at this Borough + Block + Lot already exists in this project.'
export const BLOCK_HINT = 'Block number as it appears on the Prior Notice (no leading zeros).'
export const LOT_HINT = 'Lot number (no leading zeros).'
export const BLOCK_INVALID = `A block is 1 to ${MAX_BLOCK_DIGITS} digits.`
export const LOT_INVALID = `A lot is 1 to ${MAX_LOT_DIGITS} digits.`
export const FACING_HINT = 'Fill in both intersection streets to pick the one it faces.'

// Each kind's fields, in form order, and the ones it can't do without
const KEYS = {
  sidewalk: ['boro', 'block', 'lot', 'community_board', 'address', 'violation_no', 'property_type', 'notes'],
  ped_ramp: ['boro', 'community_board', 'intersection_street_1', 'intersection_street_2', 'quadrant', 'facing_street',
    'ramp_type', 'notes'],
}
const OPTIONAL = ['violation_no', 'community_board', 'notes']
// The fields a taken site is: the three together
const LOCATION = { boro: true, block: true, lot: true }
// A sidewalk's block and lot as typed: digits only, at most so many (leading zeros included, as the inputs cap them)
const DIGITS = { block: MAX_BLOCK_DIGITS, lot: MAX_LOT_DIGITS }
const validNumber = (key, text) => new RegExp(`^\\d{1,${DIGITS[key]}}$`).test(text.trim())

// What the form starts with: the property being edited, or nothing
const startingValues = (kind, initial) => Object.fromEntries(KEYS[kind].map(key => [key, initial?.[key] ?? '']))

// The values as they are sent: text trimmed, blank notes, community board or violation number as null, a block and lot without their
// leading zeros
function cleaned(kind, values) {
  const sending = Object.fromEntries(KEYS[kind].map(key => [key, typeof values[key] === 'string' ? values[key].trim() : values[key]]))
  sending.notes = sending.notes || null
  sending.community_board = sending.community_board || null
  if (kind === 'sidewalk') {
    sending.violation_no = sending.violation_no || null
    sending.block = withoutLeadingZeros(sending.block)
    sending.lot = withoutLeadingZeros(sending.lot)
  }
  return sending
}

/**
 * Lets an admin add a site to a project, or edit one, by kind. A sidewalk: borough (chosen, never derived), block
 * (1-5 digits) and lot (1-4 digits), each losing its leading zeros when it loses focus, Community Board (CB,
 * optional, at most 10 characters), address, violation no. (optional) and property type.
 * A ped ramp: borough, Community Board (optional), the two intersection streets, quadrant, the street it faces (offered by name once both
 * streets are in; sent as street_1 / street_2) and ramp type. Both end with notes (optional; blank is null). Editing shows the kind as a fixed line at the top: it
 * can't change. Save is off until every required field is in (and a block and lot are digits) and, when editing, until
 * something has changed. Adding passes on every field and the kind; editing only what changed. The caller runs the
 * save: it sets busy while it works and error (the thrown error) if it failed, and the form keeps what was typed. A
 * 409 reads above the borough, block and lot (the three together are what is taken), a 422's messages under the
 * fields they name, anything else (a 400, such as the
 * backend's "Property kind cannot be changed. Delete and recreate.") below the form.
 * Props: mode ('add' | 'edit'), kind ('sidewalk' | 'ped_ramp'; when editing, the property's), initial (the property
 * being edited; none when adding), onSave(values), onCancel, busy, error.
 */
export default function PropertyFormModal({ mode = 'add', kind: kindProp, initial, onSave, onCancel, busy = false, error = null }) {
  const kind = initial?.kind ?? kindProp ?? 'sidewalk'
  const [values, setValues] = useState(() => startingValues(kind, initial))

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const adding = mode === 'add'
  const sidewalk = kind === 'sidewalk'
  const sending = cleaned(kind, values)
  const before = cleaned(kind, startingValues(kind, initial))
  const changes = Object.fromEntries(KEYS[kind].filter(key => sending[key] !== before[key]).map(key => [key, sending[key]]))
  // A block or lot typed but not a tax map number
  const bad = sidewalk
    ? Object.fromEntries(Object.keys(DIGITS).map(key => [key, values[key].trim() !== '' && !validNumber(key, values[key])]))
    : {}
  const complete = KEYS[kind].every(key => OPTIONAL.includes(key) || Boolean(sending[key]))
  const ready = complete && !bad.block && !bad.lot && (adding || Object.keys(changes).length > 0)
  const { fields, general } = formErrors(error, KEYS[kind], { field: 'location', message: BLOCK_LOT_TAKEN })
  const taken = Boolean(fields.location)
  const bothStreets = Boolean(sending.intersection_street_1 && sending.intersection_street_2)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !ready) return
    onSave(adding ? { kind, ...sending } : changes)
  }

  const describedBy = (key, extra) => [
    fields[key] ? `property-${key}-error` : null, taken && key in LOCATION ? 'property-location-error' : null, extra,
  ].filter(Boolean).join(' ') || undefined
  const fieldError = (key) => fields[key] && (
    <p id={`property-${key}-error`} role="alert" className="text-sm text-red-600 mt-1">{fields[key]}</p>
  )
  const control = (key) => ({
    id: `property-${key}`,
    className: 'input-field',
    value: values[key],
    disabled: busy,
    'aria-invalid': Boolean(fields[key]) || (sidewalk && taken && key in LOCATION),
    'aria-describedby': describedBy(key),
    onChange: (e) => set(key, e.target.value),
  })
  const textField = (key, label, maxLength, { optional = false, autoFocus = false } = {}) => (
    <div>
      <label htmlFor={`property-${key}`} className="input-label">
        {label}{optional && <span className="text-gray-500 font-normal"> (optional)</span>}
      </label>
      <input type="text" maxLength={maxLength} autoFocus={autoFocus} {...control(key)} />
      {fieldError(key)}
    </div>
  )
  const selectField = (key, label, options, { placeholder, ...props } = {}) => (
    <div>
      <label htmlFor={`property-${key}`} className="input-label">{label}</label>
      <select {...control(key)} {...props}>
        <option value="" disabled>{placeholder}</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {fieldError(key)}
    </div>
  )
  // A block or a lot: digits, its leading zeros dropped when it loses focus, its hint turning into the rule when bad
  const numberField = (key, label, hint, invalid) => (
    <div>
      <label htmlFor={`property-${key}`} className="input-label">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        maxLength={DIGITS[key]}
        {...control(key)}
        aria-invalid={Boolean(fields[key]) || taken || bad[key]}
        aria-describedby={describedBy(key, `property-${key}-hint`)}
        onBlur={() => set(key, withoutLeadingZeros(values[key]))}
      />
      <p id={`property-${key}-hint`} className={`text-sm mt-1 ${bad[key] ? 'text-red-600' : 'text-gray-500'}`}>
        {bad[key] ? invalid : hint}
      </p>
      {fieldError(key)}
    </div>
  )
  const boroughs = BOROUGHS.map(name => ({ value: name, label: name }))
  const noun = sidewalk ? 'sidewalk' : 'ped ramp'
  const communityBoard = textField('community_board', 'Community Board (CB)', MAX_COMMUNITY_BOARD_LENGTH, { optional: true })

  return (
    <Modal
      title={`${adding ? 'Add' : 'Edit'} ${noun}`}
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
        {!adding && (
          <p className="text-sm text-gray-500" aria-disabled="true">Site type: {propertyKindLabel(kind)}</p>
        )}

        {sidewalk ? (
          <>
            {taken && (
              <p id="property-location-error" role="alert" className="text-sm text-red-600">{fields.location}</p>
            )}
            {selectField('boro', 'Borough', boroughs, { placeholder: 'Choose a borough', autoFocus: true })}
            {numberField('block', 'Block', BLOCK_HINT, BLOCK_INVALID)}
            {numberField('lot', 'Lot', LOT_HINT, LOT_INVALID)}
            {communityBoard}

            {textField('address', 'Address', MAX_ADDRESS_LENGTH)}
            {textField('violation_no', 'Violation No.', MAX_VIOLATION_LENGTH, { optional: true })}
            {selectField('property_type', 'Property type', PROPERTY_TYPES, { placeholder: 'Choose a type' })}
          </>
        ) : (
          <>
            {selectField('boro', 'Borough', boroughs, { placeholder: 'Choose a borough', autoFocus: true })}
            {communityBoard}
            {textField('intersection_street_1', 'Intersection 1st Street', MAX_STREET_LENGTH)}
            {textField('intersection_street_2', 'Intersection 2nd Street', MAX_STREET_LENGTH)}
            {selectField('quadrant', 'Quadrant', QUADRANTS.map(name => ({ value: name, label: name })), { placeholder: 'Choose a quadrant' })}
            {selectField('facing_street', 'Facing', bothStreets ? [
              { value: 'street_1', label: sending.intersection_street_1 },
              { value: 'street_2', label: sending.intersection_street_2 },
            ] : [], {
              placeholder: bothStreets ? 'Choose a street' : FACING_HINT,
              value: bothStreets ? values.facing_street : '',
              disabled: busy || !bothStreets,
            })}
            {selectField('ramp_type', 'Type', RAMP_TYPES, { placeholder: 'Choose a type' })}
          </>
        )}

        <div>
          <label htmlFor="property-notes" className="input-label">Notes <span className="text-gray-500 font-normal">(optional)</span></label>
          <textarea rows={3} maxLength={MAX_NOTES_LENGTH} {...control('notes')} />
          {fieldError('notes')}
        </div>

        {general && <p role="alert" className="text-sm text-red-600">{general}</p>}
      </form>
    </Modal>
  )
}
