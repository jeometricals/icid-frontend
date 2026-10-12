import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
      <div data-testid="archive-search">{location.state?.archiveSearch}</div>
    </>
  )
}

// Shows the archive's own query string beside the page, as the address bar would
function ArchiveWithUrl() {
  const location = useLocation()
  return (
    <>
      <div data-testid="archive-url">{location.search}</div>
      <ReportArchivePage />
    </>
  )
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/project/HWS0023/archive${search}`]}>
      <Routes>
        <Route path="/project/:projectId/archive" element={<ArchiveWithUrl />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

const archiveUrl = () => screen.getByTestId('archive-url').textContent
const lastListCall = () => api.listIdrs.mock.calls.at(-1)[0]

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
    expect(stageOne).toHaveTextContent('IDR Check')
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

// ---------------------------------------------------------------------------
// Filters: in the URL, sent to the backend
// ---------------------------------------------------------------------------

describe('ReportArchivePage — filters', () => {
  beforeEach(() => { api.listIdrs.mockResolvedValue(LISTED) })

  it('shows the filter panel above the table, with a checkbox per discipline', async () => {
    renderPage()
    await screen.findByText('Sep 23, 2026')
    const panel = screen.getByRole('region', { name: 'Filters' })
    expect(within(panel).getAllByRole('checkbox')).toHaveLength(6)
    expect(panel.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('typing an IDR # puts it in the URL after the debounce and asks the backend again', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Sep 23, 2026')
    await user.type(screen.getByLabelText('IDR #'), 'sw')
    expect(archiveUrl()).toBe('') // not yet
    await waitFor(() => expect(archiveUrl()).toBe('?idr_number=sw'))
    expect(api.listIdrs).toHaveBeenCalledTimes(2) // once on load, once for the whole word
    expect(lastListCall()).toEqual({ projectId: 'HWS0023', idrNumber: 'sw' })
    expect(screen.getByLabelText('IDR #')).toHaveFocus() // the panel is not remounted by the reload
  })

  it('a work date goes in the URL and replaces a range; a range replaces a work date', async () => {
    renderPage('?from=2026-10-01&to=2026-10-07')
    await screen.findByText('Sep 23, 2026')
    fireEvent.change(screen.getByLabelText('Work date'), { target: { value: '2026-10-04' } })
    await waitFor(() => expect(archiveUrl()).toBe('?work_date=2026-10-04'))
    expect(lastListCall()).toEqual({ projectId: 'HWS0023', workDate: '2026-10-04' })

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-02' } })
    await waitFor(() => expect(archiveUrl()).toBe('?from=2026-10-02'))
    expect(lastListCall()).toEqual({ projectId: 'HWS0023', from: '2026-10-02' })

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-09' } })
    await waitFor(() => expect(archiveUrl()).toBe('?from=2026-10-02&to=2026-10-09'))
    expect(lastListCall()).toEqual({ projectId: 'HWS0023', from: '2026-10-02', to: '2026-10-09' })
  })

  it('each ticked discipline is its own discipline parameter', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Sep 23, 2026')
    await user.click(screen.getByRole('checkbox', { name: 'Sidewalk' }))
    await user.click(screen.getByRole('checkbox', { name: 'AC Pavement' }))
    await waitFor(() => expect(archiveUrl()).toBe('?discipline=AC+Pavement&discipline=Sidewalk'))
    expect(lastListCall()).toEqual({ projectId: 'HWS0023', disciplines: ['AC Pavement', 'Sidewalk'] })
  })

  it('a linked or reloaded URL fills the inputs and filters the first request', async () => {
    renderPage('?idr_number=SW&from=2026-10-01&to=2026-10-07&discipline=Curb&discipline=Sidewalk')
    await screen.findByText('Sep 23, 2026')
    expect(api.listIdrs).toHaveBeenCalledTimes(1)
    expect(lastListCall()).toEqual({
      projectId: 'HWS0023', idrNumber: 'SW', from: '2026-10-01', to: '2026-10-07', disciplines: ['Curb', 'Sidewalk'],
    })
    expect(screen.getByLabelText('IDR #')).toHaveValue('SW')
    expect(screen.getByLabelText('From')).toHaveValue('2026-10-01')
    expect(screen.getByLabelText('To')).toHaveValue('2026-10-07')
    expect(screen.getByRole('checkbox', { name: 'Curb' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Sidewalk' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'General' })).not.toBeChecked()
  })

  it('Clear filters empties the URL and the inputs and lists everything again', async () => {
    const user = userEvent.setup()
    renderPage('?idr_number=SW&work_date=2026-10-04&discipline=Sidewalk')
    await screen.findByText('Sep 23, 2026')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(archiveUrl()).toBe(''))
    expect(lastListCall()).toEqual({ projectId: 'HWS0023' })
    expect(screen.getByLabelText('IDR #')).toHaveValue('')
    expect(screen.getByLabelText('Work date')).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Sidewalk' })).not.toBeChecked()
  })

  it('says nothing matches, rather than nothing submitted, when the filters leave no IDR', async () => {
    api.listIdrs.mockResolvedValue([])
    renderPage('?discipline=Concrete+%28delivery%29')
    expect(await screen.findByText('No submitted IDRs match these filters.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeEnabled()
  })

  it('shows the backend\'s refusal of a hand-edited URL, with Clear filters at hand', async () => {
    api.listIdrs.mockRejectedValueOnce(new Error('Unknown discipline: Nonsense')).mockResolvedValue(LISTED)
    const user = userEvent.setup()
    renderPage('?discipline=Nonsense')
    expect(await screen.findByText(/couldn't load submitted idrs: unknown discipline: nonsense/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByText('Sep 23, 2026')).toBeInTheDocument()
    expect(archiveUrl()).toBe('')
  })

  it('opening an IDR hands its page the filters, for Back', async () => {
    const user = userEvent.setup()
    renderPage('?idr_number=SW&discipline=Sidewalk')
    await user.click(await screen.findByRole('button', { name: 'Sep 23, 2026' }))
    expect(screen.getByTestId('from')).toHaveTextContent('archive')
    expect(screen.getByTestId('archive-search')).toHaveTextContent('?idr_number=SW&discipline=Sidewalk')
  })
})

// ---------------------------------------------------------------------------
// Discipline chips
// ---------------------------------------------------------------------------

describe('ReportArchivePage — discipline chips', () => {
  it('shows each IDR\'s disciplines beside its number, as the backend ordered them', async () => {
    api.listIdrs.mockResolvedValue([
      idr({ idr_id: 'swcb', report_date: '2026-09-23', idr_number: 'SW-1', disciplines: ['Curb', 'Sidewalk'] }),
      idr({ idr_id: 'mixed', report_date: '2026-09-22', idr_number: '007',
        disciplines: ['AC Pavement', 'Concrete (delivery)', 'General'] }),
      idr({ idr_id: 'empty', report_date: '2026-09-21', disciplines: [] }),
    ])
    renderPage()
    await screen.findByText('Sep 23, 2026')
    const chips = row => within(row).queryAllByRole('listitem').map(chip => chip.textContent)
    expect(rows().map(chips)).toEqual([
      ['Curb', 'Sidewalk'],
      ['AC Pavement', 'Concrete (delivery)', 'General'],
      [],
    ])
  })
})
