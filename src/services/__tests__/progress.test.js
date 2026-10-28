import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { downloadProjectProgress, downloadTaskOrderProgress, getProjectProgress, getTaskOrderProgress } from '../progress'
import { mockFetch, fetchUrl } from '../../test/mockFetch'
import { PROJECT_PROGRESS, TASK_ORDER_PROGRESS, TO_002, MAIN_ST } from '../../test/progress'
import { setToken, clearToken } from '../session'

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

describe('the Progress CSVs (Slice ML2)', () => {
  let clicked // the downloads started: [href, download name]

  // A CSV response under the backend's file name
  function mockCsv(disposition) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      headers: new Headers(disposition ? { 'Content-Disposition': disposition } : {}),
      blob: () => Promise.resolve(new Blob(['csv'])),
      text: () => Promise.resolve('csv'),
    })
  }

  beforeEach(() => {
    setToken('token-abc')
    clicked = []
    global.URL.createObjectURL = vi.fn(() => 'blob:progress')
    global.URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
      clicked.push([this.getAttribute('href'), this.download])
    })
  })

  afterEach(() => { clearToken() })

  it("downloads the project's table under the backend's file name, as filtered", async () => {
    mockCsv('attachment; filename="SE384_progress_TO-002_2026-10-28.csv"')
    expect(await downloadProjectProgress('SE384', { taskOrderId: TO_002, propertyId: MAIN_ST }))
      .toBe('SE384_progress_TO-002_2026-10-28.csv')
    expect(fetchUrl().pathname).toBe('/v1/projects/SE384/progress-rollup.csv')
    expect(fetchUrl().searchParams.get('task_order_id')).toBe(TO_002)
    expect(fetchUrl().searchParams.get('property_id')).toBe(MAIN_ST)
    expect(clicked).toEqual([['blob:progress', 'SE384_progress_TO-002_2026-10-28.csv']])
  })

  it('sends no filters when there are none, and names the file itself without a name', async () => {
    mockCsv(null)
    expect(await downloadProjectProgress('SE384')).toBe('SE384_progress.csv')
    expect(fetchUrl().search).toBe('')
  })

  it("downloads a task order's", async () => {
    mockCsv('attachment; filename="SE384_progress_TO-002_2026-10-28.csv"')
    await downloadTaskOrderProgress(TO_002)
    expect(fetchUrl().pathname).toBe(`/v1/task-orders/${TO_002}/progress-rollup.csv`)
  })
})
