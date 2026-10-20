import { useEffect, useId, useRef, useState } from 'react'
import { Camera, Pencil, Trash2, Upload } from 'lucide-react'
import {
  MAX_PHOTOS_PER_FORM, PHOTO_ACCEPT, deletePhoto, listPhotos, nextPhotoNumber, photoCount, updatePhoto, uploadPhoto,
  validatePhotoFile,
} from '../services/api'
import ConfirmDialog from './ConfirmDialog'

// What the inspection page warns before a submit with no photos; a warning only, the pilot submits without them
export const NO_PHOTOS_WARNING = 'No photos yet: DOT asks for at least four of each ramp. You can still submit for the pilot.'

const numberTaken = (number) => `Photo number ${number} is already used on this form`
const FORM_FULL = `A form takes at most ${MAX_PHOTOS_PER_FORM} photos`

/** Reads a typed photo number: a whole number from 1 up, else null. */
function parseNumber(text) {
  const number = Number(String(text).trim())
  return Number.isInteger(number) && number >= 1 ? number : null
}

/** Says why a number can't be used on the form, or null when it can. Takes the number typed, the form's photos and the id of the photo being renumbered. */
function numberProblem(text, photos, ownId = null) {
  const number = parseNumber(text)
  if (number === null) return 'The photo number must be a whole number from 1 up.'
  if (photos.some((photo) => photo.kind !== 'layout' && photo.id !== ownId && photo.photo_number === number)) {
    return numberTaken(number)
  }
  return null
}

// One photo: its thumbnail, number and caption, and (when editable) Edit inline and Delete
function PhotoCard({ photo, photos, canEdit, onSaved, onDelete }) {
  const ids = useId()
  const [editing, setEditing] = useState(false)
  const [number, setNumber] = useState(String(photo.photo_number))
  const [caption, setCaption] = useState(photo.caption ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const isLayout = photo.kind === 'layout'

  const startEdit = () => {
    setNumber(String(photo.photo_number))
    setCaption(photo.caption ?? '')
    setError(null)
    setEditing(true)
  }

  const save = async () => {
    const changes = {}
    if (!isLayout) {
      const problem = numberProblem(number, photos, photo.id)
      if (problem) {
        setError(problem)
        return
      }
      if (parseNumber(number) !== photo.photo_number) changes.photo_number = parseNumber(number)
    }
    if (caption.trim() !== (photo.caption ?? '')) changes.caption = caption.trim() || null
    if (Object.keys(changes).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      onSaved(await updatePhoto(photo.id, changes))
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="flex flex-col sm:flex-row gap-3 py-3">
      <a href={photo.image_url} target="_blank" rel="noreferrer" className="h-20 w-20 flex-shrink-0 rounded overflow-hidden bg-construction-100">
        <img src={photo.image_url} alt={isLayout ? 'Site design / layout' : `Photo ${photo.photo_number}`} className="h-full w-full object-cover" />
      </a>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-wrap items-end gap-2">
            {!isLayout && (
              <div>
                <label htmlFor={`${ids}-number`} className="input-label">Photo #</label>
                <input id={`${ids}-number`} value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" className="input-field w-20" />
              </div>
            )}
            <div className="flex-1 min-w-[10rem]">
              <label htmlFor={`${ids}-caption`} className="input-label">Caption</label>
              <input id={`${ids}-caption`} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} className="input-field w-full" />
            </div>
            <button type="button" onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="btn-secondary">Cancel</button>
          </div>
        ) : (
          <>
            <p className="font-semibold text-gray-900">{isLayout ? 'Site design / layout' : `Photo ${photo.photo_number}`}</p>
            <p className="text-sm text-gray-600 break-words">{photo.caption || <span className="italic text-gray-400">No caption</span>}</p>
          </>
        )}
        {error && <p role="alert" className="text-sm text-red-700 mt-1">{error}</p>}
      </div>
      {canEdit && !editing && (
        <div className="flex items-start gap-2">
          <button type="button" onClick={startEdit} className="btn-secondary flex items-center gap-1" aria-label={`Edit ${isLayout ? 'site layout' : `photo ${photo.photo_number}`}`}>
            <Pencil className="h-4 w-4" /><span>Edit</span>
          </button>
          <button type="button" onClick={() => onDelete(photo)} className="btn-secondary flex items-center gap-1 text-red-700" aria-label={`Delete ${isLayout ? 'site layout' : `photo ${photo.photo_number}`}`}>
            <Trash2 className="h-4 w-4" /><span>Delete</span>
          </button>
        </div>
      )}
    </li>
  )
}

