import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ReviewQueuePage from '../ReviewQueuePage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { ProjectRolesContext } from '../../contexts/ProjectRolesContext'
import { TEST_USER } from '../../test/users'

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const ADMIN = { ...TEST_USER, role: 'admin' }

function idr(overrides) {
  return {
    project_id: 'HWS0023',
    reporter_name: 'Genghis Khan',
    status: 'submitted',
    idr_number: null,
    stage1_reviewer_name: null,
    re_reviewer_name: null,
    return_reason: null,
    inspector_signature_path: 'idrs/a/inspector_1.png',
    ...overrides,
  }
}

// What the backend holds in each queue, oldest submission first
const QUEUES = {
  submitted: [idr({ idr_id: 'waiting', report_date: '2026-10-02', submitted_at: '2026-10-03T12:00:00Z' })],
  stage1_review: [
    idr({ idr_id: 'in-stage1', report_date: '2026-09-30', submitted_at: '2026-10-01T12:00:00Z', status: 'stage1_review',
      idr_number: '005', stage1_reviewer_name: 'Olive Engineer' }),
    idr({ idr_id: 'other-project', project_id: 'SE384', report_date: '2026-10-04', submitted_at: '2026-10-05T12:00:00Z',
      status: 'stage1_review', idr_number: '012', stage1_reviewer_name: 'Olive Engineer' }),
  ],
  stage2_review: [
    idr({ idr_id: 'in-stage2', report_date: '2026-09-28', submitted_at: '2026-09-29T12:00:00Z', status: 'stage2_review',
      idr_number: '003', stage1_reviewer_name: 'Olive Engineer', re_reviewer_name: 'Rex Resident' }),
  ],
}

vi.mock('../../services/api', () => ({ getReviewQueue: vi.fn() }))

let reloadRoles

beforeEach(() => {
  vi.clearAllMocks()
  reloadRoles = vi.fn()
  api.getReviewQueue.mockImplementation(async status => structuredClone(QUEUES[status]))
})

function CurrentUrl() {
  const location = useLocation()
  return (
    <>
      <div data-testid="url">{location.pathname}</div>
      <div data-testid="from">{location.state?.from}</div>
    </>
  )
}

function renderPage({ user = TEST_USER, rolesByProject = { HWS0023: ['re'] }, rolesError = null } = {}) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={['/review']}>
      <ProjectRolesContext.Provider value={{ rolesByProject, error: rolesError, reload: reloadRoles }}>
        <Routes>
          <Route path="/review" element={<ReviewQueuePage />} />
          <Route path="*" element={<CurrentUrl />} />
        </Routes>
      </ProjectRolesContext.Provider>
    </MemoryRouter>
  )
}

const tabs = () => screen.getAllByRole('tab').map(tab => tab.textContent)
const rows = () => screen.getAllByRole('row').slice(1)
const asked = () => api.getReviewQueue.mock.calls.map(([status]) => status)

// ---------------------------------------------------------------------------
// Which queues each role sees
// ---------------------------------------------------------------------------

