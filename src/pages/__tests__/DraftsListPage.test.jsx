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
    report_id: 'aaaa-1111',
    report_date: '2026-09-23',
    status: 'draft',
    updated_at: '2026-09-23T17:45:04Z',
    description_preview: 'Poured curb on 5th Ave',
  },
  {
    report_id: 'bbbb-2222',
    report_date: '2025-09-16',
    status: 'draft',
    updated_at: '2026-09-18T15:23:39Z',
    description_preview: null,
  },
]

vi.mock('../../services/api', () => ({ listReports: vi.fn() }))

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
  it("asks for this inspector's drafts on this project", async () => {
    api.listReports.mockResolvedValue(DRAFTS)
    renderPage()
    await screen.findByText('Poured curb on 5th Ave')
    expect(api.listReports).toHaveBeenCalledWith({
      projectId: 'HWS0023',
      reporterUuid: DEV_USER.id,
      status: 'draft',
    })
  })

  it('shows report date in local time (no off-by-one day) and a placeholder for missing descriptions', async () => {
    api.listReports.mockResolvedValue(DRAFTS)
    renderPage()
    expect(await screen.findByText('Wed, Sep 23, 2026')).toBeInTheDocument()
    expect(screen.getByText('Tue, Sep 16, 2025')).toBeInTheDocument()
    expect(screen.getByText('No description yet')).toBeInTheDocument()
  })

  it('opens the draft in the General Form with its report_id in the URL', async () => {
    api.listReports.mockResolvedValue(DRAFTS)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByText('Poured curb on 5th Ave'))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/report/general?report_id=aaaa-1111')
    expect(screen.getByTestId('from')).toHaveTextContent('drafts') // drives the report page's error-state Back link
  })

  it('shows an empty state when there are no drafts', async () => {
    api.listReports.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(/no drafts for this project yet/i)).toBeInTheDocument()
  })

  it('shows the error and retries on click', async () => {
    api.listReports.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce(DRAFTS)
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText(/couldn't load drafts: network error/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('Poured curb on 5th Ave')).toBeInTheDocument()
    expect(api.listReports).toHaveBeenCalledTimes(2)
  })
})
