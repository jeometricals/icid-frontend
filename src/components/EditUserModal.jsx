import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import Modal from './Modal'

// The longest name and email the backend takes
export const MAX_NAME_LENGTH = 100
export const MAX_EMAIL_LENGTH = 254

export const OWN_ADMIN_ROLE_TOOLTIP = 'You cannot change your own admin role.'

// The text fields, top to bottom. Only a name that was never set may be left empty.
const FIELDS = [
  { key: 'first_name', label: 'First name', maxLength: MAX_NAME_LENGTH },
  { key: 'last_name', label: 'Last name', maxLength: MAX_NAME_LENGTH },
  { key: 'email', label: 'Email', maxLength: MAX_EMAIL_LENGTH, inputMode: 'email' },
]

/**
 * Lets an admin change a user: first and last name, email, whether they are an admin and, for a demo user only,
 * whether to make them a real one. Everything is pre-filled. Only what changed is passed on, the text trimmed.
 * A name or the email can't be cleared (the backend has no way to), so emptying one that was set is an inline error
 * and nothing is sent; a name that was never set may stay empty. Save is off until something changed. A change of
 * email, of the admin role, or a promotion from demo is confirmed first, in a dialog that lists each one and takes
 * the form's place; cancelling it returns to the form as it was. The admin's own admin box is off, with a tooltip:
 * the backend won't let an admin take their own role away. The caller runs the save: it sets busy while it works
 * and error if it failed.
 * Props: user ({email, first_name, last_name, role, is_demo}), isSelf (the user is the signed-in admin),
 * onSave(changes) (called with any of {first_name, last_name, email, is_admin, is_demo: false}), onCancel, busy,
 * error.
 */
export default function EditUserModal({ user, isSelf = false, onSave, onCancel, busy = false, error = null }) {
  const wasAdmin = user.role === 'admin'
  const [text, setText] = useState({
    first_name: user.first_name ?? '', last_name: user.last_name ?? '', email: user.email ?? '',
  })
  const [admin, setAdmin] = useState(wasAdmin)
  const [promote, setPromote] = useState(false)
  const [blank, setBlank] = useState([]) // the keys of the fields that were emptied, once Save was tried
  const [confirming, setConfirming] = useState(false)

  const before = (key) => user[key] ?? ''
  const changedText = FIELDS.filter(({ key }) => text[key].trim() !== before(key))
  const adminChanged = !isSelf && admin !== wasAdmin
  const promoting = Boolean(user.is_demo) && promote

  const changes = {
    ...Object.fromEntries(changedText.map(({ key }) => [key, text[key].trim()])),
    ...(adminChanged ? { is_admin: admin } : {}),
    ...(promoting ? { is_demo: false } : {}),
  }
  const changed = Object.keys(changes).length > 0

  // What the confirm dialog asks about, one line per sensitive change
  const sensitive = [
    'email' in changes
      && `Change email from ${user.email} to ${changes.email}? The user will need to sign in with the new email.`,
    adminChanged && (admin ? `Grant admin role to ${user.email}?` : `Revoke admin role from ${user.email}?`),
    promoting && `Promote ${user.email} from demo to real user? This stops the demo-cleanup from touching their data.`,
  ].filter(Boolean)

  const handleChange = (key, value) => {
    setText(current => ({ ...current, [key]: value }))
    setBlank(current => current.filter(other => other !== key))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !changed) return
    const emptied = changedText.filter(({ key }) => !text[key].trim()).map(({ key }) => key)
    setBlank(emptied)
    if (emptied.length > 0) return
    if (sensitive.length > 0) setConfirming(true)
    else onSave(changes)
  }

  if (confirming) {
    return (
      <ConfirmDialog
        title="Save changes?"
        message={`Please confirm ${sensitive.length === 1 ? 'this change' : 'these changes'}:`}
        items={sensitive}
        confirmLabel="Save changes"
        cancelLabel="Cancel"
        confirmClassName="btn-primary"
        onConfirm={() => {
          setConfirming(false)
          onSave(changes)
        }}
        onCancel={() => setConfirming(false)}
      />
    )
  }

  return (
    <Modal
      title="Edit User"
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="edit-user-form" disabled={busy || !changed} className="btn-primary">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit} noValidate autoComplete="off">
        {FIELDS.map(({ key, label, maxLength, inputMode }, index) => (
          <div key={key} className={index > 0 ? 'mt-4' : undefined}>
            <label htmlFor={`edit-user-${key}`} className="input-label">{label}</label>
            <input
              id={`edit-user-${key}`}
              type="text"
              inputMode={inputMode}
              className="input-field"
              value={text[key]}
              maxLength={maxLength}
              disabled={busy}
              autoFocus={index === 0}
              autoComplete="off"
              aria-invalid={blank.includes(key)}
              onChange={(e) => handleChange(key, e.target.value)}
            />
            {blank.includes(key) && (
              <p role="alert" className="text-sm text-red-600 mt-1">{label} can't be blank.</p>
            )}
          </div>
        ))}

        <div className="mt-4 flex flex-col items-start gap-2 text-sm text-gray-700">
          <label
            title={isSelf ? OWN_ADMIN_ROLE_TOOLTIP : undefined}
            className={`inline-flex items-center space-x-2 ${isSelf ? 'text-gray-400 cursor-not-allowed' : ''}`}
          >
            <input
              type="checkbox"
              checked={admin}
              disabled={busy || isSelf}
              title={isSelf ? OWN_ADMIN_ROLE_TOOLTIP : undefined}
              onChange={(e) => setAdmin(e.target.checked)}
            />
            <span>Grant admin role</span>
          </label>
          {user.is_demo && (
            <label className="inline-flex items-center space-x-2">
              <input
                type="checkbox"
                checked={promote}
                disabled={busy}
                onChange={(e) => setPromote(e.target.checked)}
              />
              <span>Promote to real user</span>
            </label>
          )}
        </div>

        {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      </form>
    </Modal>
  )
}
