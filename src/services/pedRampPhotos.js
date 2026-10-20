import { apiFetch } from './apiClient'

// Ped ramp photos (Pedramp Phase 3, S4): an inspection's photos (each of one ramp, numbered across the whole form) and
// a TIF's photos and its one site design / layout image, kept in Supabase Storage (bucket pedramp-photos). A photo is
// {id, inspection_id, tif_id, property_id, kind ('photo' | 'layout'), photo_number, caption, content_type, byte_size,
// uploaded_at, uploaded_by, image_url (a signed URL), image_url_expires_at}. A parent is {type: 'inspection' | 'tif',
// id}. Uploading takes three calls: a signed upload URL, a PUT of the file to it, then completing. The backend checks
// the number, the 20-a-form cap and the lock, and words each refusal ("Photo number 3 is already used on this form").

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/heic,.heic'
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024 // the bucket's limit; past it, a 413
export const MAX_PHOTOS_PER_FORM = 20 // the backend's cap, the layout included

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/heic']
const TYPE_BY_EXTENSION = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heic' }

/** The API path of a photo's parent: an inspection's or a TIF's. */
function parentPath(parent) {
  return parent.type === 'tif' ? `/v1/ped-ramp-tifs/${parent.id}` : `/v1/ped-ramp-inspections/${parent.id}`
}

/**
 * The type a photo is sent as: its declared type when the bucket takes it, else the one its extension names (a HEIC
 * often comes with none). Null when it is neither a JPEG, a PNG nor a HEIC.
 */
export function photoContentType(file) {
  if (PHOTO_TYPES.includes(file.type)) return file.type
  if (file.type === 'image/heif') return 'image/heic'
  const extension = file.name?.split('.').pop()?.toLowerCase()
  return TYPE_BY_EXTENSION[extension] ?? null
}

/** Checks a photo before upload. Returns null if it can go, otherwise the message to show. */
export function validatePhotoFile(file) {
  if (!photoContentType(file)) return 'Upload a JPEG, PNG or HEIC photo.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > PHOTO_MAX_BYTES) return 'Photo too large: at most 10 MB'
  return null
}

/** How many photos a form holds, the layout included: what the 20-photo cap counts. */
export const photoCount = (photos) => photos.length

/** The lowest number no photo (not the layout) of the form has yet: what a new photo is numbered by default. */
export function nextPhotoNumber(photos) {
  const taken = new Set(photos.filter((photo) => photo.kind !== 'layout').map((photo) => photo.photo_number))
  let number = 1
  while (taken.has(number)) number += 1
  return number
}

/** Lists an inspection's or a TIF's photos (the layout last), each with a fresh signed URL. */
export async function listPhotos(parent) {
  const json = await apiFetch(`${parentPath(parent)}/photos`)
  return json.data
}

/**
 * Starts a photo upload. Takes the parent and {propertyId (an inspection's photo: the ramp it shows), fileName, kind
 * (a TIF's: 'photo' or 'layout')}. Returns {upload_url, staging_path, expires_at}.
 */
export async function requestPhotoUpload(parent, { propertyId, fileName, kind } = {}) {
  const body = { file_name: fileName ?? null }
  if (parent.type === 'tif') body.kind = kind ?? 'photo'
  else body.property_id = propertyId
  const json = await apiFetch(`${parentPath(parent)}/photos/upload-request`, { method: 'POST', body })
  return json.data
}

/**
 * PUTs the photo straight to Storage's signed upload URL (not through the API; the URL is the credential).
 * Throws with a readable message on a network failure or a non-2xx response (raw status on error.storageStatus).
 */
export async function putPhotoFile(url, file, contentType) {
  let res
  try {
    res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
  } catch {
    throw new Error('Could not reach file storage. Please try again.')
  }
  if (!res.ok) {
    const error = new Error(`File storage rejected the photo (HTTP ${res.status}). Please try again.`)
    error.storageStatus = res.status
    throw error
  }
}

/**
 * Finishes an upload once the file is PUT. Takes the parent and {stagingPath, propertyId, photoNumber, caption,
 * kind}. Returns the new photo. The backend answers 409 for a taken number (or a second layout), 400 when the form has
 * 20 photos or the file isn't a JPEG, PNG or HEIC, 413 for a photo over 10 MB, and 403 / 409 under the lock.
 */
export async function completePhotoUpload(parent, { stagingPath, propertyId, photoNumber, caption, kind }) {
  const body = { storage_path: stagingPath, caption: caption || null }
  if (parent.type === 'tif') {
    body.kind = kind ?? 'photo'
    if (body.kind === 'photo') body.photo_number = photoNumber
  } else {
    body.property_id = propertyId
    body.photo_number = photoNumber
  }
  const json = await apiFetch(`${parentPath(parent)}/photos`, { method: 'POST', body })
  return json.data
}

/**
 * Uploads a photo in its three steps (sign, PUT, complete). Takes the parent, the File and {propertyId, photoNumber,
 * caption, kind}. Returns the new photo; throws the first step's failure.
 */
export async function uploadPhoto(parent, file, { propertyId, photoNumber, caption, kind } = {}) {
  const upload = await requestPhotoUpload(parent, { propertyId, fileName: file.name, kind })
  await putPhotoFile(upload.upload_url, file, photoContentType(file))
  return completePhotoUpload(parent, { stagingPath: upload.staging_path, propertyId, photoNumber, caption, kind })
}

/** Renumbers a photo or changes its caption (blank clears it). Takes the photo's id and {photo_number?, caption?}; returns it. */
export async function updatePhoto(photoId, changes) {
  const json = await apiFetch(`/v1/ped-ramp-photos/${photoId}`, { method: 'PATCH', body: changes })
  return json.data
}

/** Deletes a photo and its file. */
export async function deletePhoto(photoId) {
  await apiFetch(`/v1/ped-ramp-photos/${photoId}`, { method: 'DELETE' })
}
