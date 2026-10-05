import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  StorageUnavailableError,
  FileTooLargeError,
  UnsupportedFileTypeError,
  AttachmentValidationError,
  validateFileForUpload,
  uploadAttachment,
  listAttachments,
  getDownloadUrl,
  updateAttachmentMetadata,
  deleteAttachment,
} from '../attachments'
import { mockFetch, mockFetchNoContent, mockFetchSequence, fetchUrl, fetchInit } from '../../test/mockFetch'
import { TEST_USER_ID } from '../../test/users'

const IDR_ID = '5a0e8c1d-0000-4000-8000-00000000000a'
const REPORT_ID = '9b1c2f3e-0000-4000-8000-000000000001'
const ATTACHMENT_ID = 'c3d4e5f6-0000-4000-8000-0000000000a1'
const UPLOADER_UUID = TEST_USER_ID
const BASE = `/v1/idrs/${IDR_ID}/reports/${REPORT_ID}/attachments`
const UPLOAD_URL = 'https://storage.example.com/upload/sign/report-attachments/x?token=abc'

const MOCK_ATTACHMENT = {
  attachment_id: ATTACHMENT_ID,
  file_name: 'crack.jpg',
  file_type: 'image/jpeg',
  file_size_bytes: 4,
  uploaded_by: UPLOADER_UUID,
  uploaded_at: '2026-09-28T13:00:00Z',
  attachment_name: 'Crack at curb',
  attachment_description: 'North side, station 12+50',
}

const UPLOAD_REQUEST_DATA = {
  ...MOCK_ATTACHMENT,
  storage_path: `${REPORT_ID}/${ATTACHMENT_ID}_crack.jpg`,
  upload_url: UPLOAD_URL,
  upload_url_expires_at: '2026-09-28T15:00:00Z',
  upload_headers: { 'Content-Type': 'image/jpeg' },
}

const ok = data => ({ status: 'success', message: 'ok', data })
const jpeg = () => new File(['abcd'], 'crack.jpg', { type: 'image/jpeg' })
const uploadArgs = overrides => ({
  file: jpeg(),
  name: 'Crack at curb',
  description: 'North side, station 12+50',
  ...overrides,
})

beforeEach(() => {
  vi.restoreAllMocks()
})

const fetchCall = i => ({ url: new URL(fetch.mock.calls[i][0]), init: fetch.mock.calls[i][1] })

describe('constants', () => {
  it('limits files to 10 MB and the backend allowlist (no SVG)', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024)
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf')
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg')
    expect(ALLOWED_MIME_TYPES).not.toContain('image/svg+xml')
  })
})

describe('validateFileForUpload', () => {
  it('returns null for an allowed file under the limit', () => {
    expect(validateFileForUpload(jpeg())).toBeNull()
    expect(validateFileForUpload(new File(['%PDF'], 'plan.pdf', { type: 'application/pdf' }))).toBeNull()
  })

  it('accepts a file exactly at the limit and rejects one byte over with FileTooLargeError (413)', () => {
    expect(validateFileForUpload({ name: 'a.jpg', type: 'image/jpeg', size: MAX_FILE_SIZE_BYTES })).toBeNull()
    const err = validateFileForUpload({ name: 'a.jpg', type: 'image/jpeg', size: MAX_FILE_SIZE_BYTES + 1 })
    expect(err).toBeInstanceOf(FileTooLargeError)
    expect(err.status).toBe(413)
  })

  it('rejects SVG, unknown and empty MIME types with UnsupportedFileTypeError (415)', () => {
    for (const type of ['image/svg+xml', 'text/plain', '']) {
      const err = validateFileForUpload({ name: 'x', type, size: 10 })
      expect(err).toBeInstanceOf(UnsupportedFileTypeError)
      expect(err.status).toBe(415)
    }
  })

  it('matches MIME types case-insensitively', () => {
    expect(validateFileForUpload({ name: 'a.jpg', type: 'IMAGE/JPEG', size: 10 })).toBeNull()
  })

  it('rejects an empty or missing file with AttachmentValidationError', () => {
    expect(validateFileForUpload({ name: 'a.jpg', type: 'image/jpeg', size: 0 })).toBeInstanceOf(AttachmentValidationError)
    expect(validateFileForUpload(null)).toBeInstanceOf(AttachmentValidationError)
  })
})

