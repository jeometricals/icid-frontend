import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createFlagOnPage, deleteFlag, getFlag, listFlags, updateFlag } from '../flags'
import { mockFetch, mockFetchNoContent, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const PIR_ID = 'e0000000-0000-4000-8000-000000000001'
const PAGE_ID = 'f0000000-0000-4000-8000-000000000001'
const FLAG_ID = 'f1000000-0000-4000-8000-000000000001'
const FLAG = { id: FLAG_ID, pir_id: PIR_ID, pir_page_id: PAGE_ID, display_order: 1, shape: 'rectangle',
  dimensions: { L: 5, W: 5 }, sketch_x: 100, sketch_y: 50, computed_quantity: 25, reported_quantity: null, quantity: 25 }
const VALUES = { display_order: 1, shape: 'rectangle', dimensions: { L: 5, W: 5 }, sketch_x: 100, sketch_y: 50,
  rotation: 0, surveyed_mark: 'number_only', surveyed_is_assessable: true, surveyed_thickness: '4in' }

describe('listFlags and getFlag', () => {
  it('GETs the PIR\'s live flags across its pages', async () => {
    mockFetch(200, { data: [FLAG] })
    expect(await listFlags(PIR_ID)).toEqual([FLAG])
    expect(fetchUrl().pathname).toBe(`/v1/pirs/${PIR_ID}/flags`)
    expect(fetchUrl().search).toBe('')
    expect(fetchInit().method).toBe('GET')
  })

  it('GETs one flag', async () => {
    mockFetch(200, { data: FLAG })
    expect(await getFlag(FLAG_ID)).toEqual(FLAG)
    expect(fetchUrl().pathname).toBe(`/v1/flags/${FLAG_ID}`)
  })
})

describe('createFlagOnPage, updateFlag and deleteFlag', () => {
  it('POSTs a flag to the page', async () => {
    mockFetch(201, { data: FLAG })
    expect(await createFlagOnPage(PAGE_ID, VALUES)).toEqual(FLAG)
    expect(fetchUrl().pathname).toBe(`/v1/pir-pages/${PAGE_ID}/flags`)
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual(VALUES)
  })

  it('throws a 422 with its status', async () => {
    mockFetch(422, { detail: [{ loc: ['body', 'dimensions', 'L'], msg: 'Input should be greater than 0' }] })
    await expect(createFlagOnPage(PAGE_ID, VALUES)).rejects.toMatchObject({ status: 422 })
  })

  it('PATCHes what changed', async () => {
    mockFetch(200, { data: FLAG })
    await updateFlag(FLAG_ID, { reported_quantity: null })
    expect(fetchUrl().pathname).toBe(`/v1/flags/${FLAG_ID}`)
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ reported_quantity: null })
  })

  it('DELETEs a flag', async () => {
    mockFetchNoContent()
    expect(await deleteFlag(FLAG_ID)).toBeUndefined()
    expect(fetchUrl().pathname).toBe(`/v1/flags/${FLAG_ID}`)
    expect(fetchInit().method).toBe('DELETE')
  })
})
