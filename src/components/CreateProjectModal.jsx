import { useState } from 'react'
import Modal from './Modal'

// The longest value the backend takes for each field
export const MAX_PROJECT_ID_LENGTH = 32
export const MAX_PROJECT_NAME_LENGTH = 100
export const MAX_DESCRIPTION_LENGTH = 200
export const MAX_BOROUGH_LENGTH = 50
export const MAX_REGISTRATION_CODE_LENGTH = 50

const BLANK = { project_id: '', project_name: '', project_description: '', borough: '', registration_code: '' }

// The fields, top to bottom
const FIELDS = [
  { key: 'project_id', label: 'Project ID', maxLength: MAX_PROJECT_ID_LENGTH, required: true,
    help: 'Letters, digits, hyphens and underscores only.' },
  { key: 'project_name', label: 'Project name', maxLength: MAX_PROJECT_NAME_LENGTH, required: true },
  { key: 'project_description', label: 'Description', maxLength: MAX_DESCRIPTION_LENGTH, required: true },
  { key: 'borough', label: 'Borough', maxLength: MAX_BOROUGH_LENGTH, required: true },
  { key: 'registration_code', label: 'Registration code (optional)', maxLength: MAX_REGISTRATION_CODE_LENGTH },
]

/**
 * Lets an admin create a project: project ID, name, description, borough and a registration code (optional).
 * Save is off until every field but the registration code is in. The values are passed on trimmed. The caller
 * runs the save: it sets busy while it works and error if it failed (a taken project ID included), and the form
 * keeps what was typed.
 * Props: onCreate(values) (called with {project_id, project_name, project_description, borough,
 * registration_code}), onCancel, busy, error.
 */
export default function CreateProjectModal({ onCreate, onCancel, busy = false, error = null }) {
  const [values, setValues] = useState(BLANK)

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const trimmed = Object.fromEntries(FIELDS.map(({ key }) => [key, values[key].trim()]))
  const ready = FIELDS.every(({ key, required }) => !required || Boolean(trimmed[key]))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !ready) return
    onCreate(trimmed)
  }

  return (
    <Modal
      title="Create Project"
      onClose={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="create-project-form" disabled={busy || !ready} className="btn-primary">
            {busy ? 'Creating...' : 'Create project'}
          </button>
        </>
      }
    >
      <form id="create-project-form" onSubmit={handleSubmit} noValidate autoComplete="off">
        {FIELDS.map(({ key, label, maxLength, help }, index) => (
          <div key={key} className={index > 0 ? 'mt-4' : undefined}>
            <label htmlFor={`create-project-${key}`} className="input-label">{label}</label>
            <input
              id={`create-project-${key}`}
              type="text"
              className="input-field"
              value={values[key]}
              maxLength={maxLength}
              disabled={busy}
              autoFocus={index === 0}
              autoComplete="off"
              aria-describedby={help ? `create-project-${key}-help` : undefined}
              onChange={(e) => set(key, e.target.value)}
            />
            {help && <p id={`create-project-${key}-help`} className="text-sm text-gray-500 mt-2">{help}</p>}
          </div>
        ))}

        {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      </form>
    </Modal>
  )
}
