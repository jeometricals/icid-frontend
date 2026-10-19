import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createCorner, deleteCorner, getCorner, getRampAttributes, listCorners, saveRampAttributes, updateCorner,
} from '../pedRamps'
import { mockFetch, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const CORNER_ID = 'd0000000-0000-4000-8000-000000000001'
const PROPERTY_ID = 'c0000000-0000-4000-8000-000000000002'
const CORNER = { corner_id: CORNER_ID, project_id: 'HWS0023', boro: 'Queens', north_south_street: '38th St',
  east_west_street: '31st Ave', ramps: [] }
const ATTRIBUTES = { property_id: PROPERTY_ID, ramp_type: 'PERPENDICULAR', ramp_running_slope_pct: 9.1,
  warnings: [{ field: 'ramp_running_slope_pct', value: 9.1, limit: 'at most 8.3%', message: 'Ramp running slope 9.1% exceeds 8.3%' }] }

describe('corners', () => {
  it('lists a project\'s corners, deleted ones only when asked', async () => {
    mockFetch(200, { data: [CORNER] })
    expect(await listCorners('HWS0023')).toEqual([CORNER])
    expect(fetchUrl().pathname).toBe('/v1/projects/HWS0023/ped-ramp-corners')
    expect(fetchUrl().search).toBe('')
    mockFetch(200, { data: [] })
    await listCorners('HWS0023', { includeDeleted: true })
    expect(fetchUrl().searchParams.get('include_deleted')).toBe('true')
  })

  it('reads, adds, changes and deletes one', async () => {
    mockFetch(200, { data: CORNER })
    expect(await getCorner(CORNER_ID)).toEqual(CORNER)
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-corners/${CORNER_ID}`)

    mockFetch(201, { data: CORNER })
    await createCorner('HWS0023', { boro: 'Queens' })
    expect(fetchUrl().pathname).toBe('/v1/projects/HWS0023/ped-ramp-corners')
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual({ boro: 'Queens' })

    mockFetch(200, { data: CORNER })
    await updateCorner(CORNER_ID, { corner_direction: null })
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ corner_direction: null })

    mockFetch(200, { data: { ...CORNER, deleted_at: '2026-10-19T09:00:00Z' } })
    await deleteCorner(CORNER_ID)
    expect(fetchUrl().pathname).toBe(`/v1/ped-ramp-corners/${CORNER_ID}`)
    expect(fetchInit().method).toBe('DELETE')
  })
})

describe('ramp attributes', () => {
  it('reads them with their warnings', async () => {
    mockFetch(200, { data: ATTRIBUTES })
    expect(await getRampAttributes(PROPERTY_ID)).toEqual(ATTRIBUTES)
    expect(fetchUrl().pathname).toBe(`/v1/properties/${PROPERTY_ID}/ped-ramp-attributes`)
  })

  it('reads none entered as null, and throws any other 404', async () => {
    mockFetch(404, { detail: 'Ramp attributes not entered' })
    expect(await getRampAttributes(PROPERTY_ID)).toBeNull()
    mockFetch(404, { detail: 'Property not found' })
    await expect(getRampAttributes(PROPERTY_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('PUTs the whole set', async () => {
    mockFetch(200, { data: ATTRIBUTES })
    expect(await saveRampAttributes(PROPERTY_ID, { ramp_running_slope_pct: 9.1 })).toEqual(ATTRIBUTES)
    expect(fetchInit().method).toBe('PUT')
    expect(JSON.parse(fetchInit().body)).toEqual({ ramp_running_slope_pct: 9.1 })
  })
})
