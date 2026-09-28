import { useState } from 'react'
import Modal from './Modal'
import AttachmentDetailsFields from './AttachmentDetailsFields'
import { updateAttachmentMetadata } from '../services/attachments'

/**
 * Modal for renaming an attachment or changing its description; the file itself can't be replaced.
 * Stays open with the error if the save fails.
 * Props: idrId, reportId, attachment (the one being edited), onSaved(updatedAttachment), onClose.
 */
export default function AttachmentEditModal({ idrId, reportId, attachment, onSaved, onClose }) {
  const [name, setName] = useState(attachment.attachment_name)
  const [description, setDescription] = useState(attachment.attachment_description)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const canSave = !saving && name.trim() && description.trim()

  const handleSave = async () => {
    setSaveError(null)
    setSaving(true)
    try {
      const updated = await updateAttachmentMetadata(idrId, reportId, attachment.attachment_id, { name, description })
      onSaved(updated)
    } catch (err) {
      setSaving(false)
      setSaveError(err.message)
    }
  }

  return (
    <Modal
      title="Edit attachment"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={!canSave} className="btn-primary">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-500 mb-4 truncate" title={attachment.file_name}>File: {attachment.file_name}</p>
      <AttachmentDetailsFields
        name={name}
        description={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        disabled={saving}
      />
      {saveError && <p role="alert" className="text-sm text-red-600 mt-4">{saveError}</p>}
    </Modal>
  )
}
