import { useState } from 'react'
import Modal from './Modal'
import { formErrors } from '../lib/formErrors'

// The longest value the backend takes for each text field
export const MAX_NUMBER_LENGTH = 50
export const MAX_ESTIMATE_NOTES_LENGTH = 2000

export const NUMBER_TAKEN = 'A task order with this number already exists in this project.'
export const ESTIMATE_PLACEHOLDER = 'Rough bid estimate — 4" SF, 7" SF, curb LF'

const KEYS = ['task_order_number', 'issued_date', 'estimate_notes']

// What the form starts with: the task order being edited, or nothing
const startingValues = (initial) => Object.fromEntries(KEYS.map(key => [key, initial?.[key] ?? '']))

// The values as they are sent: text trimmed, a blank date or blank notes as null
const cleaned = (values) => ({
  task_order_number: values.task_order_number.trim(),
  issued_date: values.issued_date || null,
  estimate_notes: values.estimate_notes.trim() || null,
})

/**
 * Lets an admin add a task order to a project, or edit one: number (required), issued date and estimate notes
 * (both optional). Save is off until the number is in and, when editing, until something has changed. Adding
 * passes on all three; editing only what changed. Text is trimmed; a blank date or blank notes are null, which
 * clears them. The caller runs the save: it sets busy while it works and error (the thrown error) if it failed,
 * and the form keeps what was typed. A 409 (the number is taken) reads under the Number field, a 422's messages
 * under the fields they name.
 * Props: mode ('add' | 'edit'), initial (the task order being edited; none when adding), onSave(values),
 * onCancel, busy, error.
 */
export default function TaskOrderFormModal({ mode = 'add', initial, onSave, onCancel, busy = false, error = null }) {
  const [values, setValues] = useState(() => startingValues(initial))

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const adding = mode === 'add'
  const sending = cleaned(values)
  const before = cleaned(startingValues(initial))
  const changes = Object.fromEntries(KEYS.filter(key => sending[key] !== before[key]).map(key => [key, sending[key]]))
  const ready = Boolean(sending.task_order_number) && (adding || Object.keys(changes).length > 0)
  const { fields, general } = formErrors(error, KEYS, { field: 'task_order_number', message: NUMBER_TAKEN })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !ready) return
    onSave(adding ? sending : changes)
  }

  const fieldError = (key) => fields[key] && (
    <p id={`task-order-${key}-error`} role="alert" className="text-sm text-red-600 mt-1">{fields[key]}</p>
  )
  const described = (key) => (fields[key] ? `task-order-${key}-error` : undefined)

  return (
    <Modal
      title={adding ? 'Add task order' : 'Edit task order'}
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="task-order-form" disabled={busy || !ready} className="btn-primary">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="task-order-form" onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4">
        <div>
          <label htmlFor="task-order-number" className="input-label">Number</label>
          <input
            id="task-order-number"
            type="text"
            className="input-field"
            value={values.task_order_number}
            maxLength={MAX_NUMBER_LENGTH}
            disabled={busy}
            autoFocus
            aria-invalid={Boolean(fields.task_order_number)}
            aria-describedby={described('task_order_number')}
            onChange={(e) => set('task_order_number', e.target.value)}
          />
          {fieldError('task_order_number')}
        </div>

        <div>
          <label htmlFor="task-order-issued-date" className="input-label">
            Issued date <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          <input
            id="task-order-issued-date"
            type="date"
            className="input-field"
            value={values.issued_date}
            disabled={busy}
            aria-invalid={Boolean(fields.issued_date)}
            aria-describedby={described('issued_date')}
            onChange={(e) => set('issued_date', e.target.value)}
          />
          {fieldError('issued_date')}
        </div>

        <div>
          <label htmlFor="task-order-estimate-notes" className="input-label">
            Estimate notes <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          <textarea
            id="task-order-estimate-notes"
            rows={3}
            className="input-field"
            value={values.estimate_notes}
            maxLength={MAX_ESTIMATE_NOTES_LENGTH}
            placeholder={ESTIMATE_PLACEHOLDER}
            disabled={busy}
            aria-invalid={Boolean(fields.estimate_notes)}
            aria-describedby={described('estimate_notes')}
            onChange={(e) => set('estimate_notes', e.target.value)}
          />
          {fieldError('estimate_notes')}
        </div>

        {general && <p role="alert" className="text-sm text-red-600">{general}</p>}
      </form>
    </Modal>
  )
}
