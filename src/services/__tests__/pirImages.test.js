import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  completePirImageUpload, getPirImageSignedUrl, pirImageTypeOf, putPirImageFile, removePirImage,
  requestPirImageUpload, uploadPirImage, validatePirImageFile,
} from '../pirImages'
import { mockFetch, mockFetchNoContent, mockFetchSequence, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const PIR_ID = 'e0000000-0000-4000-8000-000000000001'
const UPLOAD = { upload_url: 'https://storage.example/upload/abc?token=t', upload_path: `pirs/${PIR_ID}/uploads/abc`, expires_in: 7200 }
const PIR = { id: PIR_ID, source_image_url: `pirs/${PIR_ID}/image-1.png`, source_image_scale: 20,
  signed_url: 'https://storage.example/sign/x', expires_at: '2026-10-14T13:00:00Z' }
const LINK = { signed_url: 'https://storage.example/sign/x', expires_at: '2026-10-14T13:00:00Z', scale: 20 }

const file = (name, type, size = 1024) => new File([new Uint8Array(size)], name, { type })

describe('the file checks', () => {
  it('sends a PDF, PNG or JPEG as its declared type, or as its extension names one', () => {
    expect(pirImageTypeOf(file('sheet.pdf', 'application/pdf'))).toBe('application/pdf')
    expect(pirImageTypeOf(file('sheet.JPG', ''))).toBe('image/jpeg')
    expect(pirImageTypeOf(file('sheet.gif', 'image/gif'))).toBeNull()
  })

  it('refuses another type, an empty file and one over 10 MB', () => {
    expect(validatePirImageFile(file('sheet.png', 'image/png'))).toBeNull()
    expect(validatePirImageFile(file('sheet.gif', 'image/gif'))).toBe('The PIR image must be a PDF, PNG or JPG.')
    expect(validatePirImageFile(file('sheet.png', 'image/png', 0))).toBe('That file is empty.')
    expect(validatePirImageFile(file('sheet.png', 'image/png', 10 * 1024 * 1024 + 1))).toBe('The PIR image must be 10 MB or smaller.')
  })
})

describe('the three upload steps', () => {
  it('asks for an upload URL with the file\'s type', async () => {
    mockFetch(200, { data: UPLOAD })
    expect(await requestPirImageUpload(PIR_ID, 'application/pdf')).toEqual(UPLOAD)
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/image/upload-request`)
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({ content_type: 'application/pdf' })
  })

  it('PUTs the file straight to the signed URL with its type, and says so when Storage refuses', async () => {
    const pdf = file('sheet.pdf', 'application/pdf')
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    await putPirImageFile(UPLOAD.upload_url, pdf, 'application/pdf')
    expect(fetch).toHaveBeenCalledWith(UPLOAD.upload_url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: pdf })

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 413 })
    await expect(putPirImageFile(UPLOAD.upload_url, pdf, 'application/pdf')).rejects.toMatchObject({ storageStatus: 413 })
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(putPirImageFile(UPLOAD.upload_url, pdf, 'application/pdf')).rejects.toThrow('Could not reach file storage')
  })

  it('completes with the upload path and scale, and returns the PIR with its signed URL', async () => {
    mockFetch(200, { data: PIR })
    expect(await completePirImageUpload(PIR_ID, UPLOAD.upload_path, 20)).toEqual(PIR)
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/image/complete`)
    expect(JSON.parse(fetchInit().body)).toEqual({ upload_path: UPLOAD.upload_path, scale: 20 })
  })
})

describe('uploadPirImage', () => {
  it('runs request, PUT and complete in turn, naming each step', async () => {
    mockFetchSequence([[200, { data: UPLOAD }], [200, ''], [200, { data: PIR }]])
    const steps = []
    const png = file('sheet.png', 'image/png')
    expect(await uploadPirImage(PIR_ID, png, 20, { onProgress: ({ step }) => steps.push(step) })).toEqual(PIR)
    expect(steps).toEqual(['requesting', 'uploading', 'completing'])
    const [request, put, complete] = fetch.mock.calls
    expect(new URL(request[0]).pathname).toBe(`/v1/pirs/${PIR_ID}/image/upload-request`)
    expect(put[0]).toBe(UPLOAD.upload_url)
    expect(put[1].method).toBe('PUT')
    expect(new URL(complete[0]).pathname).toBe(`/v1/pirs/${PIR_ID}/image/complete`)
  })

  it('refuses a file it can\'t send before asking anything', async () => {
    global.fetch = vi.fn()
    await expect(uploadPirImage(PIR_ID, file('sheet.gif', 'image/gif'), 15)).rejects.toThrow('The PIR image must be a PDF, PNG or JPG.')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws complete\'s refusal with its status', async () => {
    mockFetchSequence([[200, { data: UPLOAD }], [200, ''], [413, { detail: 'File too large' }]])
    await expect(uploadPirImage(PIR_ID, file('sheet.png', 'image/png'), 15)).rejects.toMatchObject({ status: 413 })
  })
})

describe('removePirImage and getPirImageSignedUrl', () => {
  it('DELETEs the image', async () => {
    mockFetchNoContent()
    expect(await removePirImage(PIR_ID)).toBeUndefined()
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/image`)
    expect(fetchInit().method).toBe('DELETE')
  })

  it('GETs a signed link, or null when there is no image', async () => {
    mockFetch(200, { data: LINK })
    expect(await getPirImageSignedUrl(PIR_ID)).toEqual(LINK)
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/image`)
    mockFetch(404, { detail: 'No image for this PIR' })
    expect(await getPirImageSignedUrl(PIR_ID)).toBeNull()
  })

  it('throws any other refusal', async () => {
    mockFetch(502, { detail: 'Could not sign a URL' })
    await expect(getPirImageSignedUrl(PIR_ID)).rejects.toMatchObject({ status: 502, message: 'Could not sign a URL' })
  })
})
