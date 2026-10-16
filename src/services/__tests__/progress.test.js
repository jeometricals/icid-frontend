import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getProjectProgress, getTaskOrderProgress } from '../progress'
import { mockFetch, fetchUrl } from '../../test/mockFetch'
import { PROJECT_PROGRESS, TASK_ORDER_PROGRESS, TO_002, MAIN_ST } from '../../test/progress'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('getProjectProgress', () => {
  it("reads the project's rollup, unwrapped, with no filters by default", async () => {
    mockFetch(200, { status: 'success', message: 'Progress for project SE384', data: PROJECT_PROGRESS })
    expect(await getProjectProgress('SE384')).toEqual(PROJECT_PROGRESS)
    expect(fetchUrl().pathname).toBe('/v1/projects/SE384/progress-rollup')
    expect(fetchUrl().search).toBe('')
  })

  it('sends the task order, site and include_empty filters it is given', async () => {
    mockFetch(200, { data: PROJECT_PROGRESS })
    await getProjectProgress('SE384', { taskOrderId: TO_002, propertyId: MAIN_ST, includeEmpty: true })
    const params = fetchUrl().searchParams
    expect(params.get('task_order_id')).toBe(TO_002)
    expect(params.get('property_id')).toBe(MAIN_ST)
    expect(params.get('include_empty')).toBe('true')
  })

  it("throws the backend's refusal with its status", async () => {
    mockFetch(403, { detail: 'Project access required' })
    await expect(getProjectProgress('SE384')).rejects.toMatchObject({ status: 403 })
  })
})

describe('getTaskOrderProgress', () => {
  it("reads a task order's rollup, its sites included", async () => {
    mockFetch(200, { status: 'success', message: 'Progress for task order TO-002', data: TASK_ORDER_PROGRESS })
    const found = await getTaskOrderProgress(TO_002)
    expect(found.properties).toHaveLength(5)
    expect(fetchUrl().pathname).toBe(`/v1/task-orders/${TO_002}/progress-rollup`)
  })

  it('asks for every pay item with includeEmpty', async () => {
    mockFetch(200, { data: TASK_ORDER_PROGRESS })
    await getTaskOrderProgress(TO_002, { includeEmpty: true })
    expect(fetchUrl().search).toBe('?include_empty=true')
  })
})
