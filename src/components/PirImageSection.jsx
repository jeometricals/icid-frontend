import { useEffect, useState } from 'react'
import { ImageOff, RefreshCw, Upload } from 'lucide-react'
import { getPirImageSignedUrl, removePirImage } from '../services/api'
import ConfirmDialog from './ConfirmDialog'
import PirImageUploadModal from './PirImageUploadModal'
import Toast from './Toast'

export const NO_IMAGE_TEXT = 'No PIR image yet.'

// "15 px/ft", a scale as the caption prints it
export const scaleCaption = (scale) => `${Number(scale).toLocaleString('en-US', { maximumFractionDigits: 2 })} px/ft`

/**
 * A PIR's image, at the top of its PIR card. Without one: "No PIR image yet." and, for a writer, "Upload PIR
 * image". With one: the image read through a signed URL (asked for when the section mounts, and again when the PIR
 * or its image changes, on Retry, or on "Reload image" once a link has expired), at its natural size but never
 * wider than the card, captioned with its scale ("15 px/ft"); a writer also gets Replace and Remove (confirmed
 * first). The signed URL's loading and failure are shown in the image's place. Upload and Replace share
 * PirImageUploadModal. After a change the page is asked to read the PIR again (onChanged), and a toast says what
 * happened.
 * Props: pir (with id, source_image_url and source_image_scale), writer (may change the image: on the project,
 * not a demo user, and the property not deleted unless an admin), onChanged().
 */
export default function PirImageSection({ pir, writer, onChanged }) {
  const hasImage = Boolean(pir.source_image_url)
  const [link, setLink] = useState(null) // {signed_url, expires_at, scale}
  const [loading, setLoading] = useState(hasImage)
  const [loadError, setLoadError] = useState(null)
  const [broken, setBroken] = useState(false) // the image itself didn't load (an expired link, most likely)
  const [attempt, setAttempt] = useState(0) // bump to ask for a fresh link

  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false) // whether Remove is being confirmed
  const [busy, setBusy] = useState(false)
  const [removeError, setRemoveError] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!hasImage) {
      setLink(null)
      setLoading(false)
      return undefined
    }
    let ignore = false
    setLoading(true)
    setLoadError(null)
    setBroken(false)
    getPirImageSignedUrl(pir.id)
      .then(found => {
        if (ignore) return
        if (found) setLink(found)
        else setLoadError('The PIR no longer has an image. Reload the page to see it as it is.')
      })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [pir.id, pir.source_image_url, hasImage, attempt])

  const uploaded = () => {
    setUploading(false)
    setToast(hasImage ? 'PIR image replaced.' : 'PIR image uploaded.')
    onChanged?.()
  }

  const remove = async () => {
    setBusy(true)
    setRemoveError(null)
    try {
      await removePirImage(pir.id)
    } catch (err) {
      setRemoveError(err.message)
      setBusy(false)
      return
    }
    setBusy(false)
    setRemoving(false)
    setToast('PIR image removed.')
    onChanged?.()
  }

  const scale = link?.scale ?? pir.source_image_scale

  return (
    <div aria-label="PIR image" role="group" className="mb-6">
      {!hasImage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-gray-300 rounded-md p-4">
          <p className="text-gray-600 inline-flex items-center gap-2">
            <ImageOff aria-hidden="true" className="h-5 w-5 text-gray-400" />
            <span>{NO_IMAGE_TEXT}</span>
          </p>
          {writer && (
            <button
              type="button"
              onClick={() => setUploading(true)}
              className="btn-primary inline-flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>Upload PIR image</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div role="status" aria-label="Loading the PIR image" className="animate-spin rounded-full h-8 w-8 border-b-2 border-construction-600"></div>
            </div>
          ) : loadError || broken ? (
            <div className="text-center py-4 border border-gray-200 rounded-md">
              <p className="text-red-600 mb-3">
                {broken ? "The PIR image couldn't be shown; its link may have expired." : `Couldn't load the PIR image: ${loadError}`}
              </p>
              <button type="button" onClick={() => setAttempt(a => a + 1)} className="btn-primary inline-flex items-center space-x-2">
                <RefreshCw className="h-4 w-4" />
                <span>{broken ? 'Reload image' : 'Retry'}</span>
              </button>
            </div>
          ) : (
            <figure>
              <img
                src={link.signed_url}
                alt="PIR survey sheet"
                className="max-w-full h-auto border border-gray-200 rounded"
                onError={() => setBroken(true)}
              />
              {scale !== null && scale !== undefined && (
                <figcaption className="text-sm text-gray-500 mt-1">{scaleCaption(scale)}</figcaption>
              )}
            </figure>
          )}
          {writer && (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setUploading(true)} className="btn-secondary">Replace</button>
              <button
                type="button"
                onClick={() => { setRemoveError(null); setRemoving(true) }}
                className="btn-secondary text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {uploading && (
        <PirImageUploadModal
          pirId={pir.id}
          replacing={hasImage}
          initialScale={pir.source_image_scale ?? undefined}
          onUploaded={uploaded}
          onClose={() => setUploading(false)}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Remove the PIR image?"
          message="The scanned sheet is deleted from storage. The PIR, its details and its flags stay."
          confirmLabel="Remove"
          cancelLabel="Cancel"
          onConfirm={remove}
          onCancel={() => setRemoving(false)}
          busy={busy}
          error={removeError}
        />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}
