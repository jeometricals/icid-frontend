import { apiFetch } from './apiClient'

// A PIR's pages: its scanned survey sheet, uploaded once as a PDF (any number of pages, up to the backend's cap) or
// a PNG / JPEG (one page), each page rendered to PNG and stored in Supabase Storage (bucket pir-images). A page is
// {pir_page_id, pir_id, page_number, image_url (a signed URL), image_url_expires_at, image_mime, width_px, height_px,
// scale_px_per_ft (or null), rotation_deg (0, 90, 180 or 270), created_at, updated_at, deleted_at, deleted_by}.
// Writes are for anyone on the project but a demo user; only an admin changes the pages of a deleted PIR or of a
// PIR of a deleted property. A new upload replaces every page, and the flags drawn on the old ones are deleted.

// What the backend takes, by declared type; it then checks the first bytes itself
export const PIR_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
export const PIR_FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg'
export const PIR_FILE_MAX_BYTES = 10 * 1024 * 1024 // the backend's PIR_IMAGE_MAX_BYTES; past it, a 413
export const DEFAULT_PIR_SCALE = 15 // px/ft, what the upload dialog offers to start
export const PAGE_ROTATIONS = [0, 90, 180, 270]

const TYPE_BY_EXTENSION = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }

/**
 * The type a PIR file is sent as: its declared type when that is one the backend takes, else the one its
 * extension names (some browsers declare none). Null when it is neither a PDF, a PNG nor a JPEG.
 */
export function pirFileTypeOf(file) {
  if (PIR_FILE_TYPES.includes(file.type)) return file.type
  const extension = file.name?.split('.').pop()?.toLowerCase()
  return TYPE_BY_EXTENSION[extension] ?? null
}

/** Checks a file before upload. Returns null if it can go, otherwise the message to show. */
export function validatePirFile(file) {
  if (!pirFileTypeOf(file)) return 'The PIR must be a PDF, PNG or JPG.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > PIR_FILE_MAX_BYTES) return 'The PIR file must be 10 MB or smaller.'
  return null
}

/** The rotation after a quarter turn clockwise: 0 → 90 → 180 → 270 → 0. */
export const nextRotation = (degrees) => PAGE_ROTATIONS[(PAGE_ROTATIONS.indexOf(degrees) + 1) % PAGE_ROTATIONS.length]

/**
 * Starts an upload of a PIR's file. Takes the PIR's id and the File. Returns {upload_url, staging_path, expires_at}:
 * a signed URL to PUT the file to. The backend answers 400 for a type it doesn't take and 413 for a file too large.
 */
export async function requestPirUpload(pirId, file) {
  const json = await apiFetch(`/v1/pirs/${pirId}/image/upload-request`, {
    method: 'POST', body: { mime: pirFileTypeOf(file), filename: file.name, size_bytes: file.size },
  })
  return json.data
}

/**
 * PUTs the file straight to Storage's signed upload URL (not through the API; the URL is the credential).
 * Throws with a readable message on a network failure or a non-2xx response (raw status on error.storageStatus).
 */
export async function putPirFile(url, file, contentType) {
  let res
  try {
    res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
  } catch {
    throw new Error('Could not reach file storage. Please try again.')
  }
  if (!res.ok) {
    const error = new Error(`File storage rejected the PIR file (HTTP ${res.status}). Please try again.`)
    error.storageStatus = res.status
    throw error
  }
}

/**
 * Finishes an upload once the file is PUT: the backend renders every page to PNG and replaces the PIR's pages with
 * them (the flags on the old pages are deleted). Takes the PIR's id, the staging path and an optional scale (px/ft)
 * for every page. Returns the PIR with its new `pages`. The backend answers 400 for a scale that isn't above 0, a
 * file it can't read or over a cap (too many pages, a page too large; the message names it) or a deleted PIR or
 * property, 413 for a file too large and 502 when Storage fails.
 */
export async function completePirUpload(pirId, stagingPath, scale = null) {
  const body = { staging_path: stagingPath }
  if (scale !== null && scale !== undefined) body.scale_px_per_ft = scale
  const json = await apiFetch(`/v1/pirs/${pirId}/image/complete`, { method: 'POST', body })
  return json.data
}

/**
 * Uploads a PIR's file in one go, replacing its pages: upload-request → PUT to the signed URL → complete.
 * Takes the PIR's id, the File and {scale (px/ft for every page, or null), onProgress({step: 'requesting' |
 * 'uploading' | 'rendering'})}. Returns the PIR with its `pages`. Throws whichever step failed; the PIR keeps its
 * old pages unless all three succeed.
 */
export async function uploadPir(pirId, file, { scale = null, onProgress = () => {} } = {}) {
  const invalid = validatePirFile(file)
  if (invalid) throw new Error(invalid)
  onProgress({ step: 'requesting' })
  const { upload_url: uploadUrl, staging_path: stagingPath } = await requestPirUpload(pirId, file)
  onProgress({ step: 'uploading' })
  await putPirFile(uploadUrl, file, pirFileTypeOf(file))
  onProgress({ step: 'rendering' })
  return completePirUpload(pirId, stagingPath, scale)
}

/** A PIR's live pages in order, each with a fresh signed image_url. The backend answers 403 / 404 as for the PIR. */
export async function listPirPages(pirId) {
  const json = await apiFetch(`/v1/pirs/${pirId}/pages`)
  return json.data
}

/** Deletes a PIR's pages and the flags drawn on them (soft deletes). Returns nothing; no pages is a no-op. */
export async function deletePirPages(pirId) {
  await apiFetch(`/v1/pirs/${pirId}/pages`, { method: 'DELETE' })
}

/** Sets one page's scale (px/ft, above 0) and returns the page. The backend answers 400 for a scale not above 0. */
export async function setPirPageScale(pirPageId, scalePxPerFt) {
  const json = await apiFetch(`/v1/pir-pages/${pirPageId}/scale`, {
    method: 'PATCH', body: { scale_px_per_ft: scalePxPerFt },
  })
  return json.data
}

/** Sets one page's rotation (0, 90, 180 or 270) and returns the page. */
export async function setPirPageRotation(pirPageId, rotationDeg) {
  const json = await apiFetch(`/v1/pir-pages/${pirPageId}/rotation`, {
    method: 'PATCH', body: { rotation_deg: rotationDeg },
  })
  return json.data
}
