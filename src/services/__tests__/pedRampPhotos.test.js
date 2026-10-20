import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  completePhotoUpload, deletePhoto, listPhotos, nextPhotoNumber, photoContentType, photoCount, putPhotoFile,
  requestPhotoUpload, updatePhoto, uploadPhoto, validatePhotoFile,
} from '../pedRampPhotos'
import { mockFetch, mockFetchNoContent, mockFetchSequence, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const INSPECTION = { type: 'inspection', id: 'e0000000-0000-4000-8000-000000000001' }
const TIF = { type: 'tif', id: 'f0000000-0000-4000-8000-000000000001' }
const RAMP_ID = 'a0000000-0000-4000-8000-000000000009'
const PHOTO_ID = 'b0000000-0000-4000-8000-000000000001'
const UPLOAD = { upload_url: 'https://storage.example/upload/abc?token=t', staging_path: `staging/${INSPECTION.id}/abc.heic`, expires_at: '2026-10-21T13:00:00Z' }
const PHOTO = { id: PHOTO_ID, kind: 'photo', photo_number: 3, caption: 'North', image_url: 'https://s/p.jpg' }

const file = (name, type, size = 1024) => new File([new Uint8Array(size)], name, { type })

describe('the photo checks', () => {
  it('sends a JPEG, PNG or HEIC as its declared type, or as its extension names one', () => {
    expect(photoContentType(file('a.jpg', 'image/jpeg'))).toBe('image/jpeg')
    expect(photoContentType(file('IMG_1.HEIC', ''))).toBe('image/heic')
    expect(photoContentType(file('IMG_1.heif', 'image/heif'))).toBe('image/heic')
    expect(photoContentType(file('a.gif', 'image/gif'))).toBeNull()
  })

  it('refuses another type, an empty file and one over 10 MB', () => {
    expect(validatePhotoFile(file('a.png', 'image/png'))).toBeNull()
    expect(validatePhotoFile(file('a.pdf', 'application/pdf'))).toBe('Upload a JPEG, PNG or HEIC photo.')
    expect(validatePhotoFile(file('a.png', 'image/png', 0))).toBe('That file is empty.')
    expect(validatePhotoFile(file('a.png', 'image/png', 10 * 1024 * 1024 + 1))).toBe('Photo too large: at most 10 MB')
  })

  it('counts every photo and numbers a new one with the lowest free number, the layout aside', () => {
    const photos = [{ kind: 'photo', photo_number: 1 }, { kind: 'photo', photo_number: 3 }, { kind: 'layout', photo_number: 1 }]
    expect(photoCount(photos)).toBe(3)
    expect(nextPhotoNumber(photos)).toBe(2)
    expect(nextPhotoNumber([])).toBe(1)
  })
})

describe('the photo calls', () => {
  it("lists an inspection's and a TIF's photos", async () => {
    mockFetch(200, { data: [PHOTO] })
    expect(await listPhotos(INSPECTION)).toEqual([PHOTO])
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-inspections/${INSPECTION.id}/photos`)
    mockFetch(200, { data: [] })
    await listPhotos(TIF)
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-tifs/${TIF.id}/photos`)
  })

  it('asks for an upload with the ramp, or for a TIF with the kind', async () => {
    mockFetch(200, { data: UPLOAD })
    expect(await requestPhotoUpload(INSPECTION, { propertyId: RAMP_ID, fileName: 'IMG_1.HEIC' })).toEqual(UPLOAD)
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-inspections/${INSPECTION.id}/photos/upload-request`)
    expect(JSON.parse(fetchInit().body)).toEqual({ property_id: RAMP_ID, file_name: 'IMG_1.HEIC' })
    mockFetch(200, { data: UPLOAD })
    await requestPhotoUpload(TIF, { fileName: 'site.png', kind: 'layout' })
    expect(JSON.parse(fetchInit().body)).toEqual({ file_name: 'site.png', kind: 'layout' })
  })

  it('PUTs the file to Storage and says when it fails', async () => {
    const photo = file('a.jpg', 'image/jpeg')
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    await putPhotoFile(UPLOAD.upload_url, photo, 'image/jpeg')
    expect(fetch).toHaveBeenCalledWith(UPLOAD.upload_url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: photo })
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 413 })
    await expect(putPhotoFile(UPLOAD.upload_url, photo, 'image/jpeg')).rejects.toMatchObject({ storageStatus: 413 })
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(putPhotoFile(UPLOAD.upload_url, photo, 'image/jpeg')).rejects.toThrow('Could not reach file storage')
  })

  it('completes an inspection photo, a TIF photo and a layout', async () => {
    mockFetch(201, { data: PHOTO })
    expect(await completePhotoUpload(INSPECTION, { stagingPath: 's', propertyId: RAMP_ID, photoNumber: 3, caption: 'North' })).toEqual(PHOTO)
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-inspections/${INSPECTION.id}/photos`)
    expect(JSON.parse(fetchInit().body)).toEqual({ storage_path: 's', caption: 'North', property_id: RAMP_ID, photo_number: 3 })
    mockFetch(201, { data: PHOTO })
    await completePhotoUpload(TIF, { stagingPath: 's', photoNumber: 2, caption: '' })
    expect(JSON.parse(fetchInit().body)).toEqual({ storage_path: 's', caption: null, kind: 'photo', photo_number: 2 })
    mockFetch(201, { data: PHOTO })
    await completePhotoUpload(TIF, { stagingPath: 's', kind: 'layout' })
    expect(JSON.parse(fetchInit().body)).toEqual({ storage_path: 's', caption: null, kind: 'layout' })
  })

  it('uploads in three steps, and throws the backend refusal', async () => {
    const photo = file('IMG_1.HEIC', '')
    mockFetchSequence([[200, { data: UPLOAD }], [200, {}], [201, { data: PHOTO }]])
    expect(await uploadPhoto(INSPECTION, photo, { propertyId: RAMP_ID, photoNumber: 3 })).toEqual(PHOTO)
    expect(fetch.mock.calls[1][0]).toBe(UPLOAD.upload_url)
    expect(fetch.mock.calls[1][1].headers).toEqual({ 'Content-Type': 'image/heic' })
    expect(JSON.parse(fetch.mock.calls[2][1].body).storage_path).toBe(UPLOAD.staging_path)

    mockFetchSequence([[200, { data: UPLOAD }], [200, {}], [409, { detail: 'Photo number 3 is already used on this form' }]])
    await expect(uploadPhoto(INSPECTION, photo, { propertyId: RAMP_ID, photoNumber: 3 })).rejects.toMatchObject({
      status: 409, message: 'Photo number 3 is already used on this form',
    })
  })

  it('edits and deletes a photo', async () => {
    mockFetch(200, { data: { ...PHOTO, photo_number: 4 } })
    await updatePhoto(PHOTO_ID, { photo_number: 4 })
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-photos/${PHOTO_ID}`)
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ photo_number: 4 })
    mockFetchNoContent()
    await deletePhoto(PHOTO_ID)
    expect(fetchInit().method).toBe('DELETE')
  })
})
