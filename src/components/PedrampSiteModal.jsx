import { useState } from 'react'
import Modal from './Modal'
import FoldingPanel from './FoldingPanel'
import { BOROUGHS, QUADRANTS, RAMP_TYPES } from '../data/propertyKinds'
import {
  CORNER_COMMENTS_MAX, RAMP_LABEL_MAX, SITE_CORNER_REQUIRED, SITE_CORNER_SECTIONS, SITE_RAMP_REQUIRED, SITE_RAMP_TITLE,
} from '../data/pedRampForm'
import { MAX_NOTES_LENGTH } from './PropertyFormModal'
import { formErrors } from '../lib/formErrors'

const CORNER_FIELDS = SITE_CORNER_SECTIONS.flatMap(section => section.fields)
const CORNER_KEYS = [...CORNER_FIELDS.map(([key]) => key), 'comments']
const PROPERTY_KEYS = ['quadrant', 'facing_street', 'ramp_type', 'notes'] // the ramp's own, on its property
const RAMP_KEYS = [...PROPERTY_KEYS, 'ramp_id_label']
const KEYS = [...CORNER_KEYS, ...RAMP_KEYS]
const TYPES = Object.fromEntries(CORNER_FIELDS.map(([key, , type]) => [key, type]))
const REQUIRED = [...SITE_CORNER_REQUIRED, ...SITE_RAMP_REQUIRED]
const FACING_HINT = 'Fill in both streets in section A to pick the one it faces.'

// A stored value as the form holds it: text, '' for none, 'true' / 'false' for a yes or no
const shown = (value) => (value === null || value === undefined ? '' : String(value))

// What the form sends for a field: text trimmed, '' as null, a yes or no as a boolean, the ramp count as a number
function sent(key, text) {
  const value = text.trim()
  if (value === '') return null
  if (TYPES[key] === 'yesno') return value === 'true'
  if (TYPES[key] === 'ramps') return Number(value)
  return value
}

const startingValues = (corner, ramp) => Object.fromEntries([
  ...CORNER_KEYS.map(key => [key, shown(corner?.[key])]),
  ...RAMP_KEYS.map(key => [key, shown(ramp?.[key])]),
])
const cleaned = (values) => Object.fromEntries(KEYS.map(key => [key, sent(key, values[key])]))
const pick = (values, keys) => Object.fromEntries(keys.map(key => [key, values[key]]))
const changed = (now, before, keys) => Object.fromEntries(keys.filter(key => now[key] !== before[key]).map(key => [key, now[key]]))

const TITLES = { add: 'Add Pedramp', 'add-ramp': 'Add another ramp at this corner', edit: 'Edit Pedramp' }

/**
 * The one dialog for a ped ramp site (Slice R): a corner and one ramp at it, in four sections that fold. A. Location &
 * Corner, B. Construction info and C. Inspection are the corner's (the DOT form's sections 1-3, regrouped; C ends with
 * the corner's comments); D. This Ramp is the ramp's: quadrant, the street it faces (offered by the names typed in A,
 * sent as street_1 = the north-south street, street_2 = the east-west), ramp type, Ramp ID (ramp_id_label) and notes.
 * Required: borough, both streets, corner direction, quadrant, facing street and ramp type.
 * mode 'add': every section open and empty; Save hands over every field, flat (for createPedrampSite).
 * mode 'add-ramp': the corner given fills A-C, locked and folded; only D is filled in; Save hands over every field, flat.
 * mode 'edit': the corner and the ramp given fill every section, all open, one scrolling page; A-C apply to the corner
 * and so to all its ramps (said above them when it has more than one); Save hands over {corner, ramp, label}, each the
 * changes to that part only (empty when none), label the new Ramp ID or undefined when it didn't change.
 * Save is off until the required fields are in and, when editing, something changed. The caller runs the save: busy
 * while it works, error (the thrown error) when it failed; a 422's messages read under the fields they name.
 * Props: mode, corner (its fields; for add-ramp and edit), ramp ({quadrant, facing_street, ramp_type, notes,
 * ramp_id_label}; for edit), onSave(values), onCancel, busy, error.
 */
