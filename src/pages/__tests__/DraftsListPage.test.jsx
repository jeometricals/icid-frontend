import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import DraftsListPage from '../DraftsListPage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const DEV_USER = { id: '327d3ed2-a3d6-4235-9408-7fe721b12bed', email: 'KhanG@magnoleng.pc' }

const DRAFTS = [
  {
    idr_id: 'idr-aaaa',
    reporter_uuid: DEV_USER.id,
    report_date: '2026-09-23',
    status: 'draft',
    report_count: 3,
    has_general: true,
    submitted_at: null,
    updated_at: '2026-09-23T17:45:04Z',
  },
  {
    idr_id: 'idr-bbbb',
    reporter_uuid: DEV_USER.id,
    report_date: '2025-09-16',
    status: 'draft',
    report_count: 0,
    has_general: false,
    submitted_at: null,
    updated_at: '2026-09-18T15:23:39Z',
  },
]

vi.mock('../../services/api', () => ({ listIdrs: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: DEV_USER })
})

function CurrentUrl() {
  const location = useLocation()
  return (
    <>
      <div data-testid="url">{location.pathname + location.search}</div>
      <div data-testid="from">{location.state?.from}</div>
    </>
  )
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/project/HWS0023/drafts']}>
      <Routes>
        <Route path="/project/:projectId/drafts" element={<DraftsListPage />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DraftsListPage', () => {
  it("asks for this inspector's draft IDRs on this project", async () => {
    api.listIdrs.mockResolvedValue(DRAFTS)
    renderPage()
    await screen.findByText('Sep 23, 2026')
    expect(api.listIdrs).toHaveBeenCalledWith({
      projectId: 'HWS0023',
      reporterUuid: DEV_USER.id,
      status: 'draft',
    })
  })

  it('shows each draft as date, report count and General flag, in backend order', async () => {
    api.listIdrs.mockResolvedValue(DRAFTS)
    renderPage()
    const cards = await screen.findAllByRole('button', { name: /reports/i })
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveTextContent('Sep 23, 2026')
    expect(cards[0]).toHaveTextContent('3 reports · With General')
    expect(cards[1]).toHaveTextContent('Sep 16, 2025')
    expect(cards[1]).toHaveTextContent('No reports yet')
  })

  it('does not show the inspector name (every draft here is your own)', async () => {
    api.listIdrs.mockResolvedValue(DRAFTS)
    renderPage()
    await screen.findByText('Sep 23, 2026')
    expect(screen.queryByText(/inspector:/i)).not.toBeInTheDocument()
  })

  it('opens the IDR page for the clicked draft', async () => {
    api.listIdrs.mockResolvedValue(DRAFTS)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByText('Sep 23, 2026'))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/idr/idr-aaaa')
    expect(screen.getByTestId('from')).toHaveTextContent('drafts') // drives the IDR page's Back link
  })

  it('shows an empty state that links back to the project page', async () => {
    api.listIdrs.mockResolvedValue([])
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText(/no draft idrs for this project yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /start a new idr/i }))
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/project\/HWS0023$/)
  })

  it('shows the error and retries on click', async () => {
    api.listIdrs.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce(DRAFTS)
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText(/couldn't load drafts: network error/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('Sep 23, 2026')).toBeInTheDocument()
    expect(api.listIdrs).toHaveBeenCalledTimes(2)
  })
})
