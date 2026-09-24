import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ReportArchivePage from '../ReportArchivePage'
import * as api from '../../services/api'

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

// Backend order is updated_at desc; the older submission comes first here to prove the page re-sorts by submitted_at
const SUBMITTED = [
  {
    report_id: 'aaaa-1111',
    report_date: '2025-09-16',
    status: 'submitted',
    updated_at: '2026-09-24T10:00:00Z',
    submitted_at: '2026-09-18T15:23:39Z',
    description_preview: 'Older submission',
  },
  {
    report_id: 'bbbb-2222',
    report_date: '2026-09-23',
    status: 'submitted',
    updated_at: '2026-09-23T19:27:16Z',
    submitted_at: '2026-09-23T19:27:16Z',
    description_preview: 'Poured curb on 5th Ave',
  },
]

vi.mock('../../services/api', () => ({ listReports: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
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
    <MemoryRouter initialEntries={['/project/HWS0023/archive']}>
      <Routes>
        <Route path="/project/:projectId/archive" element={<ReportArchivePage />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReportArchivePage', () => {
  it("asks for all submitted reports on this project, not just this inspector's", async () => {
    api.listReports.mockResolvedValue(SUBMITTED)
    renderPage()
    await screen.findByText('Poured curb on 5th Ave')
    expect(api.listReports).toHaveBeenCalledWith({ projectId: 'HWS0023', status: 'submitted' })
  })

  it('shows report date in local time and when each report was submitted', async () => {
    api.listReports.mockResolvedValue(SUBMITTED)
    renderPage()
    expect(await screen.findByText('Wed, Sep 23, 2026')).toBeInTheDocument()
    expect(screen.getByText('Tue, Sep 16, 2025')).toBeInTheDocument()
    expect(screen.getAllByText(/^Submitted /)).toHaveLength(2)
  })

  it('lists the most recent submission first', async () => {
    api.listReports.mockResolvedValue(SUBMITTED)
    renderPage()
    await screen.findByText('Poured curb on 5th Ave')
    const cards = screen.getAllByRole('button').filter(b => b.textContent.includes('Submitted'))
    expect(cards[0]).toHaveTextContent('Poured curb on 5th Ave')
    expect(cards[1]).toHaveTextContent('Older submission')
  })

  it('falls back gracefully when submitted_at is missing', async () => {
    api.listReports.mockResolvedValue([{ ...SUBMITTED[1], submitted_at: null }])
    renderPage()
    expect(await screen.findByText('Submitted (date unknown)')).toBeInTheDocument()
  })

  it('opens the report in the General Form with its report_id in the URL', async () => {
    api.listReports.mockResolvedValue(SUBMITTED)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByText('Poured curb on 5th Ave'))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/report/general?report_id=bbbb-2222')
    expect(screen.getByTestId('from')).toHaveTextContent('archive') // drives the report page's error-state Back link
  })

  it('shows an empty state when nothing has been submitted', async () => {
    api.listReports.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(/no submitted reports for this project yet/i)).toBeInTheDocument()
  })

  it('shows the error and retries on click', async () => {
    api.listReports.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce(SUBMITTED)
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText(/couldn't load submitted reports: network error/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('Poured curb on 5th Ave')).toBeInTheDocument()
    expect(api.listReports).toHaveBeenCalledTimes(2)
  })
})
