import { apiFetch } from './apiClient'
import { SIGNATURE_MAX_BYTES } from '../lib/signatureImage'

const PNG = 'image/png'

/**
 * Checks a file before it is uploaded as a signature. Takes the File (or Blob).
 * Returns null if it can be uploaded, otherwise the message to show: it must be a PNG of at most 500 KB.
 */
export function validateSignatureFile(file) {
  if (file.type !== PNG) return 'The signature must be a PNG image.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > SIGNATURE_MAX_BYTES) return 'The signature image must be 500 KB or smaller.'
  return null
}

/**
 * Starts setting the signed-in user's signature.
 * Returns {upload_url, storage_path, expires_in}: a signed URL to PUT the PNG to.
 */
export async function requestSignatureUpload() {
  return apiFetch('/v1/signatures/upload-request', { method: 'POST', body: { content_type: PNG } })
}

/**
 * PUTs the signature PNG straight to Storage's signed upload URL (not through the API; the URL is the credential).
 * It replaces the user's current signature file. Takes the URL and the PNG Blob.
 * Throws with a readable message on a network failure or a non-2xx response (raw status on error.storageStatus).
 */
export async function uploadSignaturePng(url, blob) {
  let res
  try {
    res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': PNG, 'x-upsert': 'true' }, body: blob })
  } catch {
    throw new Error('Could not reach file storage. Please try again.')
  }
  if (!res.ok) {
    const error = new Error(`File storage rejected the signature (HTTP ${res.status}). Please try again.`)
    error.storageStatus = res.status
    throw error
  }
}

/**
 * Records the uploaded file as the user's signature. signatureType is 'drawn' or 'uploaded'.
 * Returns the updated user ({..., has_signature: true, signature_set_at}).
 */
export async function confirmSignatureUpload(signatureType) {
  return apiFetch('/v1/signatures/confirm', { method: 'POST', body: { signature_type: signatureType } })
}

/**
 * Sets the signed-in user's signature in one go: upload-request → PUT to the signed URL → confirm.
 * Takes the PNG Blob and how it was made ('drawn' or 'uploaded'). Returns the updated user.
 * Throws whichever step failed; nothing is recorded unless all three succeed.
 */
export async function saveSignature(blob, signatureType) {
  const invalid = validateSignatureFile(blob)
  if (invalid) throw new Error(invalid)
  const { upload_url: uploadUrl } = await requestSignatureUpload()
  await uploadSignaturePng(uploadUrl, blob)
  return confirmSignatureUpload(signatureType)
}
