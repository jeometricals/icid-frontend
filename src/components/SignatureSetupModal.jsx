import { useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { useAuth } from '../contexts/AuthContext'
import { saveSignature, validateSignatureFile } from '../services/api'
import { drawnSignatureBlob, typedSignatureBlob } from '../lib/signatureImage'
import Modal from './Modal'
// The handwriting fonts a typed signature can use, bundled with the app (no font service at run time)
import '@fontsource/dancing-script/400.css'
import '@fontsource/great-vibes/400.css'
import '@fontsource/satisfy/400.css'
import '@fontsource/caveat/400.css'

const TABS = [
  { id: 'draw', label: 'Draw' },
  { id: 'upload', label: 'Upload' },
  { id: 'type', label: 'Type' },
]

// family is the name the font's stylesheet registers; the canvas and the previews both ask for it by that name
export const SIGNATURE_FONTS = [
  { id: 'dancing-script', family: 'Dancing Script', description: 'Flowing cursive' },
  { id: 'great-vibes', family: 'Great Vibes', description: 'Formal script' },
  { id: 'satisfy', family: 'Satisfy', description: 'Brush style' },
  { id: 'caveat', family: 'Caveat', description: 'Casual handwriting' },
]
const TYPED_MAX_LENGTH = 60

/**
 * The dialog where a user sets (or replaces) the signature that is stamped on the IDRs they submit: draw it,
 * upload a PNG, or type their name and pick a handwriting font. Save uploads the image and records it, then
 * refreshes the signed-in user.
 * Props: isOpen, onClose, onSuccess (called once the signature is saved, before onClose), title
 * (default "Set Up Your Signature"; pass "Update Your Signature" when replacing one).
 */
export default function SignatureSetupModal({ isOpen, ...props }) {
  // Mounted only while open, so every opening starts from a blank form
  return isOpen ? <SignatureSetupDialog {...props} /> : null
}

function SignatureSetupDialog({ onClose, onSuccess = () => {}, title = 'Set Up Your Signature' }) {
  const { user, refreshUser } = useAuth()
  const canvasRef = useRef(null)
  const [tab, setTab] = useState('draw')
  const [hasDrawn, setHasDrawn] = useState(false)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [typedName, setTypedName] = useState(() => [user?.first_name, user?.last_name].filter(Boolean).join(' '))
  const [fontId, setFontId] = useState(SIGNATURE_FONTS[0].id)
  const font = SIGNATURE_FONTS.find(f => f.id === fontId)
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

  const canSave = { draw: hasDrawn, upload: Boolean(file), type: typedName.trim() !== '' }[tab]

  // What gets uploaded, per tab. A typed signature is pixels like a drawn one, so it is recorded as 'drawn'.
  const signatureBlob = () => ({
    draw: () => drawnSignatureBlob(canvasRef.current.getCanvas()),
    upload: () => file,
    type: () => typedSignatureBlob(typedName, font.family),
  })[tab]()

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await saveSignature(await signatureBlob(), tab === 'upload' ? 'uploaded' : 'drawn')
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

      <div role="tabpanel" aria-label="Type" hidden={tab !== 'type'}>
        <label htmlFor="signature-text" className="input-label">Your name</label>
        <input
          id="signature-text"
          type="text"
          className="input-field"
          placeholder="Your full name"
          maxLength={TYPED_MAX_LENGTH}
          value={typedName}
          onChange={(e) => { setTypedName(e.target.value); setSaveError(null) }}
          disabled={saving}
        />

        <fieldset className="mt-4" disabled={saving}>
          <legend className="input-label">Style</legend>
          <div className="grid grid-cols-2 gap-2">
            {SIGNATURE_FONTS.map(option => (
              <label
                key={option.id}
                className={`block cursor-pointer rounded-md border p-2 text-center focus-within:ring-2 focus-within:ring-construction-500 ${
                  option.id === fontId ? 'border-construction-600 bg-construction-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="radio"
                  name="signature-font"
                  value={option.id}
                  checked={option.id === fontId}
                  onChange={() => setFontId(option.id)}
                  aria-label={`${option.family}: ${option.description}`}
                  className="sr-only"
                />
                <span
                  data-testid={`font-sample-${option.id}`}
                  className="block truncate text-2xl leading-10 text-gray-900"
                  style={{ fontFamily: `"${option.family}", cursive` }}
                >
                  {typedName.trim() || 'Your name'}
                </span>
                <span className="block text-xs text-gray-500">{option.family}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 border border-gray-300 rounded-md bg-white px-3 py-2 overflow-hidden">
          <p className="text-xs text-gray-500">Preview</p>
          <p
            data-testid="typed-preview"
            className="truncate text-center text-gray-900"
            style={{ fontFamily: `"${font.family}", cursive`, fontSize: 48, lineHeight: '72px' }}
          >
            {typedName.trim() || ' '}
          </p>
        </div>
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-red-600 mt-4">Could not save your signature: {saveError}</p>
      )}
    </Modal>
  )
}
