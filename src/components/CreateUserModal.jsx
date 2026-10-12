import { useState } from 'react'
import Modal from './Modal'
import { MAX_NAME_LENGTH } from './EditUserModal'

// What the backend takes: an email of at most 254 characters and a password of 6 characters to 72 bytes
export const MAX_EMAIL_LENGTH = 254
export const MIN_PASSWORD_LENGTH = 6
export const MAX_PASSWORD_LENGTH = 72

const BLANK = { email: '', first_name: '', last_name: '', password: '', is_admin: false }

/**
 * Lets an admin create a user: email, first name, last name (optional), a password and whether they are an admin.
 * The password is shown as typed, since the admin has to pass it on to the user. Save is off until the email, the
 * first name and a password of at least 6 characters are in. The email and names are passed on trimmed, the
 * password as typed. The caller runs the save: it sets busy while it works and error if it failed (a taken email
 * included), and the form keeps what was typed.
 * Props: onCreate(values) (called with {email, first_name, last_name, password, is_admin}), onCancel, busy, error.
 */
export default function CreateUserModal({ onCreate, onCancel, busy = false, error = null }) {
  const [values, setValues] = useState(BLANK)

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const email = values.email.trim()
  const firstName = values.first_name.trim()
  const ready = Boolean(email) && Boolean(firstName) && values.password.length >= MIN_PASSWORD_LENGTH

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !ready) return
    onCreate({ ...values, email, first_name: firstName, last_name: values.last_name.trim() })
  }

  return (
    <Modal
      title="Create User"
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="create-user-form" disabled={busy || !ready} className="btn-primary">
            {busy ? 'Creating...' : 'Create user'}
          </button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit} noValidate autoComplete="off">
        <label htmlFor="create-user-email" className="input-label">Email</label>
        <input
          id="create-user-email"
          type="text"
          inputMode="email"
          className="input-field"
          value={values.email}
          maxLength={MAX_EMAIL_LENGTH}
          disabled={busy}
          autoFocus
          autoComplete="off"
          onChange={(e) => set('email', e.target.value)}
        />

        <div className="mt-4">
          <label htmlFor="create-user-first-name" className="input-label">First name</label>
          <input
            id="create-user-first-name"
            type="text"
            className="input-field"
            value={values.first_name}
            maxLength={MAX_NAME_LENGTH}
            disabled={busy}
            autoComplete="off"
            onChange={(e) => set('first_name', e.target.value)}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="create-user-last-name" className="input-label">Last name (optional)</label>
          <input
            id="create-user-last-name"
            type="text"
            className="input-field"
            value={values.last_name}
            maxLength={MAX_NAME_LENGTH}
            disabled={busy}
            autoComplete="off"
            onChange={(e) => set('last_name', e.target.value)}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="create-user-password" className="input-label">Password</label>
          <input
            id="create-user-password"
            type="text"
            className="input-field"
            value={values.password}
            maxLength={MAX_PASSWORD_LENGTH}
            disabled={busy}
            autoComplete="off"
            aria-describedby="create-user-password-help"
            onChange={(e) => set('password', e.target.value)}
          />
          <p id="create-user-password-help" className="text-sm text-gray-500 mt-2">
            At least {MIN_PASSWORD_LENGTH} characters. Password will be visible, give it to the user securely.
          </p>
        </div>

        <label className="mt-4 inline-flex items-center space-x-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={values.is_admin}
            disabled={busy}
            onChange={(e) => set('is_admin', e.target.checked)}
          />
          <span>Grant admin role</span>
        </label>

        {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      </form>
    </Modal>
  )
}
