import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AdminIdrsPage from '../AdminIdrsPage'
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

function idr(overrides) {
  return {
    project_id: 'HWS0023',
    reporter_uuid: KHAN,
    reporter_name: 'Genghis Khan',
    status: 'submitted',
    submitted_at: null,
    idr_number: null,
    stage1_reviewer_name: null,
    re_reviewer_name: null,
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
    idr_number: '004', stage1_reviewer_name: 'Olive Engineer', re_reviewer_name: 'Rex Resident',
    re_signature_path: 'signatures/rex.png' }),
  idr({ idr_id: 'submitted', report_date: '2026-09-23', submitted_at: '2026-09-23T19:00:00Z', project_id: 'SE384' }),
  idr({ idr_id: 'stage1', report_date: '2026-09-20', submitted_at: '2026-09-25T12:00:00Z', status: 'stage1_review',
    idr_number: '005', stage1_reviewer_name: 'Olive Engineer' }),
  idr({ idr_id: 'stage2', report_date: '2026-09-18', submitted_at: '2026-09-19T12:00:00Z', status: 'stage2_review',
    idr_number: '003', stage1_reviewer_name: 'Olive Engineer' }),
  idr({ idr_id: 'own-draft', report_date: '2026-09-30', status: 'draft', reporter_uuid: ADMIN.uuid, reporter_name: 'Reza' }),
  idr({ idr_id: 'their-draft', report_date: '2026-09-29', status: 'draft' }),
  idr({ idr_id: 'deleted', report_date: '2026-09-10', submitted_at: '2026-09-11T12:00:00Z', status: 'deleted',
    deleted_at: '2026-10-01T12:00:00Z' }),
]

vi.mock('../../services/api', () => ({ listIdrs: vi.fn(), adminUnlockIdr: vi.fn(), adminDeleteIdr: vi.fn() }))

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
  api.listIdrs.mockImplementation(async () => structuredClone(server))
  api.adminUnlockIdr.mockImplementation(async (idrId) => change(idrId, {
    status: 'stage2_review', re_reviewer_name: null, re_signature_path: null,
  }))
  api.adminDeleteIdr.mockImplementation(async (idrId) => change(idrId, {
    status: 'deleted', deleted_at: '2026-10-06T12:00:00Z',
  }))
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

const ready = () => screen.findByLabelText('Show deleted')
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
  it('asks for every IDR, deleted ones and all drafts included, on no one project', async () => {
    renderPage()
    await ready()
    expect(api.listIdrs).toHaveBeenCalledTimes(1)
    expect(api.listIdrs).toHaveBeenCalledWith({ includeDeleted: true, includeAllDrafts: true })
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
    expect(screen.getByLabelText('Show deleted')).not.toBeChecked()
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
  it('"Show deleted" brings in deleted IDRs, with a Deleted badge in place of the actions', async () => {
    renderPage()
    await ready()
    await userEvent.click(screen.getByLabelText('Show deleted'))
    expect(dates()).toContain('Sep 10, 2026')
    expect(cells('Sep 10, 2026')[7]).toBe('Deleted')
    expect(actionsIn('Sep 10, 2026')).toEqual([])
    await userEvent.click(screen.getByLabelText('Show deleted'))
    expect(dates()).not.toContain('Sep 10, 2026')
  })

  it('"Show all drafts" brings in everyone\'s drafts', async () => {
    renderPage()
    await ready()
    expect(dates()).not.toContain('Sep 29, 2026')
    await userEvent.click(screen.getByLabelText('Show all drafts'))
    expect(dates()).toContain('Sep 29, 2026')
    expect(cells('Sep 29, 2026')[3]).toBe('Draft')
  })

  it('does not ask the backend again', async () => {
    renderPage()
    await ready()
    await userEvent.click(screen.getByLabelText('Show deleted'))
    await userEvent.click(screen.getByLabelText('Show all drafts'))
    expect(api.listIdrs).toHaveBeenCalledTimes(1)
  })

  it('says so when nothing is left to show', async () => {
    server = [LISTED[6]]
    renderPage()
    await ready()
    expect(screen.getByText('No IDRs to show.')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Show deleted'))
    expect(rows()).toHaveLength(1)
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
    await userEvent.click(screen.getByLabelText('Show deleted'))
    await userEvent.click(columnButton('Status'))
    expect(rows().map(row => within(row).getAllByRole('cell')[3].textContent)).toEqual(
      ['Draft', 'Submitted', 'IDR Check', 'RE Review', 'Approved', 'Deleted'])
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

  it('deletes, reads the list again, and the IDR is gone until "Show deleted" is on', async () => {
    renderPage()
    await ready()
    await clickDelete('Sep 23, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Soft-delete' }))
    expect(api.adminDeleteIdr).toHaveBeenCalledWith('submitted')
    expect(api.listIdrs).toHaveBeenCalledTimes(2)
    expect(dialog()).not.toBeInTheDocument()
    expect(dates()).not.toContain('Sep 23, 2026')
    await userEvent.click(screen.getByLabelText('Show deleted'))
    expect(cells('Sep 23, 2026')[7]).toBe('Deleted')
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

describe('AdminIdrsPage — unlock', () => {
  const clickUnlock = (date) => userEvent.click(within(rowFor(date)).getByRole('button', { name: 'Unlock' }))

  it('asks first, in the agreed words', async () => {
    renderPage()
    await ready()
    await clickUnlock('Sep 16, 2026')
    expect(dialog()).toHaveAccessibleName('Unlock IDR')
    expect(dialog()).toHaveTextContent(
      'This returns the IDR to RE Review and clears the RE signature. The RE must re-approve to lock it again.')
    expect(api.adminUnlockIdr).not.toHaveBeenCalled()
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
    await clickUnlock('Sep 18, 2026')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unlock' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      "Couldn't unlock the IDR: Only an approved IDR, or one in Stage 2 review, can be unlocked")
    expect(refreshTaskCount).not.toHaveBeenCalled()
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
