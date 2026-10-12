import { useState } from 'react'
import Modal from './Modal'

// The longest name the backend takes
export const MAX_NAME_LENGTH = 100

const FIELDS = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
]

/**
 * Lets an admin change a user's first and last name, both pre-filled. Only the names that changed are passed on,
 * trimmed. A name can't be cleared (the backend has no way to), so emptying one that was set is an inline error
 * and nothing is sent; one that was never set may stay empty. Save is off until something changed. The caller
 * runs the save: it sets busy while it works and error if it failed.
 * Props: user ({email, first_name, last_name}), onSave(changes) (called with {first_name?, last_name?}), onCancel,
 * busy, error.
 */
export default function EditUserModal({ user, onSave, onCancel, busy = false, error = null }) {
  const [names, setNames] = useState({ first_name: user.first_name ?? '', last_name: user.last_name ?? '' })
  const [blank, setBlank] = useState([]) // the keys of the names that were emptied, once Save was tried

  const before = (key) => user[key] ?? ''
  const changed = FIELDS.filter(({ key }) => names[key].trim() !== before(key))

  const handleChange = (key, value) => {
    setNames(current => ({ ...current, [key]: value }))
    setBlank(current => current.filter(other => other !== key))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || changed.length === 0) return
    const emptied = changed.filter(({ key }) => !names[key].trim()).map(({ key }) => key)
    setBlank(emptied)
    if (emptied.length > 0) return
    onSave(Object.fromEntries(changed.map(({ key }) => [key, names[key].trim()])))
  }

  return (
    <Modal
      title="Edit User"
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="edit-user-form" disabled={busy || changed.length === 0} className="btn-primary">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit} noValidate>
        <p className="text-sm text-gray-500 mb-4">{user.email}</p>
        {FIELDS.map(({ key, label }, index) => (
          <div key={key} className={index > 0 ? 'mt-4' : undefined}>
            <label htmlFor={`edit-user-${key}`} className="input-label">{label}</label>
            <input
              id={`edit-user-${key}`}
              type="text"
              className="input-field"
              value={names[key]}
              maxLength={MAX_NAME_LENGTH}
              disabled={busy}
              autoFocus={index === 0}
              aria-invalid={blank.includes(key)}
              onChange={(e) => handleChange(key, e.target.value)}
            />
            {blank.includes(key) && (
              <p role="alert" className="text-sm text-red-600 mt-1">{label} can't be blank.</p>
            )}
          </div>
        ))}
        {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      </form>
    </Modal>
  )
}
