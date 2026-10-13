import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { changeOwnPassword } from '../services/api'
import Modal from './Modal'
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './CreateUserModal'

const BLANK = { current: '', next: '', confirm: '' }

// One masked password input with a button that shows or hides what was typed
function PasswordField({ id, label, value, onChange, disabled, autoFocus = false, autoComplete, hint = null }) {
  const [shown, setShown] = useState(false)
  const Icon = shown ? EyeOff : Eye
  return (
    <div>
      <label htmlFor={id} className="input-label">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          className="input-field pr-10"
          value={value}
          maxLength={MAX_PASSWORD_LENGTH}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShown(isShown => !isShown)}
          aria-label={`${shown ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
        >
          <Icon className="h-4 w-4" />
        </button>
      </div>
      {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

/**
 * Lets the signed-in user change their own password: the current one, the new one and the new one again, each
 * masked with a show / hide button. Save is off until all three are in, the new one has at least 6 characters,
 * matches its confirmation and differs from the current one. It runs the change itself; a refusal (a wrong current
 * password included) shows inline as the backend worded it and the form keeps what was typed.
 * Props: onClose, onSuccess (called before onClose once the password was changed).
 */
export default function ChangePasswordModal({ onClose, onSuccess }) {
  const [values, setValues] = useState(BLANK)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const { current, next, confirm } = values
  const set = (key) => (value) => setValues(typed => ({ ...typed, [key]: value }))
  const unchanged = Boolean(next) && next === current
  const mismatch = Boolean(confirm) && next !== confirm
  const ready = Boolean(current) && next.length >= MIN_PASSWORD_LENGTH && next === confirm && !unchanged

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busy || !ready) return
    setBusy(true)
    setError(null)
    try {
      await changeOwnPassword({ current_password: current, new_password: next })
    } catch (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    onSuccess?.()
    onClose()
  }

  return (
    <Modal
      title="Change Password"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="change-password-form" disabled={busy || !ready} className="btn-primary">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <PasswordField
          id="change-password-current"
          label="Current password"
          value={current}
          onChange={set('current')}
          disabled={busy}
          autoFocus
          autoComplete="current-password"
        />
        <PasswordField
          id="change-password-new"
          label="New password"
          value={next}
          onChange={set('next')}
          disabled={busy}
          autoComplete="new-password"
          hint={unchanged
            ? 'The new password must differ from the current one.'
            : `At least ${MIN_PASSWORD_LENGTH} characters.`}
        />
        <PasswordField
          id="change-password-confirm"
          label="Confirm new password"
          value={confirm}
          onChange={set('confirm')}
          disabled={busy}
          autoComplete="new-password"
          hint={mismatch ? "The passwords don't match." : null}
        />

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  )
}