export default function PedrampSiteModal({ mode = 'add', corner, ramp, onSave, onCancel, busy = false, error = null }) {
  const [values, setValues] = useState(() => startingValues(corner, ramp))
  const editing = mode === 'edit'
  const locked = mode === 'add-ramp' // the corner's sections can't be changed
  const sending = cleaned(values)
  const before = cleaned(startingValues(corner, ramp))
  const cornerChanges = changed(sending, before, CORNER_KEYS)
  const rampChanges = changed(sending, before, PROPERTY_KEYS)
  const labelChanged = sending.ramp_id_label !== before.ramp_id_label
  const anyChange = Object.keys(cornerChanges).length > 0 || Object.keys(rampChanges).length > 0 || labelChanged
  const complete = REQUIRED.every(key => sending[key] !== null)
  const ready = complete && (!editing || anyChange)
  const { fields, general } = formErrors(error, KEYS, {})
  const bothStreets = Boolean(sending.north_south_street && sending.east_west_street)
  const rampCount = corner?.ramps?.length ?? 0

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !ready) return
    if (editing) {
      onSave({ corner: cornerChanges, ramp: rampChanges, label: labelChanged ? sending.ramp_id_label : undefined })
    } else {
      onSave({ ...pick(sending, CORNER_KEYS), ...pick(sending, RAMP_KEYS) })
    }
  }

  const control = (key, { lockable = false } = {}) => ({
    id: `site-${key}`,
    className: 'input-field',
    value: values[key],
    disabled: busy || (lockable && locked),
    'aria-invalid': Boolean(fields[key]),
    'aria-describedby': fields[key] ? `site-${key}-error` : undefined,
    onChange: (e) => set(key, e.target.value),
  })
  const choice = (key, choices, { lockable = false, placeholder } = {}) => (
    <select {...control(key, { lockable })}>
      <option value="" disabled={REQUIRED.includes(key)}>{placeholder ?? (REQUIRED.includes(key) ? 'Choose…' : '—')}</option>
      {choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
  const cornerInput = (key, type, extra) => {
    const lockable = { lockable: true }
    if (type === 'boro') return choice(key, BOROUGHS.map(name => ({ value: name, label: name })), lockable)
    if (type === 'select') return choice(key, extra, lockable)
    if (type === 'yesno') return choice(key, [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], lockable)
    if (type === 'ramps') return choice(key, [1, 2, 3].map(n => ({ value: String(n), label: String(n) })), lockable)
    if (type === 'date') return <input type="date" {...control(key, lockable)} />
    return <input type="text" maxLength={extra} {...control(key, lockable)} />
  }
  const field = (key, label, input) => (
    <div key={key}>
      <label htmlFor={`site-${key}`} className="input-label">
        {label}
        {!REQUIRED.includes(key) && <span className="text-gray-500 font-normal"> (optional)</span>}
      </label>
      {input}
      {fields[key] && <p id={`site-${key}-error`} role="alert" className="text-sm text-red-600 mt-1">{fields[key]}</p>}
    </div>
  )
  const panel = 'border border-gray-200 rounded-md p-4'

  return (
    <Modal
      title={TITLES[mode]}
      onClose={onCancel}
      busy={busy}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="site-form" disabled={busy || !ready} className="btn-primary">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="site-form" onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4">
        {locked && (
          <p className="text-sm text-gray-600">
            Sections A to C are this corner's and can't be changed here; fill in the new ramp in section D.
          </p>
        )}
        {editing && rampCount > 1 && (
          <p className="text-sm text-gray-600">
            Sections A to C are the corner's: changes there apply to all {rampCount} ramps at it. Section D is this ramp's alone.
          </p>
        )}

        {SITE_CORNER_SECTIONS.map(section => (
          <FoldingPanel key={section.id} title={section.title} defaultOpen={!locked} className={panel}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              {section.fields.map(([key, label, type, extra]) => field(key, label, cornerInput(key, type, extra)))}
              {section.id === 'inspection' && (
                <div className="sm:col-span-2">
                  {field('comments', 'Corner comments', (
                    <textarea rows={3} maxLength={CORNER_COMMENTS_MAX} {...control('comments', { lockable: true })} />
                  ))}
                </div>
              )}
            </div>
          </FoldingPanel>
        ))}

        <FoldingPanel title={SITE_RAMP_TITLE} className={panel}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            {field('quadrant', 'Quadrant', choice('quadrant', QUADRANTS.map(name => ({ value: name, label: name }))))}
            {field('facing_street', 'Facing street', (
              <select
                {...control('facing_street')}
                value={bothStreets ? values.facing_street : ''}
                disabled={busy || !bothStreets}
              >
                <option value="" disabled>{bothStreets ? 'Choose…' : FACING_HINT}</option>
                {bothStreets && (
                  <>
                    <option value="street_1">{sending.north_south_street}</option>
                    <option value="street_2">{sending.east_west_street}</option>
                  </>
                )}
              </select>
            ))}
            {field('ramp_type', 'Ramp type', choice('ramp_type', RAMP_TYPES))}
            {field('ramp_id_label', 'Ramp ID', (
              <input type="text" maxLength={RAMP_LABEL_MAX} placeholder="e.g. CT-A" {...control('ramp_id_label')} />
            ))}
            <div className="sm:col-span-2">
              {field('notes', 'Notes', <textarea rows={3} maxLength={MAX_NOTES_LENGTH} {...control('notes')} />)}
            </div>
          </div>
        </FoldingPanel>

        {general && <p role="alert" className="text-sm text-red-600">{general}</p>}
      </form>
    </Modal>
  )
}
