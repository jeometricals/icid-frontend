import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPir, getPir, getPirByProperty, importSmartPir, listPirs, softDeletePir, undeletePir, updatePir } from '../pirs'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const PROPERTY_ID = 'c0000000-0000-4000-8000-000000000001'
const PIR_ID = 'e0000000-0000-4000-8000-000000000001'
const PIR = { id: PIR_ID, property_id: PROPERTY_ID, project_id: 'HWS0023', inspector_initials: 'JD',
  inspector_sign_date: '2026-09-14', digitized_by: 'u1', digitized_at: '2026-09-20T12:00:00Z',
  as_built_signed_by: null, as_built_signed_at: null, deleted_at: null }
const VALUES = { inspector_initials: 'JD', inspector_sign_date: '2026-09-14' }

describe('getPirByProperty', () => {
  it('GETs the property\'s live PIR', async () => {
    mockFetch(200, { data: PIR })
    expect(await getPirByProperty(PROPERTY_ID)).toEqual(PIR)
    expect(fetchUrl().pathname).toBe(`/v1/properties/${PROPERTY_ID}/pir`)
    expect(fetchInit().method).toBe('GET')
  })

  it('returns null on a 404', async () => {
    mockFetch(404, { detail: 'No PIR for this property' })
    expect(await getPirByProperty(PROPERTY_ID)).toBeNull()
  })

  it('throws any other refusal', async () => {
    mockFetch(403, { detail: 'Not a member of this project' })
    await expect(getPirByProperty(PROPERTY_ID)).rejects.toMatchObject({ status: 403 })
  })
})

describe('listPirs', () => {
  it('GETs the property\'s PIRs without include_deleted by default', async () => {
    mockFetch(200, { data: [PIR] })
    expect(await listPirs(PROPERTY_ID)).toEqual([PIR])
    expect(fetchUrl().pathname).toBe(`/v1/properties/${PROPERTY_ID}/pirs`)
    expect(fetchUrl().search).toBe('')
  })

  it('asks for deleted ones too when includeDeleted is true', async () => {
    mockFetch(200, { data: [] })
    await listPirs(PROPERTY_ID, { includeDeleted: true })
    expect(fetchUrl().searchParams.get('include_deleted')).toBe('true')
  })
})

describe('getPir', () => {
  it('GETs one PIR', async () => {
    mockFetch(200, { data: PIR })
    expect(await getPir(PIR_ID)).toEqual(PIR)
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}`)
  })
})

describe('createPir and updatePir', () => {
  it('POSTs a PIR to the property', async () => {
    mockFetch(201, { data: PIR })
    expect(await createPir(PROPERTY_ID, VALUES)).toEqual(PIR)
    expect(fetchUrl().pathname).toBe(`/v1/properties/${PROPERTY_ID}/pir`)
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual(VALUES)
  })

  it('throws the 409 for a property that already has one, with that PIR', async () => {
    mockFetch(409, { detail: 'This property already has a PIR', existing_pir_id: PIR_ID })
    await expect(createPir(PROPERTY_ID, VALUES)).rejects.toMatchObject({
      status: 409, body: { existing_pir_id: PIR_ID },
    })
  })

  it('PATCHes what changed', async () => {
    mockFetch(200, { data: PIR })
    await updatePir(PIR_ID, { inspector_initials: 'JQD' })
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}`)
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ inspector_initials: 'JQD' })
  })
})

describe('softDeletePir and undeletePir', () => {
  it.each([
    [softDeletePir, 'soft-delete'],
    [undeletePir, 'undelete'],
  ])('POSTs to the admin route (%#)', async (call, action) => {
    mockFetch(200, { data: PIR })
    expect(await call(PIR_ID)).toEqual(PIR)
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/admin/${action}`)
    expect(fetchInit().method).toBe('POST')
  })
})

describe('importSmartPir', () => {
  const FILE = { schema_version: '1.0', pir_id: 'pir-1', pages: [{ page_number: 1, flags: [], features: [], segments: [] }] }
  const RESULT = {
    inserted: { flags: 2, non_assessable_areas: 1, features: 0, segments: 1, annotations: 0 },
    dropped: { flags: 1, non_assessable_areas: 0, features: 0, segments: 0, annotations: 0 },
    dropped_items: [{ kind: 'flag', page_number: 1, index: 2, flag_index: null, reason: 'L must be above 0' }],
    pages_updated: 1,
  }

  it('POSTs the parsed file as the body and returns the counts', async () => {
    mockFetch(200, { data: RESULT })
    expect(await importSmartPir('pir-1', FILE)).toEqual(RESULT)
    expect(fetchUrl().pathname).toBe('/v1/pirs/pir-1/import')
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual(FILE)
  })

  it("throws a 422's messages", async () => {
    mockFetch(422, { detail: [{ msg: "Input should be '1.0'" }] })
    await expect(importSmartPir('pir-1', { ...FILE, schema_version: '2' })).rejects.toMatchObject({ status: 422 })
  })
})
