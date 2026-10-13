import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  clearProjectPayItems, commitPayItemImport, createProjectPayItem, deleteProjectPayItem, listProjectPayItems,
  previewPayItemImport, updateProjectPayItem,
} from '../payItems'
import { mockFetch, mockFetchNoContent, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const ITEM_UUID = 'b0000000-0000-4000-8000-000000000001'
const ITEM = { pay_item_uuid: ITEM_UUID, pay_item_ref: '4.13 AAS', description: '4" concrete sidewalk', unit: 'SF',
  quantity: 12500, unit_price: 9.5, budget_code: 'HW0001Q-CONS', spec_section: null }
const VALUES = { pay_item_ref: '4.13 AAS', description: '4" concrete sidewalk', unit: 'SF', quantity: 12500,
  unit_price: 9.5, budget_code: 'HW0001Q-CONS' }

describe('listProjectPayItems', () => {
  it('GETs the project\'s pay items and returns the data array', async () => {
    mockFetch(200, { status: 'success', data: [ITEM] })
    expect(await listProjectPayItems('HWS0023')).toEqual([ITEM])
    expect(fetchUrl().pathname).toBe('/v1/admin/projects/HWS0023/pay-items')
    expect(fetchInit().method).toBe('GET')
  })

  it('throws the backend message for an unknown project', async () => {
    mockFetch(404, { detail: 'Project not found' })
    await expect(listProjectPayItems('NOPE')).rejects.toMatchObject({ message: 'Project not found', status: 404 })
  })
})

describe('createProjectPayItem', () => {
  it('POSTs the item to the project\'s pay items and returns it', async () => {
    mockFetch(201, { data: ITEM })
    expect(await createProjectPayItem('HWS0023', VALUES)).toEqual(ITEM)
    expect(fetchUrl().pathname).toBe('/v1/admin/projects/HWS0023/pay-items')
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual(VALUES)
  })

  it('throws the backend message for a taken ref and budget code, with the item that has them', async () => {
    mockFetch(409, { detail: 'A pay item with this ref and budget code already exists for this project',
      existing_pay_item_uuid: ITEM_UUID })
    await expect(createProjectPayItem('HWS0023', VALUES)).rejects.toMatchObject({
      message: 'A pay item with this ref and budget code already exists for this project', status: 409,
      body: { existing_pay_item_uuid: ITEM_UUID },
    })
  })

  it('throws the backend message on a refusal', async () => {
    mockFetch(400, { detail: 'quantity cannot be negative' })
    await expect(createProjectPayItem('HWS0023', { ...VALUES, quantity: -1 }))
      .rejects.toMatchObject({ message: 'quantity cannot be negative', status: 400 })
  })
})

describe('updateProjectPayItem', () => {
  it('PATCHes the item with what it was given and returns it', async () => {
    mockFetch(200, { data: { ...ITEM, quantity: 13000 } })
    expect(await updateProjectPayItem('HWS0023', ITEM_UUID, { quantity: 13000 })).toEqual({ ...ITEM, quantity: 13000 })
    expect(fetchUrl().pathname).toBe(`/v1/admin/projects/HWS0023/pay-items/${ITEM_UUID}`)
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ quantity: 13000 })
  })

  it('throws the backend message for an item the project doesn\'t have', async () => {
    mockFetch(404, { detail: 'Pay item not found' })
    await expect(updateProjectPayItem('HWS0023', ITEM_UUID, { quantity: 1 }))
      .rejects.toMatchObject({ message: 'Pay item not found', status: 404 })
  })
})

describe('deleteProjectPayItem', () => {
  it('DELETEs the item and returns nothing', async () => {
    mockFetchNoContent()
    expect(await deleteProjectPayItem('HWS0023', ITEM_UUID)).toBeUndefined()
    expect(fetchUrl().pathname).toBe(`/v1/admin/projects/HWS0023/pay-items/${ITEM_UUID}`)
    expect(fetchInit().method).toBe('DELETE')
  })

  it('throws the backend message for an item the project doesn\'t have', async () => {
    mockFetch(404, { detail: 'Pay item not found' })
    await expect(deleteProjectPayItem('HWS0023', ITEM_UUID))
      .rejects.toMatchObject({ message: 'Pay item not found', status: 404 })
  })
})

describe('clearProjectPayItems', () => {
  it('DELETEs the project\'s pay items and returns how many went', async () => {
    mockFetch(200, { status: 'success', message: 'Deleted 3 pay items from project HWS0023', data: { deleted_count: 3 } })
    expect(await clearProjectPayItems('HWS0023')).toEqual({ deleted_count: 3 })
    expect(fetchUrl().pathname).toBe('/v1/admin/projects/HWS0023/pay-items')
    expect(fetchInit().method).toBe('DELETE')
  })

  it('throws the backend message for someone who is not an admin', async () => {
    mockFetch(403, { detail: 'Admin access required' })
    await expect(clearProjectPayItems('HWS0023')).rejects.toMatchObject({ message: 'Admin access required', status: 403 })
  })
})

describe('previewPayItemImport and commitPayItemImport', () => {
  const FILE = new File(['pay_item_ref,description\n'], 'items.csv', { type: 'text/csv' })
  const PREVIEW = { parsed_rows: 0, new_count: 0, overwrite_count: 0, error_count: 0, ignored_columns: [], new: [],
    overwrites: [], errors: [] }

  it.each([
    ['preview', previewPayItemImport, PREVIEW],
    ['commit', commitPayItemImport, { inserted: 2, updated: 1 }],
  ])('%s POSTs the file as the multipart field "file" and returns the data', async (step, call, data) => {
    mockFetch(200, { status: 'ok', data })
    expect(await call('HWS0023', FILE)).toEqual(data)
    expect(fetchUrl().pathname).toBe(`/v1/admin/projects/HWS0023/pay-items/import/${step}`)
    expect(fetchInit().method).toBe('POST')
    expect(fetchInit().body).toBeInstanceOf(FormData)
    expect(fetchInit().body.get('file')).toBe(FILE)
    expect(fetchInit().headers?.['Content-Type']).toBeUndefined()
  })

  it('preview throws the backend message for a file it can\'t read', async () => {
    mockFetch(400, { detail: 'The file is missing the required column(s): unit' })
    await expect(previewPayItemImport('HWS0023', FILE))
      .rejects.toMatchObject({ message: 'The file is missing the required column(s): unit', status: 400 })
  })

  it('commit throws the backend message for a file with rows in error, with the errors', async () => {
    const errors = [{ row: 2, reason: 'quantity cannot be blank', raw: { pay_item_ref: '6.02' } }]
    mockFetch(400, { detail: 'The file has 1 row(s) with errors; fix them and upload it again', error_count: 1, errors })
    await expect(commitPayItemImport('HWS0023', FILE)).rejects.toMatchObject({
      message: 'The file has 1 row(s) with errors; fix them and upload it again', status: 400,
      body: { error_count: 1, errors },
    })
  })
})
