import { apiFetch } from './apiClient'

// A PIR's image: the scanned survey sheet, stored in Supabase Storage (bucket pir-images) with its scale in pixels
// per foot. The PIR carries the storage path (source_image_url) and the scale (source_image_scale); the image itself
// is read through a short-lived signed URL. Writes are for anyone on the project (not a demo user); only an admin
// changes the image of a deleted PIR, or of a PIR of a deleted property.

// What the backend takes, by declared type; it then checks the first bytes itself. A PDF's first page is
// converted to PNG on the server.
export const PIR_IMAGE_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
export const PIR_IMAGE_ACCEPT = '.pdf,.png,.jpg,.jpeg'
export const PIR_IMAGE_MAX_BYTES = 10 * 1024 * 1024 // the backend's PIR_IMAGE_MAX_BYTES; past it, a 413
export const DEFAULT_PIR_IMAGE_SCALE = 15 // px/ft, the backend's default

const TYPE_BY_EXTENSION = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

/**
 * The type a PIR image file is sent as: its declared type when that is one the backend takes, else the one its
 * extension names (some browsers declare none). Null when it is neither a PDF, a PNG nor a JPEG.
 */
export function pirImageTypeOf(file) {
  if (PIR_IMAGE_TYPES.includes(file.type)) return file.type
  const extension = file.name?.split('.').pop()?.toLowerCase()
  return TYPE_BY_EXTENSION[extension] ?? null
}

/** Checks a file before upload. Returns null if it can go, otherwise the message to show. */
export function validatePirImageFile(file) {
  if (!pirImageTypeOf(file)) return 'The PIR image must be a PDF, PNG or JPG.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > PIR_IMAGE_MAX_BYTES) return 'The PIR image must be 10 MB or smaller.'
  return null
}

/**
 * Starts giving a PIR an image. Takes the PIR's id and the file's type. Returns {upload_url, upload_path,
 * expires_in}: a signed URL to PUT the file to, at a fresh path. The backend answers 400 for a type it doesn't take.
 */
export async function requestPirImageUpload(pirId, contentType) {
  const json = await apiFetch(`/v1/pirs/${pirId}/image/upload-request`, { method: 'POST', body: { content_type: contentType } })
  return json.data
}

/**
 * PUTs the file straight to Storage's signed upload URL (not through the API; the URL is the credential).
 * Throws with a readable message on a network failure or a non-2xx response (raw status on error.storageStatus).
 */
export async function putPirImageFile(url, file, contentType) {
  let res
  try {
    res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
  } catch {
    throw new Error('Could not reach file storage. Please try again.')
  }
  if (!res.ok) {
    const error = new Error(`File storage rejected the PIR image (HTTP ${res.status}). Please try again.`)
    error.storageStatus = res.status
    throw error
  }
}

/**
 * Finishes giving a PIR an image, once the file is PUT: the backend checks it, renders a PDF's first page to PNG,
 * stores it with its scale and removes the PIR's previous image. Returns the PIR with signed_url and expires_at.
 * The backend answers 400 for a scale that isn't above 0, a file that isn't a PDF, PNG or JPEG ("Unsupported file
 * type"), a PDF it can't read or a deleted PIR or property, 413 for a file too large and 502 when Storage fails.
 */
export async function completePirImageUpload(pirId, uploadPath, scale) {
  const json = await apiFetch(`/v1/pirs/${pirId}/image/complete`, {
    method: 'POST', body: { upload_path: uploadPath, scale },
  })
  return json.data
}

/**
 * Gives a PIR an image in one go, replacing any it had: upload-request → PUT to the signed URL → complete.
 * Takes the PIR's id, the File, the scale (px/ft) and an optional onProgress({step: 'requesting' | 'uploading' |
 * 'completing'}). fetch can't measure upload progress, so the steps are all there is. Returns the PIR with
 * signed_url. Throws whichever step failed; the PIR keeps its old image unless all three succeed.
 */
export async function uploadPirImage(pirId, file, scale, { onProgress = () => {} } = {}) {
  const invalid = validatePirImageFile(file)
  if (invalid) throw new Error(invalid)
  const contentType = pirImageTypeOf(file)
  onProgress({ step: 'requesting' })
  const { upload_url: uploadUrl, upload_path: uploadPath } = await requestPirImageUpload(pirId, contentType)
  onProgress({ step: 'uploading' })
  await putPirImageFile(uploadUrl, file, contentType)
  onProgress({ step: 'completing' })
  return completePirImageUpload(pirId, uploadPath, scale)
}

/** Takes a PIR's image away (its path, scale and file). Returns nothing; a PIR without one is left as it is. */
export async function removePirImage(pirId) {
  await apiFetch(`/v1/pirs/${pirId}/image`, { method: 'DELETE' })
}

/**
 * A signed link to a PIR's image: {signed_url, expires_at, scale}, or null when the PIR has no image (the
 * backend's 404, which an unknown PIR gives too). Any other refusal (a 502 when Storage can't sign) is thrown.
 */
export async function getPirImageSignedUrl(pirId) {
  try {
    const json = await apiFetch(`/v1/pirs/${pirId}/image`)
    return json.data
  } catch (err) {
    if (err.status === 404) return null
    throw err
  }
}
