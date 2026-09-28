import { apiFetch } from './apiClient'

// Limits mirror the backend (icid-backend api/services/attachments.py); if they drift, the API answers 400/413/415.
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENT_NAME_LENGTH = 200
export const MAX_ATTACHMENT_DESCRIPTION_LENGTH = 2000

// An explicit list rather than image/*: the backend refuses SVG (it can carry script) and other image types with a 415.
// Also usable as a file input's accept attribute: ALLOWED_MIME_TYPES.join(',').
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]

/**
 * Base for the attachment errors below. Like apiFetch errors, it carries the HTTP status on `status`
 * (the one the backend would send, for client-side checks) and the parsed error body, if any, on `body`.
 */
class AttachmentError extends Error {
  constructor(message, { status, body } = {}) {
    super(message)
    this.status = status
    this.body = body
  }
}

/** Storage failed to sign a URL or to take the file (502). Offering a retry makes sense. */
export class StorageUnavailableError extends AttachmentError {
  constructor(message = 'File storage is unavailable. Please try again.', { status = 502, body } = {}) {
    super(message, { status, body })
    this.name = 'StorageUnavailableError'
  }
}

/** The file is over MAX_FILE_SIZE_BYTES (413). */
export class FileTooLargeError extends AttachmentError {
  constructor(message = 'File is larger than the 10 MB limit.', { status = 413, body } = {}) {
    super(message, { status, body })
    this.name = 'FileTooLargeError'
  }
}

/** The file's MIME type is not in ALLOWED_MIME_TYPES (415). */
export class UnsupportedFileTypeError extends AttachmentError {
  constructor(
    message = 'Unsupported file type. Allowed: JPEG, PNG, GIF, WebP, HEIC/HEIF images and PDF.',
    { status = 415, body } = {}
  ) {
    super(message, { status, body })
    this.name = 'UnsupportedFileTypeError'
  }
}

/** The file is empty, or the attachment name/description is blank or too long (400). */
export class AttachmentValidationError extends AttachmentError {
  constructor(message, { status = 400, body } = {}) {
    super(message, { status, body })
    this.name = 'AttachmentValidationError'
  }
}

const TYPED_ERRORS_BY_STATUS = { 413: FileTooLargeError, 415: UnsupportedFileTypeError, 502: StorageUnavailableError }

const attachmentsPath = (idrId, reportId) => `/v1/idrs/${idrId}/reports/${reportId}/attachments`

/**
 * apiFetch, with 413/415/502 responses rethrown as the matching typed error (keeping the backend's message).
 * Every other error passes through unchanged.
 */
async function attachmentFetch(path, options) {
  try {
    return await apiFetch(path, options)
  } catch (err) {
    const TypedError = TYPED_ERRORS_BY_STATUS[err.status]
    if (!TypedError) throw err
    throw new TypedError(err.message, { status: err.status, body: err.body })
  }
}

/**
 * Checks a File against the backend's upload rules before anything is sent.
 * Returns null if it can be uploaded, otherwise the error it fails with
 * (AttachmentValidationError for an empty file, FileTooLargeError or UnsupportedFileTypeError).
 */
export function validateFileForUpload(file) {
  if (!file) return new AttachmentValidationError('Choose a file to upload.')
  if (file.size <= 0) return new AttachmentValidationError('File is empty.')
  if (file.size > MAX_FILE_SIZE_BYTES) return new FileTooLargeError()
  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) return new UnsupportedFileTypeError()
  return null
}

// Same rules as the backend: both fields required, checked after trimming. Returns null or an AttachmentValidationError.
function validateMetadata(name, description) {
  const trimmedName = (name ?? '').trim()
  const trimmedDescription = (description ?? '').trim()
  if (!trimmedName) return new AttachmentValidationError('Name is required.')
  if (trimmedName.length > MAX_ATTACHMENT_NAME_LENGTH) {
    return new AttachmentValidationError(`Name must be at most ${MAX_ATTACHMENT_NAME_LENGTH} characters.`)
  }
  if (!trimmedDescription) return new AttachmentValidationError('Description is required.')
  if (trimmedDescription.length > MAX_ATTACHMENT_DESCRIPTION_LENGTH) {
    return new AttachmentValidationError(
      `Description must be at most ${MAX_ATTACHMENT_DESCRIPTION_LENGTH} characters.`
    )
  }
  return null
}

/**
 * PUTs the File straight to Storage's signed upload URL with the headers the backend asked for.
 * The File is the body as-is, so the browser streams it instead of copying it into memory.
 * Throws StorageUnavailableError on a network failure or a non-2xx response (raw status on storageStatus).
 */
