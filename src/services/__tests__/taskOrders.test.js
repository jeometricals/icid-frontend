import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  bundleProperty, createTaskOrder, getTaskOrder, listTaskOrders, softDeleteTaskOrder, unbundleProperty,
  undeleteTaskOrder, updateTaskOrder,
} from '../taskOrders'
import { mockFetch, mockFetchNoContent, fetchUrl, fetchInit } from '../../test/mockFetch'

beforeEach(() => {
  vi.restoreAllMocks()
})

const ID = 'd0000000-0000-4000-8000-000000000001'
const PROPERTY_ID = 'c0000000-0000-4000-8000-000000000001'
const TASK_ORDER = { id: ID, project_id: 'HWS0023', task_order_number: 'TO-001', issued_date: '2026-09-14',
  estimate_notes: null, created_at: '2026-09-14T12:00:00Z', updated_at: '2026-09-14T12:00:00Z', created_by: 'u1',
  deleted_at: null, deleted_by: null, properties: [] }
const VALUES = { task_order_number: 'TO-001', issued_date: '2026-09-14', estimate_notes: null }

describe('listTaskOrders', () => {
  it('GETs the project\'s task orders without include_deleted by default', async () => {
    mockFetch(200, { data: [{ ...TASK_ORDER, property_count: 3 }] })
    expect((await listTaskOrders('HWS0023'))[0].property_count).toBe(3)
    expect(fetchUrl().pathname).toBe('/v1/projects/HWS0023/task-orders')
    expect(fetchUrl().search).toBe('')
    expect(fetchInit().method).toBe('GET')
  })

  it('asks for deleted ones too when includeDeleted is true', async () => {
    mockFetch(200, { data: [] })
    await listTaskOrders('HWS0023', { includeDeleted: true })
    expect(fetchUrl().searchParams.get('include_deleted')).toBe('true')
  })
})

describe('getTaskOrder', () => {
  it('GETs one task order with its properties', async () => {
    mockFetch(200, { data: TASK_ORDER })
    expect(await getTaskOrder(ID)).toEqual(TASK_ORDER)
    expect(fetchUrl().pathname).toBe(`/v1/task-orders/${ID}`)
  })

  it('throws the backend message for an unknown one', async () => {
    mockFetch(404, { detail: 'Task order not found' })
    await expect(getTaskOrder(ID)).rejects.toMatchObject({ message: 'Task order not found', status: 404 })
  })
})

describe('createTaskOrder and updateTaskOrder', () => {
  it('POSTs a new task order to the project', async () => {
    mockFetch(201, { data: TASK_ORDER })
    expect(await createTaskOrder('HWS0023', VALUES)).toEqual(TASK_ORDER)
    expect(fetchUrl().pathname).toBe('/v1/projects/HWS0023/task-orders')
    expect(fetchInit().method).toBe('POST')
    expect(JSON.parse(fetchInit().body)).toEqual(VALUES)
  })

  it('throws a taken number\'s 409 with the task order that has it', async () => {
    mockFetch(409, { detail: 'A task order with this number already exists in this project', existing_task_order_id: ID })
    await expect(createTaskOrder('HWS0023', VALUES)).rejects.toMatchObject({
      status: 409, body: { existing_task_order_id: ID },
    })
  })

  it('PATCHes what changed', async () => {
    mockFetch(200, { data: TASK_ORDER })
    await updateTaskOrder(ID, { issued_date: null })
    expect(fetchUrl().pathname).toBe(`/v1/task-orders/${ID}`)
    expect(fetchInit().method).toBe('PATCH')
    expect(JSON.parse(fetchInit().body)).toEqual({ issued_date: null })
  })
})

describe('softDeleteTaskOrder and undeleteTaskOrder', () => {
  it.each([
    [softDeleteTaskOrder, 'soft-delete'],
    [undeleteTaskOrder, 'undelete'],
  ])('POSTs to the admin %# route', async (call, action) => {
    mockFetch(200, { data: TASK_ORDER })
    expect(await call(ID)).toEqual(TASK_ORDER)
    expect(fetchUrl().pathname).toBe(`/v1/task-orders/${ID}/admin/${action}`)
    expect(fetchInit().method).toBe('POST')
  })
})

describe('bundleProperty and unbundleProperty', () => {
  it('POSTs the property into the task order and returns the task order', async () => {
    mockFetch(201, { data: TASK_ORDER })
    expect(await bundleProperty(ID, PROPERTY_ID)).toEqual(TASK_ORDER)
    expect(fetchUrl().pathname).toBe(`/v1/task-orders/${ID}/properties/${PROPERTY_ID}`)
    expect(fetchInit().method).toBe('POST')
  })

  it('throws the backend message for a property already in it', async () => {
    mockFetch(409, { detail: 'Property is already in this task order' })
    await expect(bundleProperty(ID, PROPERTY_ID)).rejects.toMatchObject({
      message: 'Property is already in this task order', status: 409,
    })
  })

  it('DELETEs the property from the task order', async () => {
    mockFetchNoContent()
    expect(await unbundleProperty(ID, PROPERTY_ID)).toBeUndefined()
    expect(fetchUrl().pathname).toBe(`/v1/task-orders/${ID}/properties/${PROPERTY_ID}`)
    expect(fetchInit().method).toBe('DELETE')
  })
})
