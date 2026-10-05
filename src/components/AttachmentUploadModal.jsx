import { useId, useState } from 'react'
import Modal from './Modal'
import AttachmentDetailsFields from './AttachmentDetailsFields'
import {
  ALLOWED_MIME_TYPES,
  StorageUnavailableError,
  uploadAttachment,
  validateFileForUpload,
} from '../services/attachments'

// What the spinner says during each uploadAttachment step
const STEP_LABELS = {
  requesting: 'Preparing upload...',
  uploading: 'Uploading file...',
  completing: 'Finishing up...',
  done: 'Finishing up...',
}

/**
 * Modal for attaching a file to a report: file chooser plus the required name and description.
 * Checks the file as soon as it is picked; stays open with a spinner while uploading and with the error if it fails.
 * Props: idrId, reportId, onUploaded(attachment), onClose.
 */
export default function AttachmentUploadModal({ idrId, reportId, onUploaded, onClose }) {
  const fileInputId = useId()
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [step, setStep] = useState(null) // the running upload step, null when idle
  const [uploadError, setUploadError] = useState(null) // { message, canRetry }

  const busy = step !== null
  const canSave = !busy && file && !fileError && name.trim() && description.trim()

  const handleFileChange = (e) => {
    const chosen = e.target.files[0] ?? null
    setFile(chosen)
    setFileError(chosen ? validateFileForUpload(chosen)?.message ?? null : null)
    setUploadError(null)
  }

  const handleUpload = async () => {
    setUploadError(null)
    setStep('requesting')
    try {
      const attachment = await uploadAttachment(idrId, reportId, {
        file,
        name,
        description,
        onProgress: ({ step: current }) => setStep(current),
      })
      onUploaded(attachment)
    } catch (err) {
      setStep(null)
      setUploadError(err instanceof StorageUnavailableError
        ? { message: 'Storage temporarily unavailable, try again.', canRetry: true }
        : { message: err.message, canRetry: false })
    }
  }

  return (
    <Modal
      title="Add attachment"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleUpload} disabled={!canSave} className="btn-primary">
            {busy ? 'Uploading...' : uploadError?.canRetry ? 'Retry' : 'Save'}
          </button>
        </>
      }
    >
      <div className="mb-4">
        <label htmlFor={fileInputId} className="input-label">File</label>
        <input
          id={fileInputId}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(',')}
          onChange={handleFileChange}
          disabled={busy}
          className="block w-full text-sm text-gray-700 file:mr-3 file:px-4 file:py-2 file:rounded-md file:border-0 file:bg-gray-200 file:text-gray-700 file:font-medium hover:file:bg-gray-300"
        />
        <p className="text-xs text-gray-500 mt-1">JPEG, PNG, GIF, WebP, HEIC or PDF, up to 10 MB.</p>
        {fileError && <p role="alert" className="text-sm text-red-600 mt-1">{fileError}</p>}
      </div>

      <AttachmentDetailsFields
        name={name}
        description={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        disabled={busy}
      />

      {busy && (
        <div className="flex items-center space-x-2 mt-4 text-sm text-gray-600">
          <div role="status" className="animate-spin rounded-full h-4 w-4 border-b-2 border-construction-600"></div>
          <span>{STEP_LABELS[step]}</span>
        </div>
      )}
      {uploadError && <p role="alert" className="text-sm text-red-600 mt-4">{uploadError.message}</p>}
    </Modal>
  )
}
