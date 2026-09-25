import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listUsers } from '../users'
import { mockFetch, mockFetchFailure, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const USERS = [
  { user_id: '327d3ed2-a3d6-4235-9408-7fe721b12bed', email: 'KhanG@magnoleng.pc', first_name: 'Genghis', last_name: 'Khan' },
  { user_id: '5246b39d-87fe-4e21-92a3-2804c899e8b3', email: 'Nadir.shah@goorkaneng.com', first_name: 'Nadir', last_name: 'Shah' },
]

describe('listUsers', () => {
  it('GETs /v1/users/', async () => {
    mockFetch(200, { status: 'success', data: USERS })
    await listUsers()
    expect(fetchUrl().pathname).toBe('/v1/users/')
    expect(fetchInit()).toEqual({ method: 'GET' })
  })

  it('returns the data array', async () => {
    mockFetch(200, { status: 'success', data: USERS })
    expect(await listUsers()).toEqual(USERS)
  })

  it('throws the backend message on error', async () => {
    mockFetch(500, { detail: 'Failed to list users' })
    await expect(listUsers()).rejects.toMatchObject({ message: 'Failed to list users', status: 500 })
  })

  it('throws when fetch itself fails', async () => {
    mockFetchFailure('Network error')
    await expect(listUsers()).rejects.toThrow('Network error')
  })
})
