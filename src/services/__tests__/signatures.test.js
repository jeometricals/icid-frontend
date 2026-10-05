import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  confirmSignatureUpload, requestSignatureUpload, saveSignature, uploadSignaturePng, validateSignatureFile,
} from '../signatures'
import * as api from '../api'
import * as signatures from '../signatures'
import { setToken } from '../session'
import { mockFetch, mockFetchFailure, fetchUrl, fetchInit } from '../../test/mockFetch'
import { TEST_USER } from '../../test/users'

const UPLOAD_URL = 'https://storage.example/object/upload/sign/signatures/users/u/signature.png?token=up'
const REQUEST = { upload_url: UPLOAD_URL, storage_path: 'users/u/signature.png', expires_in: 7200 }
const png = (bytes = 'png-bytes') => new Blob([bytes], { type: 'image/png' })

// Answers the three calls of a save in turn: [status, body] each; an undefined body is an empty response
function mockSteps(...steps) {
  global.fetch = vi.fn()
  for (const [status, body] of steps) {
    global.fetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
    })
  }
}

beforeEach(() => {
  localStorage.clear()
  setToken('token-abc')
})

describe('signatures service', () => {
  it('is re-exported from api.js', () => {
    for (const [name, fn] of Object.entries(signatures)) expect(api[name]).toBe(fn)
  })

  it('requestSignatureUpload POSTs the PNG content type and returns the signed URL', async () => {
    mockFetch(200, REQUEST)
    expect(await requestSignatureUpload()).toEqual(REQUEST)
    expect(fetchUrl().pathname).toBe('/v1/signatures/upload-request')
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({ content_type: 'image/png' })
    expect(fetchInit().headers.Authorization).toBe('Bearer token-abc')
  })

  it('uploadSignaturePng PUTs the blob straight to the signed URL, as a PNG that may replace the old one', async () => {
    mockFetch(200, {})
    const blob = png()
    await uploadSignaturePng(UPLOAD_URL, blob)
    expect(fetch).toHaveBeenCalledWith(UPLOAD_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png', 'x-upsert': 'true' },
      body: blob,
    })
    // the signed URL is the credential: the API token is not sent to Storage
    expect(fetchInit().headers.Authorization).toBeUndefined()
  })

  it('uploadSignaturePng turns a rejected upload into a readable error carrying the status', async () => {
    mockFetch(400, { error: 'invalid_mime_type' })
    const err = await uploadSignaturePng(UPLOAD_URL, png()).catch(e => e)
    expect(err.message).toBe('File storage rejected the signature (HTTP 400). Please try again.')
    expect(err.storageStatus).toBe(400)
  })

  it('uploadSignaturePng turns a network failure into a readable error', async () => {
    mockFetchFailure('Failed to fetch')
    await expect(uploadSignaturePng(UPLOAD_URL, png())).rejects.toThrow('Could not reach file storage. Please try again.')
  })

  it.each(['drawn', 'uploaded'])('confirmSignatureUpload records a %s signature and returns the user', async (type) => {
    mockFetch(200, { ...TEST_USER, has_signature: true })
    const user = await confirmSignatureUpload(type)
    expect(fetchUrl().pathname).toBe('/v1/signatures/confirm')
    expect(JSON.parse(fetchInit().body)).toEqual({ signature_type: type })
    expect(user.has_signature).toBe(true)
  })
})

describe('validateSignatureFile', () => {
  it('accepts a PNG of up to 500 KB', () => {
    expect(validateSignatureFile(png())).toBeNull()
    expect(validateSignatureFile(new Blob([new Uint8Array(512000)], { type: 'image/png' }))).toBeNull()
  })

  it.each([
    ['a JPEG', new Blob(['x'], { type: 'image/jpeg' }), 'The signature must be a PNG image.'],
    ['a PDF', new Blob(['x'], { type: 'application/pdf' }), 'The signature must be a PNG image.'],
    ['a file with no type', new Blob(['x']), 'The signature must be a PNG image.'],
    ['an empty file', new Blob([], { type: 'image/png' }), 'That file is empty.'],
    ['a file over 500 KB', new Blob([new Uint8Array(512001)], { type: 'image/png' }), 'The signature image must be 500 KB or smaller.'],
  ])('rejects %s', (_, file, message) => {
    expect(validateSignatureFile(file)).toBe(message)
  })
})

describe('saveSignature', () => {
  it('runs upload-request, the PUT and confirm in order and returns the updated user', async () => {
    mockSteps([200, REQUEST], [200, {}], [200, { ...TEST_USER, has_signature: true }])
    const blob = png()
    const user = await saveSignature(blob, 'drawn')
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(new URL(fetch.mock.calls[0][0]).pathname).toBe('/v1/signatures/upload-request')
    expect(fetch.mock.calls[1][0]).toBe(UPLOAD_URL)
    expect(fetch.mock.calls[1][1].body).toBe(blob)
    expect(new URL(fetch.mock.calls[2][0]).pathname).toBe('/v1/signatures/confirm')
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ signature_type: 'drawn' })
    expect(user.has_signature).toBe(true)
  })

  it('sends nothing for a file that would be refused', async () => {
    global.fetch = vi.fn()
    await expect(saveSignature(new Blob(['x'], { type: 'image/jpeg' }), 'uploaded'))
      .rejects.toThrow('The signature must be a PNG image.')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('stops at a failed upload request (e.g. a demo user) without uploading', async () => {
    mockSteps([403, { detail: 'Demo mode: signatures are not available' }])
    await expect(saveSignature(png(), 'drawn')).rejects.toMatchObject({
      status: 403, message: 'Demo mode: signatures are not available',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('stops at a failed PUT without confirming', async () => {
    mockSteps([200, REQUEST], [413, undefined])
    await expect(saveSignature(png(), 'drawn')).rejects.toThrow('File storage rejected the signature (HTTP 413)')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('surfaces a failed confirm', async () => {
    mockSteps([200, REQUEST], [200, {}], [400, { detail: 'Upload the signature before confirming' }])
    await expect(saveSignature(png(), 'uploaded')).rejects.toThrow('Upload the signature before confirming')
  })
})