// The upload row: a file, its number (photos only) and a caption; checks what it can before sending
function PhotoUploadForm({ kind, photos, full, onUpload }) {
  const ids = useId()
  const [file, setFile] = useState(null)
  const [number, setNumber] = useState(String(nextPhotoNumber(photos)))
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [inputKey, setInputKey] = useState(0) // bump to clear the file input

  // A new or deleted photo moves the default on to the next free number (not while an upload is under way)
  useEffect(() => {
    if (!busy) setNumber(String(nextPhotoNumber(photos)))
  }, [photos, busy])

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    if (full) return setError(FORM_FULL)
    if (!file) return setError('Choose a photo first.')
    const fileProblem = validatePhotoFile(file)
    if (fileProblem) return setError(fileProblem)
    if (kind === 'photo') {
      const problem = numberProblem(number, photos)
      if (problem) return setError(problem)
    }
    setBusy(true)
    try {
      await onUpload(file, { photoNumber: kind === 'photo' ? parseNumber(number) : 1, caption: caption.trim(), kind })
      setFile(null)
      setCaption('')
      setInputKey((key) => key + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 pt-3 border-t border-gray-100">
      <div>
        <label htmlFor={`${ids}-file`} className="input-label">{kind === 'layout' ? 'Layout image' : 'Photo'}</label>
        <input key={inputKey} id={`${ids}-file`} type="file" accept={PHOTO_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={busy} className="text-sm" />
      </div>
      {kind === 'photo' && (
        <div>
          <label htmlFor={`${ids}-number`} className="input-label">Photo #</label>
          <input id={`${ids}-number`} value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" disabled={busy} className="input-field w-20" />
        </div>
      )}
      <div className="flex-1 min-w-[10rem]">
        <label htmlFor={`${ids}-caption`} className="input-label">Caption</label>
        <input id={`${ids}-caption`} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} disabled={busy} className="input-field w-full" />
      </div>
      <button type="submit" disabled={busy || full} className="btn-primary flex items-center gap-1">
        <Upload className="h-4 w-4" /><span>{busy ? 'Uploading...' : kind === 'layout' ? 'Upload layout' : 'Upload'}</span>
      </button>
      {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
      {full && !error && <p className="w-full text-sm text-gray-600">{FORM_FULL}</p>}
    </form>
  )
}

/**
 * The photos of one form: an inspection's photos of one ramp (numbered across the whole form), or a TIF's photos and,
 * when `kinds` includes 'layout', its single "Site design / layout" image. Lists them with thumbnails, uploads (JPEG,
 * PNG or HEIC, at most 10 MB; the number defaults to the next free one and must be unique on the form), edits number
 * and caption inline and deletes (confirmed); read-only without canEdit. Every refusal reads as the backend words it.
 * Props: parent ({type: 'inspection' | 'tif', id}), propertyId (an inspection's: the ramp shown), canEdit, kinds
 * (default ['photo']), onPhotosChange (optional; called with every photo of the form after each load and change).
 */
export default function PedRampPhotosSection({ parent, propertyId = null, canEdit, kinds = ['photo'], onPhotosChange }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [photos, setPhotos] = useState([])
  const [deleting, setDeleting] = useState(null) // the photo whose delete is being confirmed
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const notify = useRef(onPhotosChange) // the latest callback, so a new one each render doesn't re-run the effect
  notify.current = onPhotosChange
  const { type: parentType, id: parentId } = parent

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setLoadError(null)
    listPhotos({ type: parentType, id: parentId })
      .then((list) => {
        if (cancelled) return
        setPhotos(list)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err.message)
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [parentType, parentId, attempt])

  useEffect(() => {
    if (status === 'ready') notify.current?.(photos)
  }, [photos, status])

  const isInspection = parentType === 'inspection'
  const shown = photos.filter((photo) => photo.kind === 'photo' && (!isInspection || photo.property_id === propertyId))
  const layout = photos.find((photo) => photo.kind === 'layout') ?? null
  const full = photoCount(photos) >= MAX_PHOTOS_PER_FORM

  const upload = async (file, details) => {
    const photo = await uploadPhoto(parent, file, { ...details, propertyId })
    setPhotos((prev) => [...prev, photo])
  }

  const saved = (photo) => setPhotos((prev) => prev.map((item) => (item.id === photo.id ? photo : item)))

  const confirmDelete = async () => {
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await deletePhoto(deleting.id)
      setPhotos((prev) => prev.filter((item) => item.id !== deleting.id))
      setDeleting(null)
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  const askDelete = (photo) => {
    setDeleteError(null)
    setDeleting(photo)
  }

  if (status === 'loading') {
    return <p role="status" className="text-sm text-gray-500">Loading photos...</p>
  }
  if (status === 'error') {
    return (
      <div role="alert" className="text-sm text-red-700">
        Couldn't load the photos: {loadError}{' '}
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="underline">Retry</button>
      </div>
    )
  }

  const sorted = [...shown].sort((a, b) => a.photo_number - b.photo_number)
  return (
    <div className="space-y-4">
      {kinds.includes('photo') && (
        <section>
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2"><Camera className="h-4 w-4" />Photos</h4>
            <p className="text-sm text-gray-600">{photoCount(photos)} of {MAX_PHOTOS_PER_FORM} photos on this form</p>
          </div>
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">No photos yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sorted.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} photos={photos} canEdit={canEdit} onSaved={saved} onDelete={askDelete} />
              ))}
            </ul>
          )}
          {canEdit && <PhotoUploadForm kind="photo" photos={photos} full={full} onUpload={upload} />}
        </section>
      )}
      {kinds.includes('layout') && (
        <section>
          <h4 className="font-semibold text-gray-900">Site design / layout</h4>
          {layout ? (
            <ul><PhotoCard photo={layout} photos={photos} canEdit={canEdit} onSaved={saved} onDelete={askDelete} /></ul>
          ) : (
            <>
              <p className="text-sm text-gray-500 py-2">No layout yet.</p>
              {canEdit && <PhotoUploadForm kind="layout" photos={photos} full={full} onUpload={upload} />}
            </>
          )}
        </section>
      )}
      {deleting && (
        <ConfirmDialog
          title={deleting.kind === 'layout' ? 'Delete the site layout?' : `Delete photo ${deleting.photo_number}?`}
          message="The photo and its file are deleted. This can't be undone."
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
          error={deleteError}
        />
      )}
    </div>
  )
}
