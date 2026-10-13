import { useState } from 'react'
import { resetUserPassword } from '../services/api'
import Modal from './Modal'
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './CreateUserModal'

/**
 * Lets an admin give a user a new password. The password is shown as typed, since the admin has to pass it on to
 * the user. Save is off until it has at least 6 characters. It runs the reset itself; a refusal shows inline as the
 * backend worded it and the form keeps what was typed.
 * Props: user ({uuid, email}), onClose, onSuccess(user) (called before onClose once the password was reset).
 */
export default function AdminResetPasswordModal({ user, onClose, onSuccess }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const ready = password.length >= MIN_PASSWORD_LENGTH

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busy || !ready) return
    setBusy(true)
    setError(null)
    try {
      await resetUserPassword(user.uuid, { new_password: password })
    } catch (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    onSuccess?.(user)
    onClose()
  }

  return (
    <Modal
      title="Reset Password"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="reset-password-form" disabled={busy || !ready} className="btn-primary">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={handleSubmit} noValidate autoComplete="off">
        <p className="text-sm text-gray-500 mb-4">{user.email}</p>
        <label htmlFor="reset-password-new" className="input-label">New password</label>
        <input
          id="reset-password-new"
          type="text"
          className="input-field"
          value={password}
          maxLength={MAX_PASSWORD_LENGTH}
          disabled={busy}
          autoFocus
          autoComplete="off"
          aria-describedby="reset-password-help"
          onChange={(e) => setPassword(e.target.value)}
        />
        <p id="reset-password-help" className="text-sm text-gray-500 mt-2">
          At least {MIN_PASSWORD_LENGTH} characters. Password will be visible, share with the user securely.
        </p>

        {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      </form>
    </Modal>
  )
}
