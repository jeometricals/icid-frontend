import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ReportArchivePage from '../ReportArchivePage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER, TEST_USER_ID } from '../../test/users'

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const KHAN = TEST_USER_ID
const SHAH = '5246b39d-87fe-4e21-92a3-2804c899e8b3'

function idr(overrides) {
  return {
    project_id: 'HWS0023',
    reporter_uuid: KHAN,
    reporter_name: 'Genghis Khan',
    status: 'submitted',
    report_count: 1,
    has_general: true,
    idr_number: null,
    stage1_reviewer_name: null,
    re_reviewer_name: null,
    return_reason: null,
    inspector_signature_path: null,
    ...overrides,
  }
}

// As the backend lists them: most recently edited first, which is not work-date order
const LISTED = [
  idr({ idr_id: 'idr-sep16', report_date: '2025-09-16', submitted_at: '2026-09-24T15:23:39Z', status: 'approved',
    idr_number: '004', stage1_reviewer_name: 'Olive Engineer', re_reviewer_name: 'Rex Resident' }),
  idr({ idr_id: 'idr-sep23', report_date: '2026-09-23', submitted_at: '2026-09-23T19:27:16Z', reporter_uuid: SHAH,
    reporter_name: 'Nadir Shah' }),
  idr({ idr_id: 'idr-sep20', report_date: '2026-09-20', submitted_at: '2026-09-21T12:00:00Z', status: 'stage1_review',
    idr_number: '005', stage1_reviewer_name: 'Olive Engineer' }),
]