describe('uploadAttachment', () => {
  it('requests an upload, PUTs the File to the signed URL, completes it and returns the attachment', async () => {
    mockFetchSequence([[201, ok(UPLOAD_REQUEST_DATA)], [200, undefined], [200, ok(MOCK_ATTACHMENT)]])
    const file = jpeg()

    const result = await uploadAttachment(IDR_ID, REPORT_ID, uploadArgs({ file }))

    expect(result).toEqual(MOCK_ATTACHMENT)
    expect(fetch).toHaveBeenCalledTimes(3)

    const request = fetchCall(0)
    expect(request.url.pathname).toBe(`${BASE}/upload-request`)
    expect(request.init.method).toBe('POST')
    // no uploader: the backend takes it from the session
    expect(JSON.parse(request.init.body)).toEqual({
      file_name: 'crack.jpg',
      file_type: 'image/jpeg',
      file_size_bytes: 4,
      attachment_name: 'Crack at curb',
      attachment_description: 'North side, station 12+50',
    })

    const [putUrl, putInit] = fetch.mock.calls[1]
    expect(putUrl).toBe(UPLOAD_URL)
    expect(putInit).toEqual({ method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: file })

    const complete = fetchCall(2)
    expect(complete.url.pathname).toBe(`${BASE}/upload-complete`)
    expect(complete.init.method).toBe('POST')
    expect(JSON.parse(complete.init.body)).toEqual({ attachment_id: ATTACHMENT_ID })
  })

  it('reports each step, with a percent only on done', async () => {
    mockFetchSequence([[201, ok(UPLOAD_REQUEST_DATA)], [200, undefined], [200, ok(MOCK_ATTACHMENT)]])
    const onProgress = vi.fn()

    await uploadAttachment(IDR_ID, REPORT_ID, uploadArgs({ onProgress }))

    expect(onProgress.mock.calls.map(([p]) => p)).toEqual([
      { step: 'requesting' },
      { step: 'uploading' },
      { step: 'completing' },
      { step: 'done', percent: 100 },
    ])
  })

  it('throws a validation error without calling the API for a bad file or blank metadata', async () => {
    global.fetch = vi.fn()
    await expect(uploadAttachment(IDR_ID, REPORT_ID, uploadArgs({ file: { name: 'a.svg', type: 'image/svg+xml', size: 5 } })))
      .rejects.toBeInstanceOf(UnsupportedFileTypeError)
    await expect(uploadAttachment(IDR_ID, REPORT_ID, uploadArgs({ name: '   ' })))
      .rejects.toThrow(AttachmentValidationError)
    await expect(uploadAttachment(IDR_ID, REPORT_ID, uploadArgs({ description: '' })))
      .rejects.toThrow('Description is required.')
    await expect(uploadAttachment(IDR_ID, REPORT_ID, uploadArgs({ name: 'x'.repeat(201) })))
      .rejects.toThrow(AttachmentValidationError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('surfaces a 409 from upload-request (IDR submitted) with its message, and cleans nothing up', async () => {
    mockFetch(409, { detail: 'Only draft IDRs can be edited' })
    await expect(uploadAttachment(IDR_ID, REPORT_ID, uploadArgs()))
      .rejects.toMatchObject({ message: 'Only draft IDRs can be edited', status: 409 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('turns a backend 502 into StorageUnavailableError, 413 into FileTooLargeError and 415 into UnsupportedFileTypeError', async () => {
    mockFetch(502, { detail: 'Could not create an upload link' })
    const storageErr = await uploadAttachment(IDR_ID, REPORT_ID, uploadArgs()).catch(e => e)
    expect(storageErr).toBeInstanceOf(StorageUnavailableError)
    expect(storageErr).toMatchObject({ message: 'Could not create an upload link', status: 502 })

    mockFetch(413, { detail: 'File is larger than the 10 MB limit' })
    await expect(uploadAttachment(IDR_ID, REPORT_ID, uploadArgs())).rejects.toBeInstanceOf(FileTooLargeError)

    mockFetch(415, { detail: 'Unsupported file type.' })
    await expect(uploadAttachment(IDR_ID, REPORT_ID, uploadArgs())).rejects.toBeInstanceOf(UnsupportedFileTypeError)
  })

  it('deletes the pending attachment and throws StorageUnavailableError when storage rejects the PUT', async () => {
    mockFetchSequence([[201, ok(UPLOAD_REQUEST_DATA)], [403, undefined], [204, undefined]])

    const err = await uploadAttachment(IDR_ID, REPORT_ID, uploadArgs()).catch(e => e)

    expect(err).toBeInstanceOf(StorageUnavailableError)
    expect(err.storageStatus).toBe(403)
    const cleanup = fetchCall(2)
    expect(cleanup.url.pathname).toBe(`${BASE}/${ATTACHMENT_ID}`)
    expect(cleanup.init.method).toBe('DELETE')
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('deletes the pending attachment when storage is unreachable', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 201, text: () => Promise.resolve(JSON.stringify(ok(UPLOAD_REQUEST_DATA))) })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, status: 204, text: () => Promise.resolve('') })

    await expect(uploadAttachment(IDR_ID, REPORT_ID, uploadArgs())).rejects.toBeInstanceOf(StorageUnavailableError)
    expect(fetchCall(2).init.method).toBe('DELETE')
  })

  it('warns and rethrows the original PUT error when cleanup also fails', async () => {
    mockFetchSequence([[201, ok(UPLOAD_REQUEST_DATA)], [500, undefined], [500, { detail: 'Failed to delete attachment' }]])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const err = await uploadAttachment(IDR_ID, REPORT_ID, uploadArgs()).catch(e => e)

    expect(err).toBeInstanceOf(StorageUnavailableError)
    expect(err.storageStatus).toBe(500)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain(ATTACHMENT_ID)
  })

  it('does not delete anything when upload-complete fails; the error carries the attachment id', async () => {
    mockFetchSequence([[201, ok(UPLOAD_REQUEST_DATA)], [200, undefined], [500, { detail: 'Failed to complete upload' }]])

    const err = await uploadAttachment(IDR_ID, REPORT_ID, uploadArgs()).catch(e => e)

    expect(err).toMatchObject({ message: 'Failed to complete upload', status: 500, attachmentId: ATTACHMENT_ID })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetchCall(2).url.pathname).toBe(`${BASE}/upload-complete`)
  })
})

describe('listAttachments', () => {
  it('GETs the report attachments and returns the data array', async () => {
    mockFetch(200, ok([MOCK_ATTACHMENT]))
    expect(await listAttachments(IDR_ID, REPORT_ID)).toEqual([MOCK_ATTACHMENT])
    expect(fetchUrl().pathname).toBe(BASE)
    expect(fetchInit().method).toBe('GET')
  })

  it('throws the backend message on 404', async () => {
    mockFetch(404, { detail: 'Report not found in this IDR' })
    await expect(listAttachments(IDR_ID, REPORT_ID)).rejects.toMatchObject({ message: 'Report not found in this IDR', status: 404 })
  })
})

describe('getDownloadUrl', () => {
  it('GETs the download-url endpoint and returns {download_url, expires_at}', async () => {
    const data = { download_url: 'https://storage.example.com/sign/x?token=t', expires_at: '2026-09-28T13:05:00Z' }
    mockFetch(200, ok(data))
    expect(await getDownloadUrl(IDR_ID, REPORT_ID, ATTACHMENT_ID)).toEqual(data)
    expect(fetchUrl().pathname).toBe(`${BASE}/${ATTACHMENT_ID}/download-url`)
  })

  it('throws StorageUnavailableError on 502', async () => {
    mockFetch(502, { detail: 'Could not create a download link' })
    await expect(getDownloadUrl(IDR_ID, REPORT_ID, ATTACHMENT_ID)).rejects.toBeInstanceOf(StorageUnavailableError)
  })
})

describe('updateAttachmentMetadata', () => {
  it('PUTs the name and description and returns the updated attachment', async () => {
    const updated = { ...MOCK_ATTACHMENT, attachment_name: 'Renamed' }
    mockFetch(200, ok(updated))
    const result = await updateAttachmentMetadata(IDR_ID, REPORT_ID, ATTACHMENT_ID, {
      name: 'Renamed',
      description: 'North side, station 12+50',
    })
    expect(result).toEqual(updated)
    expect(fetchUrl().pathname).toBe(`${BASE}/${ATTACHMENT_ID}`)
    expect(fetchInit().method).toBe('PUT')
    expect(JSON.parse(fetchInit().body)).toEqual({
      attachment_name: 'Renamed',
      attachment_description: 'North side, station 12+50',
    })
  })

  it('throws AttachmentValidationError without calling the API for blank or too-long fields', async () => {
    global.fetch = vi.fn()
    await expect(updateAttachmentMetadata(IDR_ID, REPORT_ID, ATTACHMENT_ID, { name: '', description: 'd' }))
      .rejects.toBeInstanceOf(AttachmentValidationError)
    await expect(updateAttachmentMetadata(IDR_ID, REPORT_ID, ATTACHMENT_ID, { name: 'n', description: 'x'.repeat(2001) }))
      .rejects.toBeInstanceOf(AttachmentValidationError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws the backend message on 409 (IDR submitted)', async () => {
    mockFetch(409, { detail: 'Only draft IDRs can be edited' })
    await expect(updateAttachmentMetadata(IDR_ID, REPORT_ID, ATTACHMENT_ID, { name: 'n', description: 'd' }))
      .rejects.toMatchObject({ message: 'Only draft IDRs can be edited', status: 409 })
  })
})

describe('deleteAttachment', () => {
  it('DELETEs the attachment and resolves with nothing on 204', async () => {
    mockFetchNoContent()
    await expect(deleteAttachment(IDR_ID, REPORT_ID, ATTACHMENT_ID)).resolves.toBeUndefined()
    expect(fetchUrl().pathname).toBe(`${BASE}/${ATTACHMENT_ID}`)
    expect(fetchInit().method).toBe('DELETE')
  })

  it('throws the backend message on 409 (IDR submitted)', async () => {
    mockFetch(409, { detail: 'Only draft IDRs can be edited' })
    await expect(deleteAttachment(IDR_ID, REPORT_ID, ATTACHMENT_ID))
      .rejects.toMatchObject({ message: 'Only draft IDRs can be edited', status: 409 })
  })
})
