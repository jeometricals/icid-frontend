import { useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { useAuth } from '../contexts/AuthContext'
import { saveSignature, validateSignatureFile } from '../services/api'
import { drawnSignatureBlob } from '../lib/signatureImage'
import Modal from './Modal'

const TABS = [
  { id: 'draw', label: 'Draw' },
  { id: 'upload', label: 'Upload' },
]

/**
 * The dialog where a user sets (or replaces) the signature that is stamped on the IDRs they submit: draw it, or
 * upload a PNG. Save uploads the image and records it, then refreshes the signed-in user.
 * Props: isOpen, onClose, onSuccess (called once the signature is saved, before onClose), title
 * (default "Set Up Your Signature"; pass "Update Your Signature" when replacing one).
 */
export default function SignatureSetupModal({ isOpen, ...props }) {
  // Mounted only while open, so every opening starts from a blank form
  return isOpen ? <SignatureSetupDialog {...props} /> : null
}

function SignatureSetupDialog({ onClose, onSuccess = () => {}, title = 'Set Up Your Signature' }) {
  const { refreshUser } = useAuth()
  const canvasRef = useRef(null)
  const [tab, setTab] = useState('draw')
  const [hasDrawn, setHasDrawn] = useState(false)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // The preview is an object URL for the chosen file; release it when the file changes or the dialog closes
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const clearDrawing = () => {
    canvasRef.current?.clear()
    setHasDrawn(false)
    setSaveError(null)
  }

  const chooseFile = (event) => {
    const chosen = event.target.files?.[0]
    if (!chosen) return
    setSaveError(null)
    const invalid = validateSignatureFile(chosen)
    setFileError(invalid)
    setFile(invalid ? null : chosen)
  }

  const canSave = tab === 'draw' ? hasDrawn : Boolean(file)

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const blob = tab === 'draw' ? await drawnSignatureBlob(canvasRef.current.getCanvas()) : file
      await saveSignature(blob, tab === 'draw' ? 'drawn' : 'uploaded')
    } catch (err) {
      setSaveError(err.message)
      setSaving(false)
      return
    }
    try {
      await refreshUser()
    } catch {
      // The signature is saved; the header catches up on the next page load
    }
    onSuccess()
    onClose()
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={!canSave || saving} className="btn-primary">
            {saving && (
              <span
                role="status"
                aria-label="Saving"
                className="inline-block h-4 w-4 mr-2 align-[-2px] rounded-full border-2 border-current border-t-transparent animate-spin"
              />
            )}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 mb-4">
        Your signature is printed on the inspection reports you submit. You can change it at any time; reports already
        submitted keep the signature they were signed with.
      </p>

      <div role="tablist" className="flex border-b border-gray-200 mb-4">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            disabled={saving}
            onClick={() => { setTab(id); setSaveError(null) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === id
                ? 'border-construction-600 text-construction-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Both panels stay mounted so switching tabs keeps what was drawn or chosen */}
      <div role="tabpanel" aria-label="Draw" hidden={tab !== 'draw'}>
        <SignatureCanvas
          ref={canvasRef}
          penColor="#111827"
          onEnd={() => setHasDrawn(true)}
          canvasProps={{
            'aria-label': 'Draw your signature here',
            className: 'w-full h-40 border border-gray-300 rounded-md bg-white touch-none',
          }}
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-500">Sign with your finger, a stylus or the mouse.</p>
          <button type="button" onClick={clearDrawing} disabled={!hasDrawn || saving} className="btn-secondary text-sm">
            Clear
          </button>
        </div>
      </div>

      <div role="tabpanel" aria-label="Upload" hidden={tab !== 'upload'}>
        <label htmlFor="signature-file" className="input-label">
          {file ? 'Choose a different PNG' : 'Signature image (PNG, up to 500 KB)'}
        </label>
        <input
          id="signature-file"
          type="file"
          accept="image/png"
          onChange={chooseFile}
          disabled={saving}
          className="block w-full text-sm text-gray-700"
        />
        {fileError && (
          <p role="alert" className="text-sm text-red-600 mt-2">{fileError}</p>
        )}
        {previewUrl && (
          <div className="mt-3 border border-gray-300 rounded-md bg-white p-2 flex justify-center">
            <img src={previewUrl} alt="Signature preview" className="max-h-32 max-w-full object-contain" />
          </div>
        )}
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-red-600 mt-4">Could not save your signature: {saveError}</p>
      )}
    </Modal>
  )
}
