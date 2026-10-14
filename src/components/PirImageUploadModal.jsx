import { useEffect, useState } from 'react'
import Modal from './Modal'
import {
  DEFAULT_PIR_IMAGE_SCALE, PIR_IMAGE_ACCEPT, pirImageTypeOf, uploadPirImage, validatePirImageFile,
} from '../services/pirImages'

// What the spinner says during each upload step
export const STEP_LABELS = {
  requesting: 'Preparing upload...',
  uploading: 'Uploading file...',
  completing: 'Converting and saving...',
}

export const PDF_NOTE = 'PDF will be converted to PNG on upload.'
export const TOO_LARGE = 'The file is too large: a PIR image is 10 MB at most.'

// "1.2 MB", "340 KB": a file's size as the dialog shows it
export function fileSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// A scale as typed is usable when it is a finite number of at least 1 px/ft
const scaleOf = (typed) => (typed.trim() !== '' && Number.isFinite(Number(typed)) && Number(typed) >= 1 ? Number(typed) : null)

/**
 * Uploads a PIR's image, or replaces it: a file (PDF, PNG or JPG, 10 MB at most), shown by name and size, and the
 * scale in pixels per foot (15 to start, at least 1). A picked image is previewed from the file itself; a PDF
 * gets a note that it is converted to PNG on upload. Upload is off until there is a file that fits and a scale.
 * Runs the upload itself (upload-request, the PUT to Storage, complete), with a spinner naming the step; a refusal
 * shows inline (a 413 as the size limit, anything else as the backend or Storage worded it) and the form keeps the
 * file and scale.
 * Props: pirId, replacing (the PIR has an image already: the title says Replace), initialScale, onUploaded(pir)
 * (the PIR as complete returned it), onClose.
 */
export default function PirImageUploadModal({ pirId, replacing = false, initialScale, onUploaded, onClose }) {
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [scale, setScale] = useState(String(initialScale ?? DEFAULT_PIR_IMAGE_SCALE))
  const [preview, setPreview] = useState(null) // an object URL for a picked image
  const [step, setStep] = useState(null) // the running upload step, null when idle
  const [error, setError] = useState(null)

  const busy = step !== null
  const isPdf = file && pirImageTypeOf(file) === 'application/pdf'
  const ready = Boolean(file) && !fileError && scaleOf(scale) !== null

  // A picked image is previewed from the file; the URL is let go when the file changes or the dialog closes
  useEffect(() => {
    if (!file || isPdf || fileError || typeof URL.createObjectURL !== 'function') {
      setPreview(null)
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL?.(url)
  }, [file, isPdf, fileError])

  const pick = (e) => {
    const picked = e.target.files?.[0] ?? null
    setFile(picked)
    setFileError(picked ? validatePirImageFile(picked) : null)
    setError(null)
  }

  const upload = async () => {
    if (busy || !ready) return
    setError(null)
    try {
      const pir = await uploadPirImage(pirId, file, scaleOf(scale), { onProgress: ({ step: current }) => setStep(current) })
      setStep(null)
      onUploaded(pir)
    } catch (err) {
      setStep(null)
      setError(err.status === 413 ? TOO_LARGE : err.message)
    }
  }

  return (
    <Modal
      title={replacing ? 'Replace PIR image' : 'Upload PIR image'}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="button" onClick={upload} disabled={busy || !ready} className="btn-primary">
            {busy ? 'Uploading...' : 'Upload'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="pir-image-file" className="input-label">PIR image (PDF, PNG or JPG)</label>
          <input
            id="pir-image-file"
            type="file"
            accept={PIR_IMAGE_ACCEPT}
            disabled={busy}
            onChange={pick}
            className="block w-full text-sm text-gray-700"
          />
          {file && (
            <p className="text-sm text-gray-600 mt-1">
              {file.name} · {fileSize(file.size)}
            </p>
          )}
          {fileError && <p role="alert" className="text-sm text-red-600 mt-1">{fileError}</p>}
        </div>

        <div>
          <label htmlFor="pir-image-scale" className="input-label">Scale (px/ft)</label>
          <input
            id="pir-image-scale"
            type="number"
            min="1"
            step="any"
            className="input-field w-40"
            placeholder="e.g. 15"
            value={scale}
            disabled={busy}
            onChange={(e) => setScale(e.target.value)}
          />
          {scale.trim() !== '' && scaleOf(scale) === null && (
            <p role="alert" className="text-sm text-red-600 mt-1">The scale is a number of at least 1 px/ft.</p>
          )}
        </div>

        {file && !fileError && (
          isPdf ? (
            <p className="text-sm text-gray-600">{PDF_NOTE}</p>
          ) : preview && (
            <img src={preview} alt="Preview of the picked PIR image" className="max-w-full h-auto max-h-64 border border-gray-200 rounded" />
          )
        )}

        {busy && (
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <div role="status" className="animate-spin rounded-full h-5 w-5 border-b-2 border-construction-600"></div>
            <span>{STEP_LABELS[step]}</span>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
