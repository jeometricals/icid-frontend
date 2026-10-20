import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AdminIdrsPage, { ALREADY_UNLOCKED, deleteForeverPhrase, idrName } from '../AdminIdrsPage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { TaskCountContext } from '../../contexts/TaskCountContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

// ---------------------------------------------------------------------------
// Shared mocks: a tiny in-memory "server", so the list read after an action shows what the backend wrote
// ---------------------------------------------------------------------------

const ADMIN = { ...TEST_USER, uuid: 'a0000000-0000-4000-8000-000000000001', email: 'reza@icid.local', first_name: 'Reza',
  last_name: null, role: 'admin' }
const KHAN = TEST_USER.uuid
const REX = 'e0000000-0000-4000-8000-000000000005'

function idr(overrides) {
  return {
    project_id: 'HWS0023',
    reporter_uuid: KHAN,
    reporter_name: 'Genghis Khan',
    status: 'submitted',
    submitted_at: null,
    idr_number: null,
    stage1_reviewer_name: null,
    re_reviewer_uuid: null,
    re_reviewer_name: null,
    stage2_accepted_at: null,
    re_signature_path: null,
    return_reason: null,
    inspector_signature_path: null,
    deleted_at: null,
    ...overrides,
  }
}

// As the backend lists them: most recently edited first, which is not work-date order
const LISTED = [
  idr({ idr_id: 'approved', report_date: '2026-09-16', submitted_at: '2026-09-24T15:00:00Z', status: 'approved',
    idr_number: '004', stage1_reviewer_name: 'Olive Engineer', re_reviewer_uuid: REX, re_reviewer_name: 'Rex Resident',
    stage2_accepted_at: '2026-09-24T14:00:00Z', re_signature_path: 'signatures/rex.png' }),
  idr({ idr_id: 'submitted', report_date: '2026-09-23', submitted_at: '2026-09-23T19:00:00Z', project_id: 'SE384' }),
  idr({ idr_id: 'stage1', report_date: '2026-09-20', submitted_at: '2026-09-25T12:00:00Z', status: 'stage1_review',
    idr_number: '005', stage1_reviewer_name: 'Olive Engineer' }),
  idr({ idr_id: 'stage2', report_date: '2026-09-18', submitted_at: '2026-09-19T12:00:00Z', status: 'stage2_review',
    idr_number: '003', stage1_reviewer_name: 'Olive Engineer' }),
  idr({ idr_id: 'own-draft', report_date: '2026-09-30', status: 'draft', reporter_uuid: ADMIN.uuid, reporter_name: 'Reza' }),
  idr({ idr_id: 'their-draft', report_date: '2026-09-29', status: 'draft' }),
  idr({ idr_id: 'deleted', report_date: '2026-09-10', submitted_at: '2026-09-11T12:00:00Z', status: 'deleted',
    deleted_at: '2026-10-01T12:00:00Z', idr_number: '002', stage1_reviewer_name: 'Olive Engineer' }),
  // Deleted while still a draft, so it never got a number
  idr({ idr_id: 'deleted-draft', report_date: '2026-09-08', status: 'deleted', deleted_at: '2026-10-02T12:00:00Z' }),
]
// The status each deleted IDR had, which an un-delete gives back
const STATUS_BEFORE_DELETE = { deleted: 'approved', 'deleted-draft': 'draft' }

vi.mock('../../services/api', () => ({
  listIdrs: vi.fn(), adminUnlockIdr: vi.fn(), adminDeleteIdr: vi.fn(), undeleteIdr: vi.fn(), permanentDeleteIdr: vi.fn(),
  getIdrFlags: vi.fn(),
}))

// An approved IDR's flags, as getIdrFlags answers: frozen, with this many claimed
const claimedFlags = (count) => ({
  frozen: true, counts: { attributed: count, excluded: 0, claimed_elsewhere: 0, total: count }, flags: [], pay_items: [], unmapped: 0,
})

let server
let refreshTaskCount

const change = (idrId, fields) => {
  server = server.map(row => (row.idr_id === idrId ? { ...row, ...fields } : row))
  return server.find(row => row.idr_id === idrId)
}

