import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createFlag, getFlag, listFlags, softDeleteFlag, undeleteFlag, updateFlag } from '../flags'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const PIR_ID = 'e0000000-0000-4000-8000-000000000001'
const FLAG_ID = 'f1000000-0000-4000-8000-000000000001'
const FLAG = { id: FLAG_ID, pir_id: PIR_ID, display_order: 1, shape: 'rectangle', dimensions: { L: 5, W: 5 },
  computed_quantity: 25, reported_quantity: null, quantity: 25, deleted_at: null }
const VALUES = { display_order: 1, shape: 'rectangle', dimensions: { L: 5, W: 5 }, surveyed_mark: 'cross',
  surveyed_is_assessable: true, surveyed_non_assessable_reason: null, surveyed_thickness: '4in', added_in_field: false,
  pay_item_id: null, reported_quantity: null, quantity_delta_reason: null }

describe('listFlags', () => {
  it('GETs the PIR\'s flags without include_deleted by default', async () => {
    mockFetch(200, { data: [FLAG] })
    expect(await listFlags(PIR_ID)).toEqual([FLAG])
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/flags`)
    expect(fetchUrl().search).toBe('')
    expect(fetchInit().method).toBe('GET')
  })

  it('asks for deleted ones too when includeDeleted is true', async () => {
    mockFetch(200, { data: [] })
    await listFlags(PIR_ID, { includeDeleted: true })
    expect(fetchUrl().searchParams.get('include_deleted')).toBe('true')
  })
})

describe('getFlag', () => {
  it('GETs one flag', async () => {
    mockFetch(200, { data: FLAG })
    expect(await getFlag(FLAG_ID)).toEqual(FLAG)
    expect(fetchUrl().pathname).toBe(`/v1/flags/${FLAG_ID}`)
  })
})

describe('createFlag and updateFlag', () => {
  it('POSTs a flag to the PIR', async () => {
    mockFetch(201, { data: FLAG })
    expect(await createFlag(PIR_ID, VALUES)).toEqual(FLAG)
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/flags`)
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual(VALUES)
  })

  it('throws a 422\'s messages with its body', async () => {
    mockFetch(422, { detail: [{ loc: ['body'], msg: "Value error, surveyed_mark 'none' is only for a flag added in the field" }] })
    await expect(createFlag(PIR_ID, VALUES)).rejects.toMatchObject({
      status: 422, message: "Value error, surveyed_mark 'none' is only for a flag added in the field",
    })
  })

  it('PATCHes what changed', async () => {
    mockFetch(200, { data: FLAG })
    await updateFlag(FLAG_ID, { reported_quantity: null })
    expect(fetchUrl().pathname).toBe(`/v1/flags/${FLAG_ID}`)
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ reported_quantity: null })
  })
})

describe('softDeleteFlag and undeleteFlag', () => {
  it.each([
    [softDeleteFlag, 'soft-delete'],
    [undeleteFlag, 'undelete'],
  ])('POSTs to the admin route (%#)', async (call, action) => {
    mockFetch(200, { data: FLAG })
    expect(await call(FLAG_ID)).toEqual(FLAG)
    expect(fetchUrl().pathname).toBe(`/v1/flags/${FLAG_ID}/admin/${action}`)
    expect(fetchInit().method).toBe('POST')
  })
})
