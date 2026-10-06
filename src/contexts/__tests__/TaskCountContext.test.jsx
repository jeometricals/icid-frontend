import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskCountProvider, useTaskCount } from '../TaskCountContext'
import { ProjectRolesContext } from '../ProjectRolesContext'
import * as api from '../../services/api'
import * as AuthContext from '../AuthContext'
import { TEST_USER } from '../../test/users'

vi.mock('../../services/api', () => ({ getReviewQueue: vi.fn() }))

const ME = TEST_USER.uuid
const OTHER = '5246b39d-87fe-4e21-92a3-2804c899e8b3'
const ADMIN = { ...TEST_USER, role: 'admin' }

const idr = (id, project_id, overrides = {}) => ({
  idr_id: id, project_id, stage1_reviewer_uuid: null, re_reviewer_uuid: null, ...overrides,
})

// What the backend holds in each queue; a test replaces it to move IDRs along
let queues

function Probe() {
  const { submitted, stage1_review, stage2_review, total, error, refresh } = useTaskCount()
  return (
    <>
      <div data-testid="counts">{[submitted, stage1_review, stage2_review, total].join('/')}</div>
      <div data-testid="error">{error}</div>
      <button onClick={refresh}>refresh</button>
    </>
  )
}

function tree(rolesByProject) {
  return (
    <ProjectRolesContext.Provider value={{ rolesByProject, error: null, reload: () => {} }}>
      <TaskCountProvider><Probe /></TaskCountProvider>
    </ProjectRolesContext.Provider>
  )
}

function renderProvider(user, rolesByProject) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(tree(rolesByProject))
}

const counts = () => screen.getByTestId('counts').textContent
const asked = () => api.getReviewQueue.mock.calls.map(([status]) => status)

beforeEach(() => {
  vi.clearAllMocks()
  queues = {
    submitted: [idr('s1', 'HWS0023'), idr('s2', 'SE384')],
    stage1_review: [
      idr('a1', 'HWS0023', { stage1_reviewer_uuid: ME }),
      idr('a2', 'HWS0023', { stage1_reviewer_uuid: OTHER }),
      idr('a3', 'SE384', { stage1_reviewer_uuid: ME }),
    ],
    stage2_review: [
      idr('b1', 'SE384', { stage1_reviewer_uuid: OTHER, re_reviewer_uuid: ME }),
      idr('b2', 'SE384', { stage1_reviewer_uuid: OTHER, re_reviewer_uuid: OTHER }),
      idr('b3', 'SE384', { stage1_reviewer_uuid: OTHER }),
    ],
  }
  // Each queue holds IDRs at its own status
  api.getReviewQueue.mockImplementation(async status => queues[status].map(row => ({ ...row, status })))
})

describe('TaskCountProvider — what counts', () => {
  it('counts for an OE: submitted IDRs and the Stage 1 reviews they accepted, from the two queues an OE works', async () => {
    renderProvider(TEST_USER, { HWS0023: ['oe'], SE384: ['oe'] })
    await vi.waitFor(() => expect(counts()).toBe('2/2/0/4'))
    expect(asked()).toEqual(['submitted', 'stage1_review'])
  })

  it('counts for an RE: those, plus the Stage 2 reviews they accepted or nobody has yet', async () => {
    renderProvider(TEST_USER, { HWS0023: ['re'], SE384: ['re'] })
    await vi.waitFor(() => expect(counts()).toBe('2/2/2/6'))
    expect(asked()).toEqual(['submitted', 'stage1_review', 'stage2_review'])
  })

  it('counts each IDR by the role held on its own project (OE on one, RE on another)', async () => {
    // The Stage 2 queue is asked for because of SE384; an IDR there on a project where the user is only an OE wouldn't count
    queues.stage2_review.push(idr('b4', 'HWS0023'))
    renderProvider(TEST_USER, { HWS0023: ['oe'], SE384: ['re'] })
    await vi.waitFor(() => expect(counts()).toBe('2/2/2/6'))
  })

  it('counts every IDR in review for an admin, on every project', async () => {
    renderProvider(ADMIN, {})
    await vi.waitFor(() => expect(counts()).toBe('2/3/3/8'))
  })

  it('counts nothing, and asks for nothing, for someone who only inspects', async () => {
    renderProvider(TEST_USER, { HWS0023: ['inspector'] })
    expect(counts()).toBe('0/0/0/0')
    await Promise.resolve()
    expect(api.getReviewQueue).not.toHaveBeenCalled()
  })

  it('waits for the roles before asking', () => {
    renderProvider(TEST_USER, null)
    expect(counts()).toBe('0/0/0/0')
    expect(api.getReviewQueue).not.toHaveBeenCalled()
  })

  it('asks for nothing when nobody is signed in', () => {
    renderProvider(null, {})
    expect(counts()).toBe('0/0/0/0')
    expect(api.getReviewQueue).not.toHaveBeenCalled()
  })
})

describe('TaskCountProvider — keeping up', () => {
  it('reads once on sign-in, not again on a re-render', async () => {
    const roles = { HWS0023: ['re'] }
    const { rerender } = renderProvider(TEST_USER, roles)
    await vi.waitFor(() => expect(counts()).not.toBe('0/0/0/0'))
    rerender(tree(roles))
    expect(api.getReviewQueue).toHaveBeenCalledTimes(3)
  })

  it('reads again on refresh(), following an IDR through accept and approve', async () => {
    const user = userEvent.setup()
    queues = { submitted: [idr('x', 'HWS0023')], stage1_review: [], stage2_review: [] }
    renderProvider(TEST_USER, { HWS0023: ['oe'] })
    await vi.waitFor(() => expect(counts()).toBe('1/0/0/1'))

    // the OE accepts it: still theirs to act on
    queues = { submitted: [], stage1_review: [idr('x', 'HWS0023', { stage1_reviewer_uuid: ME })], stage2_review: [] }
    await user.click(screen.getByRole('button', { name: 'refresh' }))
    await vi.waitFor(() => expect(counts()).toBe('0/1/0/1'))

    // the OE approves it: it is the RE's now
    queues = { submitted: [], stage1_review: [], stage2_review: [idr('x', 'HWS0023', { stage1_reviewer_uuid: ME })] }
    await user.click(screen.getByRole('button', { name: 'refresh' }))
    await vi.waitFor(() => expect(counts()).toBe('0/0/0/0'))
  })

  it('reads again when the roles change', async () => {
    const { rerender } = renderProvider(TEST_USER, { HWS0023: ['oe'], SE384: ['oe'] })
    await vi.waitFor(() => expect(counts()).toBe('2/2/0/4'))
    rerender(tree({ HWS0023: ['inspector'], SE384: ['inspector'] }))
    await vi.waitFor(() => expect(counts()).toBe('0/0/0/0'))
  })

  it('keeps the last counts and reports the error when a read fails', async () => {
    const user = userEvent.setup()
    renderProvider(TEST_USER, { HWS0023: ['oe'], SE384: ['oe'] })
    await vi.waitFor(() => expect(counts()).toBe('2/2/0/4'))
    api.getReviewQueue.mockRejectedValueOnce(new Error('Failed to list the review queue'))
    await user.click(screen.getByRole('button', { name: 'refresh' }))
    await vi.waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Failed to list the review queue'))
    expect(counts()).toBe('2/2/0/4')

    await user.click(screen.getByRole('button', { name: 'refresh' }))
    await vi.waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent(''))
  })
})

describe('useTaskCount outside a provider', () => {
  it('counts nothing rather than throwing', () => {
    render(<Probe />)
    expect(counts()).toBe('0/0/0/0')
  })
})