vi.mock('../../services/api', () => ({ listIdrs: vi.fn(), listUsers: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: TEST_USER })
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

// The table's body rows, top to bottom
const rows = () => screen.getAllByRole('row').slice(1)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReportArchivePage', () => {
  it("asks for the project's IDRs at every status, not just this inspector's", async () => {
    api.listIdrs.mockResolvedValue(LISTED)
    renderPage()
    await screen.findByText('Sep 23, 2026')
    expect(api.listIdrs).toHaveBeenCalledWith({ projectId: 'HWS0023' })
    expect(api.listUsers).not.toHaveBeenCalled() // names come with the list now
  })

  it('sorts by work date, newest first, whatever order the backend lists them in', async () => {
    api.listIdrs.mockResolvedValue(LISTED)
    renderPage()
    await screen.findByText('Sep 23, 2026')
    expect(rows().map(row => within(row).getByRole('button').textContent)).toEqual([
      'Sep 23, 2026', 'Sep 20, 2026', 'Sep 16, 2025',
    ])
  })

  it('breaks a tie on the work date by the latest submission', async () => {
    api.listIdrs.mockResolvedValue([
      idr({ idr_id: 'early', report_date: '2026-09-23', submitted_at: '2026-09-23T10:00:00Z', reporter_name: 'Early Bird' }),
      idr({ idr_id: 'late', report_date: '2026-09-23', submitted_at: '2026-09-23T18:00:00Z', reporter_name: 'Late Riser' }),
    ])
    renderPage()
    await screen.findAllByText('Sep 23, 2026')
    expect(rows()[0]).toHaveTextContent('Late Riser')
    expect(rows()[1]).toHaveTextContent('Early Bird')
  })

  it('has a column for the work date, IDR #, status, inspector, reviewer and submit time', async () => {
    api.listIdrs.mockResolvedValue(LISTED)
    renderPage()
    await screen.findByText('Sep 23, 2026')
    expect(screen.getAllByRole('columnheader').map(th => th.textContent)).toEqual([
      'Work date', 'IDR #', 'Status', 'Inspector', 'Reviewer', 'Submitted',
    ])
  })

  it('shows each IDR with its number, status badge, inspector, latest reviewer and submit time', async () => {
    api.listIdrs.mockResolvedValue(LISTED)
    renderPage()
    await screen.findByText('Sep 23, 2026')
    const [submitted, stageOne, approved] = rows()
    expect(submitted).toHaveTextContent('No IDR # yet')
    expect(submitted).toHaveTextContent('Submitted')
    expect(submitted).toHaveTextContent('Nadir Shah')
    expect(submitted).toHaveTextContent(/Sep 23, 2026 at \d{1,2}:\d{2} [AP]M/)
    expect(stageOne).toHaveTextContent('005')
    expect(stageOne).toHaveTextContent('Stage 1 Review')
    expect(stageOne).toHaveTextContent('Olive Engineer')
    expect(approved).toHaveTextContent('004')
    expect(approved).toHaveTextContent('Approved')
    expect(approved).toHaveTextContent('Rex Resident') // the RE, once there is one
    expect(approved).not.toHaveTextContent('Olive Engineer')
  })

  it("leaves out drafts, which the list carries for the user's own IDRs (a returned one among them)", async () => {
    api.listIdrs.mockResolvedValue([
      ...LISTED,
      idr({ idr_id: 'my-draft', report_date: '2026-09-28', status: 'draft', submitted_at: null }),
      idr({ idr_id: 'returned', report_date: '2026-09-27', status: 'draft', return_reason: 'fix the quantity', idr_number: '006' }),
    ])
    renderPage()
    await screen.findByText('Sep 23, 2026')
    expect(rows()).toHaveLength(3)
    expect(screen.queryByText('Sep 28, 2026')).not.toBeInTheDocument()
    expect(screen.queryByText('Sep 27, 2026')).not.toBeInTheDocument()
  })

  it('says "Unknown inspector" when the list has no name for one', async () => {
    api.listIdrs.mockResolvedValue([idr({ idr_id: 'x', report_date: '2026-09-23', submitted_at: null, reporter_name: null })])
    renderPage()
    await screen.findByText('Sep 23, 2026')
    expect(rows()[0]).toHaveTextContent('Unknown inspector')
    expect(rows()[0]).toHaveTextContent('Date unknown') // and a missing submit time doesn't crash the row
  })

  it('opens the IDR page for the clicked IDR', async () => {
    api.listIdrs.mockResolvedValue(LISTED)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Sep 23, 2026' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/idr/idr-sep23')
    expect(screen.getByTestId('from')).toHaveTextContent('archive') // drives the IDR page's Back link
  })

  it('opens the IDR from anywhere on its row', async () => {
    api.listIdrs.mockResolvedValue(LISTED)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByText('Rex Resident'))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/idr/idr-sep16')
  })

  it('shows an empty state when nothing has been submitted', async () => {
    api.listIdrs.mockResolvedValue([idr({ idr_id: 'my-draft', report_date: '2026-09-28', status: 'draft' })])
    renderPage()
    expect(await screen.findByText(/no submitted idrs for this project yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows the error and retries on click', async () => {
    api.listIdrs.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce(LISTED)
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText(/couldn't load submitted idrs: network error/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('Sep 23, 2026')).toBeInTheDocument()
    expect(api.listIdrs).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// Demo users: the backend refuses them the user list, which the page no longer needs
// ---------------------------------------------------------------------------

describe('ReportArchivePage for a demo user', () => {
  it('lists the archive like anyone else, without the user list', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: DEMO_USER })
    api.listIdrs.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(/No submitted IDRs for this project yet/)).toBeInTheDocument()
    expect(api.listIdrs).toHaveBeenCalledWith({ projectId: 'HWS0023' })
    expect(api.listUsers).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Signed mark
// ---------------------------------------------------------------------------

describe('ReportArchivePage — signed IDRs', () => {
  it('marks only the IDRs that were submitted with a signature, at any status', async () => {
    api.listIdrs.mockResolvedValue([
      idr({ idr_id: 'signed', report_date: '2026-09-23', submitted_at: '2026-09-23T19:27:16Z', status: 'stage2_review',
        inspector_signature_path: 'idrs/a/inspector_1.png' }),
      idr({ idr_id: 'legacy', report_date: '2025-09-16', submitted_at: '2026-09-18T15:23:39Z' }),
    ])
    renderPage()
    await screen.findByText('Sep 23, 2026')
    const [signedRow, legacyRow] = rows()
    expect(signedRow).toHaveTextContent('Signed')
    expect(legacyRow).not.toHaveTextContent('Signed')
    expect(legacyRow).not.toHaveTextContent(/unsigned/i)
  })
})
