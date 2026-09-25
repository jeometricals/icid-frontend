import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ReportArchivePage from '../ReportArchivePage'
import * as api from '../../services/api'

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const KHAN = '327d3ed2-a3d6-4235-9408-7fe721b12bed'
const SHAH = '5246b39d-87fe-4e21-92a3-2804c899e8b3'

const USERS = [
  { user_id: KHAN, email: 'KhanG@magnoleng.pc', first_name: 'Genghis', last_name: 'Khan' },
  { user_id: SHAH, email: 'Nadir.shah@goorkaneng.com', first_name: 'Nadir', last_name: 'Shah' },
]

// Backend order (updated_at desc = submission order for submitted IDRs); the page must keep it as-is
const SUBMITTED = [
  {
    idr_id: 'idr-newer',
    reporter_uuid: SHAH,
    report_date: '2026-09-23',
    status: 'submitted',
    report_count: 1,
    has_general: true,
    submitted_at: '2026-09-23T19:27:16Z',
    updated_at: '2026-09-23T19:27:16Z',
  },
  {
    idr_id: 'idr-older',
    reporter_uuid: KHAN,
    report_date: '2025-09-16',
    status: 'submitted',
    report_count: 2,
    has_general: false,
    submitted_at: '2026-09-18T15:23:39Z',
    updated_at: '2026-09-18T15:23:39Z',
  },
]

vi.mock('../../services/api', () => ({ listIdrs: vi.fn(), listUsers: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  api.listUsers.mockResolvedValue(USERS)
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

const cards = () => screen.getAllByRole('button').filter(b => b.textContent.includes('Submitted'))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReportArchivePage', () => {
  it("asks for all submitted IDRs on this project, not just this inspector's", async () => {
    api.listIdrs.mockResolvedValue(SUBMITTED)
    renderPage()
    await screen.findByText('Sep 23, 2026')
    expect(api.listIdrs).toHaveBeenCalledWith({ projectId: 'HWS0023', status: 'submitted' })
  })

  it('shows each IDR as date, report count, General flag and submission time, in backend order', async () => {
    api.listIdrs.mockResolvedValue(SUBMITTED)
    renderPage()
    await screen.findByText('Sep 23, 2026')
    const [first, second] = cards()
    expect(first).toHaveTextContent('Sep 23, 2026')
    expect(first).toHaveTextContent('1 report · General only')
    expect(first).toHaveTextContent(/Submitted Sep 23, 2026 at \d{1,2}:\d{2} [AP]M/)
    expect(second).toHaveTextContent('Sep 16, 2025')
    expect(second).toHaveTextContent('2 reports · No General')
  })

  it('shows who submitted each IDR, resolved from the users list', async () => {
    api.listIdrs.mockResolvedValue(SUBMITTED)
    renderPage()
    await screen.findByText('Sep 23, 2026')
    const [first, second] = cards()
    expect(first).toHaveTextContent('Inspector: Nadir Shah')
    expect(second).toHaveTextContent('Inspector: Genghis Khan')
  })

  it('falls back to email when a user has no name, and to "Unknown inspector" for an unknown uuid', async () => {
    api.listUsers.mockResolvedValue([{ user_id: SHAH, email: 'Nadir.shah@goorkaneng.com', first_name: null, last_name: null }])
    api.listIdrs.mockResolvedValue(SUBMITTED)
    renderPage()
    await screen.findByText('Sep 23, 2026')
    const [first, second] = cards()
    expect(first).toHaveTextContent('Inspector: Nadir.shah@goorkaneng.com')
    expect(second).toHaveTextContent('Inspector: Unknown inspector')
  })

  it('opens the IDR page for the clicked IDR', async () => {
    api.listIdrs.mockResolvedValue(SUBMITTED)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByText('Sep 23, 2026'))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/idr/idr-newer')
    expect(screen.getByTestId('from')).toHaveTextContent('archive') // drives the IDR page's Back link
  })

  it('shows an empty state when nothing has been submitted', async () => {
    api.listIdrs.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(/no submitted idrs for this project yet/i)).toBeInTheDocument()
  })

  it('shows the error and retries on click', async () => {
    api.listIdrs.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce(SUBMITTED)
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText(/couldn't load submitted idrs: network error/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('Sep 23, 2026')).toBeInTheDocument()
    expect(api.listIdrs).toHaveBeenCalledTimes(2)
  })

  it('shows the error state when the users list fails to load, and retries both', async () => {
    api.listIdrs.mockResolvedValue(SUBMITTED)
    api.listUsers.mockRejectedValueOnce(new Error('Failed to list users'))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText(/couldn't load submitted idrs: failed to list users/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('Inspector: Nadir Shah')).toBeInTheDocument()
    expect(api.listUsers).toHaveBeenCalledTimes(2)
  })
})
