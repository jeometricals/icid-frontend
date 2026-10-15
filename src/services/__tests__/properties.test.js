import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createProperty, getProperty, listProperties, softDeleteProperty, undeleteProperty, updateProperty,
} from '../properties'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const PROPERTY_ID = 'c0000000-0000-4000-8000-000000000001'
const PROPERTY = { id: PROPERTY_ID, project_id: 'HWS0023', kind: 'sidewalk', boro: 'Queens', block: '123', lot: '45', address: '12 Main St',
  property_type: '1_3_family', notes: null, created_at: '2026-09-14T12:00:00Z', updated_at: '2026-09-14T12:00:00Z',
  created_by: 'u1', deleted_at: null, deleted_by: null }
const VALUES = { kind: 'sidewalk', boro: 'Queens', block: '123', lot: '45', address: '12 Main St', property_type: '1_3_family', notes: null }

describe('listProperties', () => {
  it('GETs the project\'s properties without include_deleted by default', async () => {
    mockFetch(200, { status: 'success', data: [PROPERTY] })
    expect(await listProperties('HWS0023')).toEqual([PROPERTY])
    expect(fetchUrl().pathname).toBe('/v1/projects/HWS0023/properties')
    expect(fetchUrl().search).toBe('')
    expect(fetchInit().method).toBe('GET')
  })

  it('asks for deleted ones too when includeDeleted is true', async () => {
    mockFetch(200, { data: [] })
    await listProperties('HWS0023', { includeDeleted: true })
    expect(fetchUrl().searchParams.get('include_deleted')).toBe('true')
  })

  it('throws the backend message for a user who isn\'t on the project', async () => {
    mockFetch(403, { detail: 'Not a member of this project' })
    await expect(listProperties('HWS0023')).rejects.toMatchObject({ message: 'Not a member of this project', status: 403 })
  })
})

describe('getProperty', () => {
  it('GETs one property', async () => {
    mockFetch(200, { data: PROPERTY })
    expect(await getProperty(PROPERTY_ID)).toEqual(PROPERTY)
    expect(fetchUrl().pathname).toBe(`/v1/properties/${PROPERTY_ID}`)
  })
})

describe('createProperty', () => {
  it('POSTs the values to the project\'s properties and returns the property', async () => {
    mockFetch(201, { data: PROPERTY })
    expect(await createProperty('HWS0023', VALUES)).toEqual(PROPERTY)
    expect(fetchUrl().pathname).toBe('/v1/projects/HWS0023/properties')
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual(VALUES)
  })

  it('throws a taken lot\'s 409 with the property that has it', async () => {
    mockFetch(409, { detail: 'A site at Queens Block 123 Lot 45 already exists in this project.', existing_property_id: PROPERTY_ID })
    await expect(createProperty('HWS0023', VALUES)).rejects.toMatchObject({
      status: 409, body: { existing_property_id: PROPERTY_ID },
    })
  })
})

describe('updateProperty', () => {
  it('PATCHes what changed and returns the property', async () => {
    mockFetch(200, { data: PROPERTY })
    expect(await updateProperty(PROPERTY_ID, { address: '14 Main St' })).toEqual(PROPERTY)
    expect(fetchUrl().pathname).toBe(`/v1/properties/${PROPERTY_ID}`)
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ address: '14 Main St' })
  })
})

describe('softDeleteProperty and undeleteProperty', () => {
  it('POSTs to the admin soft-delete route', async () => {
    mockFetch(200, { data: { ...PROPERTY, deleted_at: '2026-10-01T00:00:00Z' } })
    expect((await softDeleteProperty(PROPERTY_ID)).deleted_at).toBe('2026-10-01T00:00:00Z')
    expect(fetchUrl().pathname).toBe(`/v1/properties/${PROPERTY_ID}/admin/soft-delete`)
    expect(fetchInit().method).toBe('POST')
  })

  it('POSTs to the admin undelete route', async () => {
    mockFetch(200, { data: PROPERTY })
    expect(await undeleteProperty(PROPERTY_ID)).toEqual(PROPERTY)
    expect(fetchUrl().pathname).toBe(`/v1/properties/${PROPERTY_ID}/admin/undelete`)
    expect(fetchInit().method).toBe('POST')
  })

  it('throws the backend message when another site is now at its lot', async () => {
    mockFetch(409, { detail: 'Another site at Queens Block 123 Lot 45 now exists in this project.', existing_property_id: 'x' })
    await expect(undeleteProperty(PROPERTY_ID)).rejects.toMatchObject({
      message: 'Another site at Queens Block 123 Lot 45 now exists in this project.', status: 409,
    })
  })
})