beforeEach(() => {
  vi.clearAllMocks()
  refreshTaskCount = vi.fn()
  server = structuredClone(LISTED)
  api.listIdrs.mockImplementation(async ({ includeDeleted } = {}) => (
    structuredClone(server.filter(row => includeDeleted || !row.deleted_at))
  ))
  api.adminUnlockIdr.mockImplementation(async (idrId) => change(idrId, {
    status: 'stage2_review', re_reviewer_uuid: null, re_reviewer_name: null, stage2_accepted_at: null,
    re_signature_path: null, last_unlocked_at: '2026-10-22T10:00:00Z', last_unlocked_by_name: 'Ada Admin',
  }))
  api.adminDeleteIdr.mockImplementation(async (idrId) => change(idrId, {
    status: 'deleted', deleted_at: '2026-10-06T12:00:00Z',
  }))
  api.undeleteIdr.mockImplementation(async (idrId) => change(idrId, {
    status: STATUS_BEFORE_DELETE[idrId], deleted_at: null,
  }))
  api.permanentDeleteIdr.mockImplementation(async (idrId) => {
    server = server.filter(row => row.idr_id !== idrId)
  })
  api.getIdrFlags.mockResolvedValue(claimedFlags(0))
})

function CurrentUrl() {
  return <div data-testid="url">{useLocation().pathname}</div>
}

function renderPage(user = ADMIN) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={['/admin/idrs']}>
      <TaskCountContext.Provider value={{ total: 0, refresh: refreshTaskCount }}>
        <Routes>
          <Route path="/admin/idrs" element={<AdminIdrsPage />} />
          <Route path="*" element={<CurrentUrl />} />
        </Routes>
      </TaskCountContext.Provider>
    </MemoryRouter>
  )
}

const ready = () => screen.findByLabelText('Include deleted')
// Ticks "Include deleted" and waits for the list that comes back with them
async function includeDeleted() {
  await userEvent.click(screen.getByLabelText('Include deleted'))
  await waitFor(() => expect(dates()).toContain('Sep 10, 2026'))
}
const toastText = (text) => screen.queryByText(text)
const rows = () => screen.getAllByRole('row').slice(1)
// Each body row's work date, top to bottom
const dates = () => rows().map(row => within(row).getAllByRole('cell')[0].textContent)
const rowFor = (date) => rows().find(row => within(row).getAllByRole('cell')[0].textContent === date)
const cells = (date) => within(rowFor(date)).getAllByRole('cell').map(cell => cell.textContent)
const dialog = () => screen.queryByRole('dialog')
const columnButton = (name) => screen.getByRole('button', { name })
const actionsIn = (date) => within(rowFor(date)).queryAllByRole('button').map(button => button.textContent)

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

describe('AdminIdrsPage — the table', () => {
  it('asks for every IDR, all drafts included but not the deleted ones, on no one project', async () => {
    renderPage()
    await ready()
    expect(api.listIdrs).toHaveBeenCalledTimes(1)
    expect(api.listIdrs).toHaveBeenCalledWith({ includeDeleted: false, includeAllDrafts: true })
  })

  it('shows a spinner while loading', async () => {
    let finish
    api.listIdrs.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
    await act(async () => finish([]))
    expect(screen.getByText('No IDRs to show.')).toBeInTheDocument()
  })

  it('has the columns, with Actions last', async () => {
    renderPage()
    await ready()
    expect(screen.getAllByRole('columnheader').map(th => th.textContent)).toEqual(
      ['Work date', 'Project', 'IDR #', 'Status', 'Inspector', 'Reviewer', 'Submitted', 'Actions'])
  })

  it('starts on work date, newest first, without deleted IDRs or other people\'s drafts', async () => {
    renderPage()
    await ready()
    expect(dates()).toEqual(['Sep 30, 2026', 'Sep 23, 2026', 'Sep 20, 2026', 'Sep 18, 2026', 'Sep 16, 2026'])
    expect(screen.getByLabelText('Include deleted')).not.toBeChecked()
    expect(screen.getByLabelText('Show all drafts')).not.toBeChecked()
  })

  it('fills a row from the list: project, number, status, inspector, latest reviewer', async () => {
    renderPage()
    await ready()
    const approved = cells('Sep 16, 2026')
    expect(approved.slice(1, 6)).toEqual(['HWS0023', 'IDR number 004', 'Approved', 'Genghis Khan', 'Rex Resident'])
    expect(cells('Sep 23, 2026')[1]).toBe('SE384')
    expect(cells('Sep 20, 2026')[5]).toBe('Olive Engineer')
  })

  it('shows a dash for an IDR with no number, and for a draft\'s submit date', async () => {
    renderPage()
    await ready()
    expect(cells('Sep 23, 2026')[2]).toBe('—')
    expect(cells('Sep 30, 2026')[6]).toBe('—')
  })

  it('shows the error and retries', async () => {
    api.listIdrs.mockRejectedValueOnce(new Error('Failed to list IDRs'))
    renderPage()
    expect(await screen.findByText("Couldn't load the IDRs: Failed to list IDRs")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await ready()
    expect(rows()).toHaveLength(5)
  })

  it('goes back to the project list', async () => {
    renderPage()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Projects' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/projects')
  })
})

// ---------------------------------------------------------------------------
// Toggles
// ---------------------------------------------------------------------------

