import { useId } from 'react'
import { MAX_ATTACHMENT_NAME_LENGTH, MAX_ATTACHMENT_DESCRIPTION_LENGTH } from '../services/attachments'

/**
 * The Name and Description inputs shared by the attachment upload and edit modals; both are required.
 * Props: name, description, onNameChange(value), onDescriptionChange(value), disabled.
 */
export default function AttachmentDetailsFields({ name, description, onNameChange, onDescriptionChange, disabled }) {
  const nameId = useId()
  const descriptionId = useId()

  return (
    <>
      <div className="mb-4">
        <label htmlFor={nameId} className="input-label">Name</label>
        <input
          id={nameId}
          type="text"
          className="input-field"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={MAX_ATTACHMENT_NAME_LENGTH}
          disabled={disabled}
          placeholder="e.g. Crack at north curb"
        />
      </div>
      <div>
        <label htmlFor={descriptionId} className="input-label">Description</label>
        <textarea
          id={descriptionId}
          className="input-field min-h-[100px]"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          maxLength={MAX_ATTACHMENT_DESCRIPTION_LENGTH}
          disabled={disabled}
          placeholder="What does this show, and where?"
        />
      </div>
    </>
  )
}