async function putToSignedUrl(url, file, headers) {
  let res
  try {
    res = await fetch(url, { method: 'PUT', headers, body: file })
  } catch {
    throw new StorageUnavailableError('Could not reach file storage. Please try again.')
  }
  if (!res.ok) {
    const error = new StorageUnavailableError(`File storage rejected the upload (HTTP ${res.status}). Please try again.`)
    error.storageStatus = res.status
    throw error
  }
}

/**
 * Uploads a file to a report on a draft IDR: upload-request → PUT to the signed URL → upload-complete.
 * Takes the File, the uploader's uuid, the attachment name and description, and an optional
 * onProgress({step: 'requesting'|'uploading'|'completing'|'done', percent}) callback. fetch can't
 * measure upload progress, so percent is only set (to 100) on 'done'; show a spinner for the other steps.
 * Returns the uploaded attachment's metadata (same shape as one listAttachments item).
 * If the PUT fails, the pending attachment is deleted (best-effort) and the original error is rethrown.
 * If upload-complete fails, nothing is deleted (the file is already stored); the error carries attachmentId.
 */
export async function uploadAttachment(idrId, reportId, { file, uploadedBy, name, description, onProgress = () => {} }) {
  const invalid = validateFileForUpload(file) || validateMetadata(name, description)
  if (invalid) throw invalid

  const path = attachmentsPath(idrId, reportId)

  onProgress({ step: 'requesting' })
  const request = await attachmentFetch(`${path}/upload-request`, {
    method: 'POST',
    body: {
      uploaded_by: uploadedBy,
      file_name: file.name,
      file_type: file.type.toLowerCase(),
      file_size_bytes: file.size,
      attachment_name: name,
      attachment_description: description,
    },
  })
  const { attachment_id: attachmentId, upload_url: uploadUrl, upload_headers: uploadHeaders } = request.data

  onProgress({ step: 'uploading' })
  try {
    await putToSignedUrl(uploadUrl, file, uploadHeaders)
  } catch (err) {
    try {
      await deleteAttachment(idrId, reportId, attachmentId)
    } catch (cleanupErr) {
      console.warn(`Could not clean up pending attachment ${attachmentId} after a failed upload:`, cleanupErr)
    }
    throw err
  }

  onProgress({ step: 'completing' })
  let completed
  try {
    completed = await attachmentFetch(`${path}/upload-complete`, { method: 'POST', body: { attachment_id: attachmentId } })
  } catch (err) {
    err.attachmentId = attachmentId
    throw err
  }

  onProgress({ step: 'done', percent: 100 })
  return completed.data
}

/**
 * Lists a report's uploaded attachments, oldest first; works on draft and submitted IDRs.
 * Returns an array of {attachment_id, file_name, file_type, file_size_bytes, uploaded_by, uploaded_at,
 * attachment_name, attachment_description}.
 */
export async function listAttachments(idrId, reportId) {
  const json = await attachmentFetch(attachmentsPath(idrId, reportId))
  return json.data
}

/**
 * Gets a fresh signed URL for viewing or downloading one attachment. The URL expires after about 5 minutes,
 * so fetch a new one each time instead of caching it. Returns {download_url, expires_at}.
 */
export async function getDownloadUrl(idrId, reportId, attachmentId) {
  const json = await attachmentFetch(`${attachmentsPath(idrId, reportId)}/${attachmentId}/download-url`)
  return json.data
}

/**
 * Replaces an attachment's name and description on a draft IDR (both required). The file itself is unchanged.
 * Returns the updated attachment. Throws AttachmentValidationError before sending if either field is invalid;
 * a 409 means the IDR was submitted.
 */
export async function updateAttachmentMetadata(idrId, reportId, attachmentId, { name, description }) {
  const invalid = validateMetadata(name, description)
  if (invalid) throw invalid

  const json = await attachmentFetch(`${attachmentsPath(idrId, reportId)}/${attachmentId}`, {
    method: 'PUT',
    body: { attachment_name: name, attachment_description: description },
  })
  return json.data
}

/**
 * Deletes an attachment (pending or uploaded) and its stored file from a report on a draft IDR.
 * Resolves with nothing; a 409 means the IDR was submitted.
 */
export async function deleteAttachment(idrId, reportId, attachmentId) {
  await attachmentFetch(`${attachmentsPath(idrId, reportId)}/${attachmentId}`, { method: 'DELETE' })
}