describe('AdminIdrsPage — toggles', () => {
  it('"Include deleted" asks the backend for the list again, with the deleted IDRs in it', async () => {
    renderPage()
    await ready()
    expect(dates()).not.toContain('Sep 10, 2026')
    await userEvent.click(screen.getByLabelText('Include deleted'))
    await waitFor(() => expect(api.listIdrs).toHaveBeenCalledTimes(2))
    expect(api.listIdrs).toHaveBeenLastCalledWith({ includeDeleted: true, includeAllDrafts: true })
    await waitFor(() => expect(dates()).toContain('Sep 10, 2026'))
    expect(screen.getByLabelText('Include deleted')).toBeChecked()
  })

  it('unticking it asks again without them', async () => {
    renderPage()
    await ready()
    await includeDeleted()
    await userEvent.click(screen.getByLabelText('Include deleted'))
    await waitFor(() => expect(dates()).not.toContain('Sep 10, 2026'))
    expect(api.listIdrs).toHaveBeenCalledTimes(3)
    expect(api.listIdrs).toHaveBeenLastCalledWith({ includeDeleted: false, includeAllDrafts: true })
  })

  it('keeps the table on screen while the list is read again', async () => {
    renderPage()
    await ready()
    let finish
    api.listIdrs.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    await userEvent.click(screen.getByLabelText('Include deleted'))
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(rows()).toHaveLength(5)
    await act(async () => finish(structuredClone(server)))
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    expect(dates()).toContain('Sep 10, 2026')
  })

  it('shows a deleted IDR crossed out, reading Deleted, a deleted draft of someone else\'s included', async () => {
    renderPage()
    await ready()
    await includeDeleted()
    expect(cells('Sep 10, 2026')[3]).toBe('Deleted')
    expect(within(rowFor('Sep 10, 2026')).getByText('002').tagName).toBe('S')
    expect(within(rowFor('Sep 10, 2026')).getByText('Sep 10, 2026')).toHaveClass('line-through')
    expect(cells('Sep 8, 2026')[3]).toBe('Deleted')
    expect(within(rowFor('Sep 8, 2026')).getByText('Sep 8, 2026')).toHaveClass('line-through')
    // An IDR that isn't deleted is not
    expect(within(rowFor('Sep 16, 2026')).getByText('004').tagName).not.toBe('S')
    expect(within(rowFor('Sep 16, 2026')).getByText('Sep 16, 2026')).not.toHaveClass('line-through')
  })

  it('"Show all drafts" brings in everyone\'s drafts, without asking the backend again', async () => {
    renderPage()
    await ready()
    expect(dates()).not.toContain('Sep 29, 2026')
    await userEvent.click(screen.getByLabelText('Show all drafts'))
    expect(dates()).toContain('Sep 29, 2026')
    expect(cells('Sep 29, 2026')[3]).toBe('Draft')
    expect(api.listIdrs).toHaveBeenCalledTimes(1)
  })

  it('says so when nothing is left to show', async () => {
    server = [LISTED[6]]
    renderPage()
    await ready()
    expect(screen.getByText('No IDRs to show.')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Include deleted'))
    await waitFor(() => expect(rows()).toHaveLength(1))
  })

  it('shows a failed re-list as the load error, and Retry reads it', async () => {
    renderPage()
    await ready()
    api.listIdrs.mockRejectedValueOnce(new Error('Failed to list IDRs'))
    await userEvent.click(screen.getByLabelText('Include deleted'))
    expect(await screen.findByText("Couldn't load the IDRs: Failed to list IDRs")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await ready()
    expect(screen.getByLabelText('Include deleted')).toBeChecked()
    expect(dates()).toContain('Sep 10, 2026')
  })
})

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe('AdminIdrsPage — sorting', () => {
  const header = (name) => screen.getByRole('columnheader', { name })

  it('marks work date as the sorted column to start with', async () => {
    renderPage()
    await ready()
    expect(header('Work date')).toHaveAttribute('aria-sort', 'descending')
    expect(header('Submitted')).toHaveAttribute('aria-sort', 'none')
    expect(header('Status')).toHaveAttribute('aria-sort', 'none')
  })

  it('flips work date to oldest first on a second click', async () => {
    renderPage()
    await ready()
    await userEvent.click(columnButton('Work date'))
    expect(header('Work date')).toHaveAttribute('aria-sort', 'ascending')
    expect(dates()).toEqual(['Sep 16, 2026', 'Sep 18, 2026', 'Sep 20, 2026', 'Sep 23, 2026', 'Sep 30, 2026'])
  })

  it('sorts by submit date, latest first, with drafts last', async () => {
    renderPage()
    await ready()
    await userEvent.click(columnButton('Submitted'))
    expect(header('Submitted')).toHaveAttribute('aria-sort', 'descending')
    expect(dates()).toEqual(['Sep 20, 2026', 'Sep 16, 2026', 'Sep 23, 2026', 'Sep 18, 2026', 'Sep 30, 2026'])
  })

  it('sorts by status in the order an IDR moves through them', async () => {
    renderPage()
    await ready()
    await includeDeleted()
    await userEvent.click(columnButton('Status'))
    expect(rows().map(row => within(row).getAllByRole('cell')[3].textContent)).toEqual(
      ['Draft', 'Submitted', 'IDR Check', 'RE Review', 'Approved', 'Deleted', 'Deleted'])
    await userEvent.click(columnButton('Status'))
    expect(header('Status')).toHaveAttribute('aria-sort', 'descending')
    expect(cells(dates()[0])[3]).toBe('Deleted')
  })
})

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

describe('AdminIdrsPage — which actions a row gets', () => {
  it.each([
    ['a draft', 'Sep 30, 2026', ['Soft-delete']],
    ['a submitted IDR', 'Sep 23, 2026', ['Soft-delete']],
    ['an IDR in IDR Check', 'Sep 20, 2026', ['Soft-delete']],
    ['an IDR in RE Review', 'Sep 18, 2026', ['Unlock', 'Soft-delete']],
    ['an approved IDR', 'Sep 16, 2026', ['Unlock', 'Soft-delete']],
  ])('%s', async (_, date, expected) => {
    renderPage()
    await ready()
    expect(actionsIn(date)).toEqual(expected)
  })

  it.each([
    ['a deleted IDR', 'Sep 10, 2026'],
    ['a deleted IDR with no number', 'Sep 8, 2026'],
  ])('%s: Un-delete and Delete forever, and neither Unlock nor Soft-delete', async (_, date) => {
    renderPage()
    await ready()
    await includeDeleted()
    expect(actionsIn(date)).toEqual(['Un-delete', 'Delete forever'])
  })
})

describe('AdminIdrsPage — soft-delete', () => {
  const clickDelete = (date) => userEvent.click(within(rowFor(date)).getByRole('button', { name: 'Soft-delete' }))

  it('asks first, naming the IDR, and does nothing on Cancel', async () => {
    renderPage()
    await ready()
    await clickDelete('Sep 23, 2026')
    expect(dialog()).toHaveAccessibleName('Soft-delete IDR')
    expect(dialog()).toHaveTextContent('IDR: Sep 23, 2026 on SE384 (Genghis Khan)')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(dialog()).not.toBeInTheDocument()
    expect(api.adminDeleteIdr).not.toHaveBeenCalled()
    expect(dates()).toContain('Sep 23, 2026')
  })

  it('deletes, reads the list again, and the IDR is gone until "Include deleted" is on', async () => {
    renderPage()
    await ready()
    await clickDelete('Sep 23, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Soft-delete' }))
    expect(api.adminDeleteIdr).toHaveBeenCalledWith('submitted')
    expect(api.listIdrs).toHaveBeenCalledTimes(2)
    expect(dialog()).not.toBeInTheDocument()
    expect(dates()).not.toContain('Sep 23, 2026')
    await userEvent.click(screen.getByLabelText('Include deleted'))
    await waitFor(() => expect(dates()).toContain('Sep 23, 2026'))
    expect(cells('Sep 23, 2026')[3]).toBe('Deleted')
    expect(actionsIn('Sep 23, 2026')).toEqual(['Un-delete', 'Delete forever'])
  })

  it('with "Include deleted" on, the row stays and turns into a deleted one', async () => {
    renderPage()
    await ready()
    await includeDeleted()
    await clickDelete('Sep 23, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Soft-delete' }))
    expect(api.listIdrs).toHaveBeenLastCalledWith({ includeDeleted: true, includeAllDrafts: true })
    expect(cells('Sep 23, 2026')[3]).toBe('Deleted')
  })

  it('shows what the backend wrote, not what the page expected', async () => {
    // The backend answers the delete but the IDR is still there on the next read
    api.adminDeleteIdr.mockResolvedValue({})
    renderPage()
    await ready()
    await clickDelete('Sep 23, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Soft-delete' }))
    expect(cells('Sep 23, 2026')[3]).toBe('Submitted')
  })

  it('shows a refusal in the dialog and leaves the table alone', async () => {
    api.adminDeleteIdr.mockRejectedValue(Object.assign(new Error('Admin role required'), { status: 403 }))
    renderPage()
    await ready()
    await clickDelete('Sep 23, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Soft-delete' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent("Couldn't delete the IDR: Admin role required")
    expect(api.listIdrs).toHaveBeenCalledTimes(1)
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(dates()).toContain('Sep 23, 2026')
  })

  it('says so when the delete worked but the list could not be read again', async () => {
    renderPage()
    await ready()
    api.listIdrs.mockRejectedValueOnce(new Error('Failed to list IDRs'))
    await clickDelete('Sep 23, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Soft-delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The change was saved, but the list couldn't be refreshed: Failed to list IDRs")
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await ready()
    expect(dates()).not.toContain('Sep 23, 2026')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('AdminIdrsPage — un-delete', () => {
  const clickUndelete = (date) => userEvent.click(within(rowFor(date)).getByRole('button', { name: 'Un-delete' }))

  it('asks first, naming the IDR, and does nothing on Cancel', async () => {
    renderPage()
    await ready()
    await includeDeleted()
    await clickUndelete('Sep 10, 2026')
    expect(dialog()).toHaveAccessibleName('Un-delete IDR 002?')
    expect(dialog()).toHaveTextContent('IDR: Sep 10, 2026 on HWS0023 (Genghis Khan)')
    expect(api.undeleteIdr).not.toHaveBeenCalled()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(dialog()).not.toBeInTheDocument()
    expect(api.undeleteIdr).not.toHaveBeenCalled()
    expect(cells('Sep 10, 2026')[3]).toBe('Deleted')
  })

  it('restores the IDR: its status is back, it is no longer crossed out, and a toast says so', async () => {
    renderPage()
    await ready()
    await includeDeleted()
    await clickUndelete('Sep 10, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    expect(api.undeleteIdr).toHaveBeenCalledTimes(1)
    expect(api.undeleteIdr).toHaveBeenCalledWith('deleted')
    expect(dialog()).not.toBeInTheDocument()
    expect(api.listIdrs).toHaveBeenLastCalledWith({ includeDeleted: true, includeAllDrafts: true })
    expect(cells('Sep 10, 2026')[3]).toBe('Approved')
    expect(within(rowFor('Sep 10, 2026')).getByText('002').tagName).not.toBe('S')
    expect(actionsIn('Sep 10, 2026')).toEqual(['Unlock', 'Soft-delete'])
    expect(toastText('IDR 002 restored to Approved.')).toBeInTheDocument()
    expect(refreshTaskCount).toHaveBeenCalledTimes(1)
  })

  it('names an IDR with no number by its day and project', async () => {
    renderPage()
    await ready()
    await includeDeleted()
    await userEvent.click(screen.getByLabelText('Show all drafts')) // it comes back as someone else's draft
    await clickUndelete('Sep 8, 2026')
    expect(dialog()).toHaveAccessibleName('Un-delete IDR of Sep 8, 2026 on HWS0023?')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    expect(toastText('IDR of Sep 8, 2026 on HWS0023 restored to Draft.')).toBeInTheDocument()
    expect(cells('Sep 8, 2026')[3]).toBe('Draft')
  })

  it('shows a refusal in the dialog, as the backend worded it, and leaves the row deleted', async () => {
    api.undeleteIdr.mockRejectedValue(Object.assign(
      new Error("This IDR's number is now in use on this project"), { status: 409, body: { existing_idr_id: 'stage1' } }))
    renderPage()
    await ready()
    await includeDeleted()
    await clickUndelete('Sep 10, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    expect(await within(dialog()).findByRole('alert'))
      .toHaveTextContent("Couldn't un-delete the IDR: This IDR's number is now in use on this project")
    expect(api.listIdrs).toHaveBeenCalledTimes(2)
    expect(toastText(/restored/)).not.toBeInTheDocument()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(cells('Sep 10, 2026')[3]).toBe('Deleted')
  })
})

describe('AdminIdrsPage — delete forever', () => {
  const clickForever = (date) => userEvent.click(within(rowFor(date)).getByRole('button', { name: 'Delete forever' }))
  const confirmButton = () => within(dialog()).getByRole('button', { name: 'Delete forever' })
  const phraseBox = () => within(dialog()).getByRole('textbox')

  it('opens a dialog that warns what goes, with its button off', async () => {
    renderPage()
    await ready()
    await includeDeleted()
    await clickForever('Sep 10, 2026')
    expect(dialog()).toHaveAccessibleName('Delete IDR forever?')
    expect(dialog()).toHaveTextContent('This will permanently remove IDR 002 and all its data: pay-item quantities, '
      + "reviewer redlines, attachments. This can't be undone.")
    expect(dialog()).toHaveTextContent('IDR: Sep 10, 2026 on HWS0023 (Genghis Khan)')
    expect(within(dialog()).getByLabelText('Type 002 to confirm.')).toHaveValue('')
    expect(confirmButton()).toBeDisabled()
    expect(confirmButton()).toHaveClass('btn-danger')
    expect(api.permanentDeleteIdr).not.toHaveBeenCalled()
  })

  it('turns the button on once the IDR number is typed, then deletes, drops the row and says so', async () => {
    renderPage()
    await ready()
    await includeDeleted()
    await clickForever('Sep 10, 2026')
    await userEvent.type(phraseBox(), '00')
    expect(confirmButton()).toBeDisabled()
    await userEvent.type(phraseBox(), '2')
    expect(confirmButton()).toBeEnabled()
    await userEvent.click(confirmButton())
    expect(api.permanentDeleteIdr).toHaveBeenCalledTimes(1)
    expect(api.permanentDeleteIdr).toHaveBeenCalledWith('deleted')
    expect(dialog()).not.toBeInTheDocument()
    expect(dates()).not.toContain('Sep 10, 2026')
    expect(dates()).toContain('Sep 8, 2026') // the other deleted IDR is still listed
    expect(toastText('IDR 002 permanently deleted.')).toBeInTheDocument()
  })

  it.each([
    ['another number', '004'],
    ['the number with a space after it', '002 '],
    ['the number without its zeros', '2'],
  ])('keeps the button off for %s, and sends nothing', async (_, typed) => {
    renderPage()
    await ready()
    await includeDeleted()
    await clickForever('Sep 10, 2026')
    await userEvent.type(phraseBox(), `${typed}{Enter}`)
    expect(confirmButton()).toBeDisabled()
    expect(api.permanentDeleteIdr).not.toHaveBeenCalled()
    expect(dialog()).toBeInTheDocument()
  })

  it('asks for the work date of an IDR that has no number', async () => {
    renderPage()
    await ready()
    await includeDeleted()
    await clickForever('Sep 8, 2026')
    expect(dialog()).toHaveTextContent('This will permanently remove IDR of Sep 8, 2026 on HWS0023 and all its data')
    await userEvent.type(within(dialog()).getByLabelText('Type 2026-09-08 to confirm.'), '2026-09-08')
    await userEvent.click(confirmButton())
    expect(api.permanentDeleteIdr).toHaveBeenCalledWith('deleted-draft')
    expect(toastText('IDR of Sep 8, 2026 on HWS0023 permanently deleted.')).toBeInTheDocument()
  })

  it('names an IDR and its confirm phrase by its number, or by its day when it has none', () => {
    expect([LISTED[6], LISTED[7]].map(idrName)).toEqual(['IDR 002', 'IDR of Sep 8, 2026 on HWS0023'])
    expect([LISTED[6], LISTED[7]].map(deleteForeverPhrase)).toEqual(['002', '2026-09-08'])
  })

  it('does nothing on Cancel, even with the number typed', async () => {
    renderPage()
    await ready()
    await includeDeleted()
    await clickForever('Sep 10, 2026')
    await userEvent.type(phraseBox(), '002')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(dialog()).not.toBeInTheDocument()
    expect(api.permanentDeleteIdr).not.toHaveBeenCalled()
    expect(dates()).toContain('Sep 10, 2026')
  })

  it('forgets what was typed when the dialog is opened again', async () => {
    renderPage()
    await ready()
    await includeDeleted()
    await clickForever('Sep 10, 2026')
    await userEvent.type(phraseBox(), '002')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    await clickForever('Sep 10, 2026')
    expect(phraseBox()).toHaveValue('')
    expect(confirmButton()).toBeDisabled()
  })

  it('shows a refusal in the dialog and keeps the row', async () => {
    api.permanentDeleteIdr.mockRejectedValue(Object.assign(new Error('IDR must be soft-deleted first'), { status: 404 }))
    renderPage()
    await ready()
    await includeDeleted()
    await clickForever('Sep 10, 2026')
    await userEvent.type(phraseBox(), '002')
    await userEvent.click(confirmButton())
    expect(await within(dialog()).findByText("Couldn't delete the IDR: IDR must be soft-deleted first")).toBeInTheDocument()
    expect(toastText(/permanently deleted/)).not.toBeInTheDocument()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(dates()).toContain('Sep 10, 2026')
  })
})

describe('AdminIdrsPage — unlock', () => {
  const clickUnlock = (date) => userEvent.click(within(rowFor(date)).getByRole('button', { name: 'Unlock' }))
  const toast = () => screen.queryByText(ALREADY_UNLOCKED)

  it('asks first, in the agreed words', async () => {
    renderPage()
    await ready()
    await clickUnlock('Sep 16, 2026')
    expect(dialog()).toHaveAccessibleName('Unlock IDR')
    expect(dialog()).toHaveTextContent(
      'This returns the IDR to RE Review and clears the RE signature. The RE must re-approve to lock it again.')
    expect(api.adminUnlockIdr).not.toHaveBeenCalled()
  })

  it("lists, for an approved IDR, what the unlock reopens and what stays", async () => {
    renderPage()
    await ready()
    await clickUnlock('Sep 16, 2026')
    expect(within(dialog()).getByText(/Its pay-item quantities: removed/)).toBeInTheDocument()
    expect(within(dialog()).getByText(/any RE on the project can accept it again/)).toBeInTheDocument()
    expect(dialog()).toHaveTextContent("What stays: its IDR number, its reports, the inspector's signature and the OE's acceptance.")
  })

  it('shows when an IDR was last unlocked, and by whom', async () => {
    renderPage()
    await ready()
    expect(within(rowFor('Sep 16, 2026')).queryByText(/Last unlocked/)).not.toBeInTheDocument()
    await clickUnlock('Sep 16, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unlock' }))
    expect(await within(rowFor('Sep 16, 2026')).findByText('Last unlocked Oct 22, 2026 by Ada Admin')).toBeInTheDocument()
  })

  it('unlocks an approved IDR: it reads RE Review, with no reviewer, and the task count is refreshed', async () => {
    renderPage()
    await ready()
    await clickUnlock('Sep 16, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unlock' }))
    expect(api.adminUnlockIdr).toHaveBeenCalledWith('approved')
    expect(api.listIdrs).toHaveBeenCalledTimes(2)
    expect(dialog()).not.toBeInTheDocument()
    expect(cells('Sep 16, 2026').slice(2, 6)).toEqual(['IDR number 004', 'RE Review', 'Genghis Khan', 'Olive Engineer'])
    expect(refreshTaskCount).toHaveBeenCalledTimes(1)
  })

  it('shows a refusal in the dialog', async () => {
    api.adminUnlockIdr.mockRejectedValue(
      Object.assign(new Error('Only an approved IDR, or one in Stage 2 review, can be unlocked'), { status: 400 }))
    renderPage()
    await ready()
    await clickUnlock('Sep 16, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unlock' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      "Couldn't unlock the IDR: Only an approved IDR, or one in Stage 2 review, can be unlocked")
    expect(refreshTaskCount).not.toHaveBeenCalled()
  })

  it('on an approved IDR: the POST fires, the row updates and no "already unlocked" toast shows', async () => {
    renderPage()
    await ready()
    await clickUnlock('Sep 16, 2026')
    expect(toast()).not.toBeInTheDocument()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unlock' }))
    expect(api.adminUnlockIdr).toHaveBeenCalledTimes(1)
    expect(cells('Sep 16, 2026')[3]).toBe('RE Review')
    expect(toast()).not.toBeInTheDocument()
  })

  it('on an IDR in RE Review that no RE has accepted: no request, a toast, and the button stays', async () => {
    renderPage()
    await ready()
    await clickUnlock('Sep 18, 2026')
    expect(toast()).toHaveTextContent('Already unlocked — IDR is in RE Review')
    expect(dialog()).not.toBeInTheDocument()
    expect(api.adminUnlockIdr).not.toHaveBeenCalled()
    expect(api.listIdrs).toHaveBeenCalledTimes(1)
    expect(refreshTaskCount).not.toHaveBeenCalled()
    expect(actionsIn('Sep 18, 2026')).toEqual(['Unlock', 'Soft-delete'])
  })

  it('on an IDR in RE Review that an RE has accepted: asks, the POST fires and the RE is taken off it', async () => {
    change('stage2', { re_reviewer_uuid: REX, re_reviewer_name: 'Rex Resident', stage2_accepted_at: '2026-09-26T12:00:00Z' })
    renderPage()
    await ready()
    expect(cells('Sep 18, 2026')[5]).toBe('Rex Resident')
    await clickUnlock('Sep 18, 2026')
    expect(toast()).not.toBeInTheDocument()
    expect(dialog()).toHaveAccessibleName('Unlock IDR')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unlock' }))
    expect(api.adminUnlockIdr).toHaveBeenCalledWith('stage2')
    expect(server.find(row => row.idr_id === 'stage2'))
      .toMatchObject({ status: 'stage2_review', re_reviewer_uuid: null, stage2_accepted_at: null })
    expect(cells('Sep 18, 2026').slice(3, 6)).toEqual(['RE Review', 'Genghis Khan', 'Olive Engineer'])
    expect(refreshTaskCount).toHaveBeenCalledTimes(1)
  })

  it('the row unlocked a moment ago now only gets the toast', async () => {
    renderPage()
    await ready()
    await clickUnlock('Sep 16, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unlock' }))
    await clickUnlock('Sep 16, 2026')
    expect(toast()).toHaveTextContent(ALREADY_UNLOCKED)
    expect(api.adminUnlockIdr).toHaveBeenCalledTimes(1)
  })

  it('drops the toast when another action is asked for', async () => {
    renderPage()
    await ready()
    await clickUnlock('Sep 18, 2026')
    expect(toast()).toBeInTheDocument()
    await clickUnlock('Sep 16, 2026')
    expect(toast()).not.toBeInTheDocument()
    expect(dialog()).toHaveAccessibleName('Unlock IDR')
  })

  it('holds the dialog while it works', async () => {
    let finish
    api.adminUnlockIdr.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderPage()
    await ready()
    await clickUnlock('Sep 16, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unlock' }))
    expect(within(dialog()).getByRole('button', { name: 'Working...' })).toBeDisabled()
    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await act(async () => finish({}))
    expect(dialog()).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Not an admin
// ---------------------------------------------------------------------------

describe('AdminIdrsPage — not an admin', () => {
  it.each([['an inspector', TEST_USER], ['a demo user', DEMO_USER]])('tells %s it is for admins and asks for nothing', (_, user) => {
    renderPage(user)
    expect(screen.getByText('Only an admin can see every IDR.')).toBeInTheDocument()
    expect(api.listIdrs).not.toHaveBeenCalled()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('AdminIdrsPage — flags an unlock or a delete releases', () => {
  const click = (date, name) => userEvent.click(within(rowFor(date)).getByRole('button', { name }))

  it.each([
    ['Unlock', 'Unlock', 'adminUnlockIdr', 'IDR 004 unlocked; 18 flags released.'],
    ['Soft-delete', 'Soft-delete', 'adminDeleteIdr', 'IDR 004 deleted; 18 flags released.'],
  ])('%s on an approved IDR reads how many flags it claimed, warns, and says how many went', async (button, confirmLabel, call, done) => {
    api.getIdrFlags.mockResolvedValue(claimedFlags(18))
    api[call].mockResolvedValue({ idr_id: 'approved', flags_released: 18 })
    renderPage()
    await ready()
    await click('Sep 16, 2026', button)
    expect(await within(dialog()).findByText(/This will release 18 flags back to the pool\./)).toBeInTheDocument()
    expect(api.getIdrFlags).toHaveBeenCalledWith('approved')

    await userEvent.click(within(dialog()).getByRole('button', { name: confirmLabel }))
    expect(await screen.findByText(done)).toBeInTheDocument()
  })

  it('says how many curb segments went too', async () => {
    api.getIdrFlags.mockResolvedValue(claimedFlags(18))
    api.adminUnlockIdr.mockResolvedValue({ idr_id: 'approved', flags_released: 18, segments_released: 3 })
    renderPage()
    await ready()
    await click('Sep 16, 2026', 'Unlock')
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Unlock' }))
    expect(await screen.findByText('IDR 004 unlocked; 18 flags and 3 curb segments released.')).toBeInTheDocument()
  })

  it('says it is counting while the flags are read', async () => {
    api.getIdrFlags.mockReturnValue(new Promise(() => {}))
    renderPage()
    await ready()
    await click('Sep 16, 2026', 'Unlock')
    expect(dialog()).toHaveTextContent('Counting the flags it claimed...')
  })

  it('says an approved IDR that claimed nothing releases nothing', async () => {
    renderPage()
    await ready()
    await click('Sep 16, 2026', 'Unlock')
    expect(await within(dialog()).findByText(/It has claimed no flags, so none are released\./)).toBeInTheDocument()
  })

  it("still lets the admin go on when the flags can't be counted", async () => {
    api.getIdrFlags.mockRejectedValue(new Error('Network error'))
    renderPage()
    await ready()
    await click('Sep 16, 2026', 'Unlock')
    expect(await within(dialog()).findByText(/Couldn't count the flags it claimed: Network error/)).toBeInTheDocument()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unlock' }))
    expect(api.adminUnlockIdr).toHaveBeenCalledWith('approved')
  })

  it("doesn't ask about the flags of an IDR that isn't approved: it has claimed none", async () => {
    renderPage()
    await ready()
    await click('Sep 23, 2026', 'Soft-delete')
    expect(dialog()).not.toHaveTextContent(/flags/)
    expect(api.getIdrFlags).not.toHaveBeenCalled()
  })

  it('says how many flags an un-delete back to approved claimed back', async () => {
    api.undeleteIdr.mockResolvedValue({ idr_id: 'deleted', status: 'approved', flags_claimed: 3 })
    renderPage()
    await ready()
    await includeDeleted()
    await click('Sep 10, 2026', 'Un-delete')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    expect(await screen.findByText('IDR 002 restored to Approved. 3 flags claimed back.')).toBeInTheDocument()
  })
})