describe('ReviewQueuePage — queues by role', () => {
  it('shows an OE the Stage 1 queue only, and asks for nothing else', async () => {
    renderPage({ rolesByProject: { HWS0023: ['inspector', 'oe'] } })
    await screen.findByRole('tab', { name: 'Stage 1 (3)' })
    expect(tabs()).toEqual(['Stage 1 (3)'])
    expect(asked()).toEqual(['submitted', 'stage1_review'])
  })

  it('shows an RE Stage 1 and Stage 2', async () => {
    renderPage({ rolesByProject: { HWS0023: ['re'] } })
    await screen.findByRole('tab', { name: 'Stage 1 (3)' })
    expect(tabs()).toEqual(['Stage 1 (3)', 'Stage 2 (1)'])
    expect(asked()).toEqual(['submitted', 'stage1_review', 'stage2_review'])
  })

  it('shows an admin both, with no project role at all', async () => {
    renderPage({ user: ADMIN, rolesByProject: {} })
    await screen.findByRole('tab', { name: 'Stage 1 (3)' })
    expect(tabs()).toEqual(['Stage 1 (3)', 'Stage 2 (1)'])
  })

  it('tells a user who reviews nothing that their queue is empty, without asking the backend', async () => {
    renderPage({ rolesByProject: { HWS0023: ['inspector'] } })
    expect(await screen.findByText(/You don't review IDRs on any project/)).toBeInTheDocument()
    expect(api.getReviewQueue).not.toHaveBeenCalled()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('waits for the roles before deciding', () => {
    renderPage({ rolesByProject: null })
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(api.getReviewQueue).not.toHaveBeenCalled()
    expect(screen.queryByText(/You don't review/)).not.toBeInTheDocument()
  })

  it('says so when the roles could not be loaded, and retries them', async () => {
    const user = userEvent.setup()
    renderPage({ rolesByProject: {}, rolesError: 'Failed to fetch projects' })
    expect(await screen.findByText(/Couldn't load your review roles: Failed to fetch projects/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(reloadRoles).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// The tabs and their rows
// ---------------------------------------------------------------------------

describe('ReviewQueuePage — the queues', () => {
  it('opens on Stage 1: waiting and in-review IDRs together, oldest submission first', async () => {
    renderPage()
    await screen.findByRole('tab', { name: 'Stage 1 (3)' })
    expect(screen.getByRole('tab', { name: 'Stage 1 (3)' })).toHaveAttribute('aria-selected', 'true')
    expect(rows().map(row => within(row).getByRole('button').textContent)).toEqual([
      'Sep 30, 2026', 'Oct 2, 2026', 'Oct 4, 2026',
    ])
  })

  it('shows each IDR with its project, number, status, inspector and reviewer', async () => {
    renderPage()
    await screen.findByRole('tab', { name: 'Stage 1 (3)' })
    expect(screen.getAllByRole('columnheader').map(th => th.textContent)).toEqual([
      'Work date', 'Project', 'IDR #', 'Status', 'Inspector', 'Reviewer', 'Submitted',
    ])
    const [inReview, waiting, otherProject] = rows()
    expect(inReview).toHaveTextContent('HWS0023')
    expect(inReview).toHaveTextContent('005')
    expect(inReview).toHaveTextContent('Stage 1 Review')
    expect(inReview).toHaveTextContent('Olive Engineer')
    expect(waiting).toHaveTextContent('No IDR # yet')
    expect(waiting).toHaveTextContent('Submitted')
    expect(waiting).toHaveTextContent('Genghis Khan')
    expect(otherProject).toHaveTextContent('SE384')
  })

  it('switches to Stage 2 without asking the backend again', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('tab', { name: 'Stage 2 (1)' }))
    expect(screen.getByRole('tab', { name: 'Stage 2 (1)' })).toHaveAttribute('aria-selected', 'true')
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('Rex Resident')
    expect(rows()[0]).toHaveTextContent('Stage 2 Review')
    expect(api.getReviewQueue).toHaveBeenCalledTimes(3)
  })

  it('says a queue is empty', async () => {
    api.getReviewQueue.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Nothing is waiting in Stage 1.')).toBeInTheDocument()
    expect(tabs()).toEqual(['Stage 1 (0)', 'Stage 2 (0)'])
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('opens the IDR on its own project, marked as coming from the queue', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Oct 4, 2026' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/SE384/idr/other-project')
    expect(screen.getByTestId('from')).toHaveTextContent('review') // drives the IDR page's Back link
  })

  it('goes back to the project list', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('tab', { name: 'Stage 1 (3)' })
    await user.click(screen.getByRole('button', { name: /Back to Projects/ }))
    expect(screen.getByTestId('url')).toHaveTextContent('/projects')
  })
})

// ---------------------------------------------------------------------------
// Loading and errors
// ---------------------------------------------------------------------------

describe('ReviewQueuePage — loading and errors', () => {
  it('shows a spinner while the queues load', () => {
    api.getReviewQueue.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('shows the error when any queue fails, and retries all of them', async () => {
    api.getReviewQueue.mockRejectedValueOnce(new Error('Failed to list the review queue'))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText(/Couldn't load your queue: Failed to list the review queue/)).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('tab', { name: 'Stage 1 (3)' })).toBeInTheDocument()
    expect(api.getReviewQueue).toHaveBeenCalledTimes(6)
  })
})
