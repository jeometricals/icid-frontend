import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  completePirUpload, deletePirPages, listPirPages, nextRotation, pirFileTypeOf, putPirFile, requestPirUpload,
  setPirPageRotation, setPirPageScale, uploadPir, validatePirFile,
} from '../pirPages'
import { mockFetch, mockFetchNoContent, mockFetchSequence, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const PIR_ID = 'e0000000-0000-4000-8000-000000000001'
const PAGE_ID = 'f0000000-0000-4000-8000-000000000001'
const UPLOAD = { upload_url: 'https://storage.example/upload/abc?token=t', staging_path: `staging/${PIR_ID}/abc.pdf`, expires_at: '2026-10-14T13:00:00Z' }
const PAGE = { pir_page_id: PAGE_ID, pir_id: PIR_ID, page_number: 1, image_url: 'https://s/p1.png', width_px: 1200, height_px: 900, scale_px_per_ft: 15, rotation_deg: 0 }
const PIR = { id: PIR_ID, pages: [PAGE] }

const file = (name, type, size = 1024) => new File([new Uint8Array(size)], name, { type })

describe('the file checks', () => {
  it('sends a PDF, PNG or JPEG as its declared type, or as its extension names one', () => {
    expect(pirFileTypeOf(file('sheet.pdf', 'application/pdf'))).toBe('application/pdf')
    expect(pirFileTypeOf(file('sheet.JPG', ''))).toBe('image/jpeg')
    expect(pirFileTypeOf(file('sheet.gif', 'image/gif'))).toBeNull()
  })

  it('refuses another type, an empty file and one over 10 MB', () => {
    expect(validatePirFile(file('sheet.png', 'image/png'))).toBeNull()
    expect(validatePirFile(file('sheet.gif', 'image/gif'))).toBe('The PIR must be a PDF, PNG or JPG.')
    expect(validatePirFile(file('sheet.png', 'image/png', 0))).toBe('That file is empty.')
    expect(validatePirFile(file('sheet.png', 'image/png', 10 * 1024 * 1024 + 1))).toBe('The PIR file must be 10 MB or smaller.')
  })

  it('turns a page a quarter at a time, back to 0 after 270', () => {
    expect([0, 90, 180, 270].map(nextRotation)).toEqual([90, 180, 270, 0])
  })
})

describe('the three upload steps', () => {
  it('asks for an upload URL with the file\'s mime, name and size', async () => {
    mockFetch(200, { data: UPLOAD })
    expect(await requestPirUpload(PIR_ID, file('sheet.pdf', 'application/pdf', 2048))).toEqual(UPLOAD)
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/image/upload-request`)
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({ mime: 'application/pdf', filename: 'sheet.pdf', size_bytes: 2048 })
  })

  it('PUTs the file straight to the signed URL with its type, and says so when Storage refuses', async () => {
    const pdf = file('sheet.pdf', 'application/pdf')
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    await putPirFile(UPLOAD.upload_url, pdf, 'application/pdf')
    expect(fetch).toHaveBeenCalledWith(UPLOAD.upload_url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: pdf })

    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 413 })
    await expect(putPirFile(UPLOAD.upload_url, pdf, 'application/pdf')).rejects.toMatchObject({ storageStatus: 413 })
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(putPirFile(UPLOAD.upload_url, pdf, 'application/pdf')).rejects.toThrow('Could not reach file storage')
  })

  it('completes with the staging path and the scale, or the path alone when there is no scale', async () => {
    mockFetch(200, { data: PIR })
    expect(await completePirUpload(PIR_ID, UPLOAD.staging_path, 20)).toEqual(PIR)
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/image/complete`)
    expect(JSON.parse(fetchInit().body)).toEqual({ staging_path: UPLOAD.staging_path, scale_px_per_ft: 20 })

    mockFetch(200, { data: PIR })
    await completePirUpload(PIR_ID, UPLOAD.staging_path)
    expect(JSON.parse(fetchInit().body)).toEqual({ staging_path: UPLOAD.staging_path })
  })
})

describe('uploadPir', () => {
  it('runs request, PUT and complete in turn, naming each step', async () => {
    mockFetchSequence([[200, { data: UPLOAD }], [200, ''], [200, { data: PIR }]])
    const steps = []
    const pdf = file('sheet.pdf', 'application/pdf')
    expect(await uploadPir(PIR_ID, pdf, { scale: 20, onProgress: ({ step }) => steps.push(step) })).toEqual(PIR)
    expect(steps).toEqual(['requesting', 'uploading', 'rendering'])
    const [request, put, complete] = fetch.mock.calls
    expect(new URL(request[0]).pathname).toBe(`/v1/pirs/${PIR_ID}/image/upload-request`)
    expect(put[0]).toBe(UPLOAD.upload_url)
    expect(put[1].method).toBe('PUT')
    expect(new URL(complete[0]).pathname).toBe(`/v1/pirs/${PIR_ID}/image/complete`)
    expect(JSON.parse(complete[1].body)).toEqual({ staging_path: UPLOAD.staging_path, scale_px_per_ft: 20 })
  })

  it('refuses a file it can\'t send before asking anything', async () => {
    global.fetch = vi.fn()
    await expect(uploadPir(PIR_ID, file('sheet.gif', 'image/gif'))).rejects.toThrow('The PIR must be a PDF, PNG or JPG.')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws complete\'s refusal with its status', async () => {
    mockFetchSequence([[200, { data: UPLOAD }], [200, ''], [400, { detail: 'The PDF has 16 pages; a PIR can have at most 15' }]])
    await expect(uploadPir(PIR_ID, file('sheet.pdf', 'application/pdf'))).rejects.toMatchObject({ status: 400 })
  })
})

describe('pages', () => {
  it('lists a PIR\'s pages', async () => {
    mockFetch(200, { data: [PAGE] })
    expect(await listPirPages(PIR_ID)).toEqual([PAGE])
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/pages`)
  })

  it('DELETEs a PIR\'s pages', async () => {
    mockFetchNoContent()
    expect(await deletePirPages(PIR_ID)).toBeUndefined()
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/pages`)
    expect(fetchInit().method).toBe('DELETE')
  })

  it('PATCHes one page\'s scale and returns the page', async () => {
    mockFetch(200, { data: { ...PAGE, scale_px_per_ft: 22.5 } })
    expect(await setPirPageScale(PAGE_ID, 22.5)).toMatchObject({ scale_px_per_ft: 22.5 })
    expect(fetchUrl().pathname).toBe(`/v1/pir-pages/${PAGE_ID}/scale`)
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ scale_px_per_ft: 22.5 })
  })

  it('PATCHes one page\'s rotation and returns the page', async () => {
    mockFetch(200, { data: { ...PAGE, rotation_deg: 90 } })
    expect(await setPirPageRotation(PAGE_ID, 90)).toMatchObject({ rotation_deg: 90 })
    expect(fetchUrl().pathname).toBe(`/v1/pir-pages/${PAGE_ID}/rotation`)
    expect(JSON.parse(fetchInit().body)).toEqual({ rotation_deg: 90 })
  })

  it('throws a refusal with its status', async () => {
    mockFetch(403, { detail: 'Demo mode: PIRs are read-only' })
    await expect(setPirPageRotation(PAGE_ID, 90)).rejects.toMatchObject({ status: 403 })
  })
})
