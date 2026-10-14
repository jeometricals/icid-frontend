import { useEffect, useState } from 'react'
import Modal from './Modal'
import { DEFAULT_PIR_SCALE, PIR_FILE_ACCEPT, pirFileTypeOf, uploadPir, validatePirFile } from '../services/pirPages'

// What the spinner says during each upload step; the page count only comes back with the rendered pages
export const STEP_LABELS = {
  requesting: 'Preparing upload...',
  uploading: 'Uploading file...',
  rendering: 'Rendering...',
}

export const UPLOAD_PROMPT = 'Upload PIR (image or PDF, any number of pages).'
export const REPLACE_WARNING = 'Uploading replaces every page of this PIR, and the flags drawn on them are deleted.'
export const TOO_LARGE = 'The file is too large: a PIR file is 10 MB at most.'

// "1.2 MB", "340 KB": a file's size as the dialog shows it
export function fileSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// A scale as typed: blank is none (set per page later); otherwise a finite number of at least 1 px/ft, or invalid
const scaleOf = (typed) => {
  if (typed.trim() === '') return { value: null, valid: true }
  const value = Number(typed)
  return Number.isFinite(value) && value >= 1 ? { value, valid: true } : { value: null, valid: false }
}

/**
 * Uploads a PIR's file, or replaces it: a PDF (any number of pages) or a PNG / JPG (one page), 10 MB at most, shown
 * by name and size, and an optional scale in pixels per foot for every page (15 to start, at least 1; blank leaves
 * the pages without one, to be set per page). A picked image is previewed from the file itself. Replacing warns that
 * every page and the flags drawn on them go. Runs the upload itself (upload-request, the PUT to Storage, complete),
 * with a spinner naming the step ("Rendering..." while the backend renders the pages); a refusal shows inline (a 413
 * as the size limit, anything else as the backend or Storage worded it) and the form keeps the file and scale.
 * Props: pirId, replacing (the PIR has pages already), onUploaded(pir) (the PIR with its new `pages`), onClose.
 */
export default function PirUploadModal({ pirId, replacing = false, onUploaded, onClose }) {
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [scale, setScale] = useState(String(DEFAULT_PIR_SCALE))
  const [preview, setPreview] = useState(null) // an object URL for a picked image
  const [step, setStep] = useState(null) // the running upload step, null when idle
  const [error, setError] = useState(null)

  const busy = step !== null
  const isPdf = file && pirFileTypeOf(file) === 'application/pdf'
  const typedScale = scaleOf(scale)
  const ready = Boolean(file) && !fileError && typedScale.valid

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
    setFileError(picked ? validatePirFile(picked) : null)
    setError(null)
  }

  const upload = async () => {
    if (busy || !ready) return
    setError(null)
    try {
      const pir = await uploadPir(pirId, file, { scale: typedScale.value, onProgress: ({ step: current }) => setStep(current) })
      setStep(null)
      onUploaded(pir)
    } catch (err) {
      setStep(null)
      setError(err.status === 413 ? TOO_LARGE : err.message)
    }
  }

  return (
    <Modal
      title={replacing ? 'Replace PIR' : 'Upload PIR'}
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
        <p className="text-sm text-gray-700">{UPLOAD_PROMPT}</p>
        {replacing && <p className="text-sm text-amber-700 bg-amber-50 rounded p-2">{REPLACE_WARNING}</p>}

        <div>
          <label htmlFor="pir-file" className="input-label">PIR file (PDF, PNG or JPG)</label>
          <input
            id="pir-file"
            type="file"
            accept={PIR_FILE_ACCEPT}
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
          <label htmlFor="pir-scale" className="input-label">Scale (px/ft, every page)</label>
          <input
            id="pir-scale"
            type="number"
            min="1"
            step="any"
            className="input-field w-40"
            placeholder="e.g. 15"
            value={scale}
            disabled={busy}
            onChange={(e) => setScale(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Leave blank to set each page's scale later.</p>
          {!typedScale.valid && (
            <p role="alert" className="text-sm text-red-600 mt-1">The scale is a number of at least 1 px/ft.</p>
          )}
        </div>

        {file && !fileError && !isPdf && preview && (
          <img src={preview} alt="Preview of the picked PIR image" className="max-w-full h-auto max-h-64 border border-gray-200 rounded" />
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
