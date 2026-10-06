import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format, parseISO } from 'date-fns'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import IDRPage from '../IDRPage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { ProjectRolesContext } from '../../contexts/ProjectRolesContext'
import { TaskCountContext } from '../../contexts/TaskCountContext'
import { DEMO_USER, TEST_USER, TEST_USER_ID, UNSIGNED_USER } from '../../test/users'

// The real modal needs a canvas and the signature service; here it is a stand-in that can succeed or be cancelled
vi.mock('../../components/SignatureSetupModal', () => ({
  default: ({ isOpen, onClose, onSuccess, title }) => (isOpen ? (
    <div role="dialog" aria-label={title ?? 'Set Up Your Signature'}>
      <button onClick={() => { onSuccess?.(); onClose() }}>finish signature</button>
      <button onClick={onClose}>cancel signature</button>
    </div>
  ) : null),
}))

// ---------------------------------------------------------------------------
// Shared mocks: a tiny in-memory "server" so the refetch after each change sees that change
// ---------------------------------------------------------------------------

const IDR_ID = 'idr-1'
const IDR_URL = `/project/HWS0023/idr/${IDR_ID}`

function report(overrides) {
  return {
    idr_id: IDR_ID,
    is_addendum: false,
    parent_report_id: null,
    page_number: null,
    report_data: {},
    created_at: '2026-09-25T13:00:00Z',
    updated_at: '2026-09-25T13:00:00Z',
    ...overrides,
  }
}

function draftIdr(overrides = {}) {
  return {
    idr_id: IDR_ID,
    project_id: 'HWS0023',
    reporter_uuid: TEST_USER_ID,
    report_date: '2026-09-27',
    work_start_time: '07:00:00',
    work_end_time: null,
    inspector_start_time: null,
    inspector_end_time: null,
    temp_low: null,
    temp_high: 78.0,
    weather_am: 'Clear',
    weather_pm: null,
    total_pages: null,
    status: 'draft',
    submitted_at: null,
    created_at: '2026-09-25T13:00:00Z',
    updated_at: '2026-09-25T13:00:00Z',
    reports: [report({ report_id: 'rep-gen', report_type: 'GEN' })],
    ...overrides,
  }
}

let server

vi.mock('../../services/api', () => ({
  getIdr: vi.fn(),
  saveIdrHeader: vi.fn(),
  addReport: vi.fn(),
  deleteReport: vi.fn(),
  submitIdr: vi.fn(),
  generateExport: vi.fn(),
  listUsers: vi.fn(),
  acceptStage1: vi.fn(),
  approveStage1: vi.fn(),
  acceptStage2: vi.fn(),
  approveStage2: vi.fn(),
  returnIdr: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: TEST_USER })
  server = draftIdr()
  api.getIdr.mockImplementation(async () => structuredClone(server))
  api.saveIdrHeader.mockImplementation(async (_, changes) => {
    server = { ...server, ...changes, updated_at: '2026-09-25T14:05:00Z' }
    const { reports, ...idr } = server
    return structuredClone(idr)
  })
  api.addReport.mockImplementation(async (_, { reportType }) => {
    const added = report({ report_id: `rep-${server.reports.length + 1}`, report_type: reportType })
    server = { ...server, reports: [...server.reports, added] }
    return added
  })
  api.deleteReport.mockImplementation(async (_, reportId) => {
    server = { ...server, reports: server.reports.filter(r => r.report_id !== reportId && r.parent_report_id !== reportId) }
  })
  api.submitIdr.mockImplementation(async () => {
    server = {
      ...server,
      status: 'submitted',
      submitted_at: '2026-09-25T16:05:00Z',
      total_pages: server.reports.length,
      reports: server.reports.map((r, i) => ({ ...r, page_number: i + 1 })),
    }
    return structuredClone(server)
  })
  window.confirm = vi.fn(() => true) // jsdom has no confirm() or alert()
  window.alert = vi.fn()
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

function renderPage(from) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: IDR_URL, state: from ? { from } : undefined }]}>
      <Routes>
        <Route path="/project/:projectId/idr/:idrId" element={<IDRPage />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

const ready = () => screen.findByRole('heading', { name: 'Inspector Daily Report' })
const saveHeaderButton = () => screen.getByRole('button', { name: /save header|saving/i })
const submitButton = () => screen.getByRole('button', { name: /submit idr|submitting/i })
const reportRows = () => within(screen.getByRole('list')).getAllByRole('listitem')

// ---------------------------------------------------------------------------
// Loading and load errors
// ---------------------------------------------------------------------------

describe('IDRPage — loading', () => {
  it('shows "Loading IDR..." while the IDR is fetched', async () => {
    api.getIdr.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Loading IDR...')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('loads the IDR from the URL and shows its date and reports', async () => {
    renderPage()
    await ready()
    expect(api.getIdr).toHaveBeenCalledWith(IDR_ID)
    expect(screen.getByText(/Sunday, September 27, 2026/)).toBeInTheDocument()
    expect(reportRows()).toHaveLength(1)
    expect(reportRows()[0]).toHaveTextContent('General')
  })

  it('shows the load error and retries on click', async () => {
    api.getIdr.mockRejectedValueOnce(new Error('Network error'))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('Network error')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry/i }))
    await ready()
    expect(api.getIdr).toHaveBeenCalledTimes(2)
  })

  it('treats an IDR from another project as not found', async () => {
    server = draftIdr({ project_id: 'OTHER' })
    renderPage()
    expect(await screen.findByText('IDR not found in this project')).toBeInTheDocument()
  })

  it.each([
    ['drafts', 'Back to Drafts', '/project/HWS0023/drafts'],
    ['archive', 'Back to Archive', '/project/HWS0023/archive'],
    [undefined, 'Back to Project Dashboard', '/project/HWS0023'],
  ])('the error-state Back button follows where the IDR was opened from (%s)', async (from, label, path) => {
    api.getIdr.mockRejectedValue(new Error('IDR not found'))
    const user = userEvent.setup()
    renderPage(from)
    await user.click(await screen.findByRole('button', { name: label }))
    expect(screen.getByTestId('url')).toHaveTextContent(new RegExp(`^${path}$`))
  })
})

// ---------------------------------------------------------------------------
// Header form
// ---------------------------------------------------------------------------

describe('IDRPage — header', () => {
  it('fills the header from the server, with times as HH:MM', async () => {
    renderPage()
    await ready()
    expect(screen.getByLabelText('Work Activity Start')).toHaveValue('07:00')
    expect(screen.getByLabelText('Daily Temp High (°F)')).toHaveValue(78)
    expect(screen.getByLabelText('Weather AM')).toHaveValue('Clear')
  })

  it('keeps Save Header disabled until a field changes', async () => {
    renderPage()
    await ready()
    expect(saveHeaderButton()).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Daily Temp Low (°F)'), { target: { value: '48' } })
    expect(saveHeaderButton()).toBeEnabled()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('goes back to disabled when an edit is undone', async () => {
    renderPage()
    await ready()
    fireEvent.change(screen.getByLabelText('Weather AM'), { target: { value: 'Rainy' } })
    fireEvent.change(screen.getByLabelText('Weather AM'), { target: { value: 'Clear' } })
    expect(saveHeaderButton()).toBeDisabled()
  })

  it('sends only the changed fields (cleared → null, temps as numbers), then refetches and shows "Saved at"', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    fireEvent.change(screen.getByLabelText('Daily Temp Low (°F)'), { target: { value: '48' } })
    fireEvent.change(screen.getByLabelText('Weather AM'), { target: { value: '' } })
    await user.click(saveHeaderButton())

    expect(api.saveIdrHeader).toHaveBeenCalledWith(IDR_ID, { temp_low: 48, weather_am: null })
    expect(await screen.findByText(/^Saved at \d{2}:\d{2}$/)).toBeInTheDocument()
    expect(api.getIdr).toHaveBeenCalledTimes(2) // initial load + refetch
    expect(saveHeaderButton()).toBeDisabled()
  })

  it('shows a save error and keeps the changes', async () => {
    api.saveIdrHeader.mockRejectedValueOnce(new Error('temp_low cannot be greater than temp_high'))
    const user = userEvent.setup()
    renderPage()
    await ready()
    fireEvent.change(screen.getByLabelText('Daily Temp Low (°F)'), { target: { value: '90' } })
    await user.click(saveHeaderButton())

    expect(await screen.findByText(/Save failed: temp_low cannot be greater than temp_high. Click Save Header to retry./))
      .toBeInTheDocument()
    expect(screen.getByLabelText('Daily Temp Low (°F)')).toHaveValue(90)
    expect(saveHeaderButton()).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// Reports list
// ---------------------------------------------------------------------------

describe('IDRPage — reports', () => {
  it('adds a General report, then refetches and shows it', async () => {
    server = draftIdr({ reports: [] })
    const user = userEvent.setup()
    renderPage()
    await ready()
    expect(screen.getByText('No reports yet. Add one below.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(api.addReport).toHaveBeenCalledWith(IDR_ID, { reportType: 'GEN' })
    await waitFor(() => expect(reportRows()).toHaveLength(1))
    expect(api.getIdr).toHaveBeenCalledTimes(2)
  })

  it('shows an add error', async () => {
    server = draftIdr({ reports: [] })
    api.addReport.mockRejectedValueOnce(new Error('Only draft IDRs can be edited'))
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(await screen.findByText("Couldn't add report: Only draft IDRs can be edited")).toBeInTheDocument()
  })

  it('asks before deleting and does nothing on Cancel', async () => {
    window.confirm.mockReturnValue(false)
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(window.confirm).toHaveBeenCalledWith('Delete this General report? This cannot be undone.')
    expect(api.deleteReport).not.toHaveBeenCalled()
  })

  it('deletes on OK, then refetches and drops the row', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(api.deleteReport).toHaveBeenCalledWith(IDR_ID, 'rep-gen')
    expect(await screen.findByText('No reports yet. Add one below.')).toBeInTheDocument()
    expect(api.getIdr).toHaveBeenCalledTimes(2)
  })

  it('warns that a report\'s addendums are deleted with it', async () => {
    server = draftIdr({
      reports: [
        report({ report_id: 'rep-gen', report_type: 'GEN' }),
        report({ report_id: 'rep-sk', report_type: 'SKETCH', is_addendum: true, parent_report_id: 'rep-gen' }),
      ],
    })
    window.confirm.mockReturnValue(false)
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(within(reportRows()[0]).getByRole('button', { name: /delete/i }))
    expect(window.confirm).toHaveBeenCalledWith(
      'Delete this General report? This cannot be undone. Its 1 addendum will be deleted too.'
    )
  })

  it('shows a delete error', async () => {
    api.deleteReport.mockRejectedValueOnce(new Error('Report not found in this IDR'))
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(await screen.findByText("Couldn't delete report: Report not found in this IDR")).toBeInTheDocument()
  })

  it('opens a General at /project/:projectId/idr/:idrId/general/:reportId', async () => {
    const user = userEvent.setup()
    renderPage('drafts')
    await ready()
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByTestId('url')).toHaveTextContent(`${IDR_URL}/general/rep-gen`)
    expect(screen.getByTestId('from')).toHaveTextContent('drafts') // carried so the IDR's Back still works later
  })

  it('opens an SWCB report at /project/:projectId/idr/:idrId/swcb/:reportId', async () => {
    server = draftIdr({ reports: [report({ report_id: 'rep-swcb', report_type: 'SWCB' })] })
    const user = userEvent.setup()
    renderPage('drafts')
    await ready()
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByTestId('url')).toHaveTextContent(`${IDR_URL}/swcb/rep-swcb`)
    expect(screen.getByTestId('from')).toHaveTextContent('drafts')
  })

  it('opens an AC report at /project/:projectId/idr/:idrId/ac/:reportId', async () => {
    server = draftIdr({ reports: [report({ report_id: 'rep-ac', report_type: 'AC' })] })
    const user = userEvent.setup()
    renderPage('drafts')
    await ready()
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByTestId('url')).toHaveTextContent(`${IDR_URL}/ac/rep-ac`)
    expect(screen.getByTestId('from')).toHaveTextContent('drafts')
  })
})

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

describe('IDRPage — submit', () => {
  const CERTIFICATION =
    'The above described work was incorporated into this project and was constructed in conformance with all plans, ' +
    'specifications, and standards unless otherwise noted.'
  const certifyDialog = () => screen.queryByRole('dialog', { name: 'Certification' })

  it('is disabled with a hint when the IDR has no reports, and clicking it opens no dialog', async () => {
    server = draftIdr({ reports: [] })
    const user = userEvent.setup()
    renderPage()
    await ready()
    expect(submitButton()).toBeDisabled()
    expect(screen.getByText('Add at least one report before submitting.')).toBeInTheDocument()
    await user.click(submitButton())
    expect(certifyDialog()).not.toBeInTheDocument()
  })

  it('opens the certification dialog instead of a browser confirm, without submitting yet', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(submitButton())
    const dialog = certifyDialog()
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText(CERTIFICATION)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Submit' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(window.confirm).not.toHaveBeenCalled()
    expect(api.submitIdr).not.toHaveBeenCalled()
  })

  it('Cancel closes the dialog without submitting', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(submitButton())
    await user.click(within(certifyDialog()).getByRole('button', { name: 'Cancel' }))
    expect(certifyDialog()).not.toBeInTheDocument()
    expect(api.submitIdr).not.toHaveBeenCalled()
    expect(submitButton()).toBeEnabled()
  })

  it('Submit keeps the dialog open showing Working... until the submit resolves, then closes it and goes read-only', async () => {
    let finishSubmit
    const submit = api.submitIdr.getMockImplementation()
    api.submitIdr.mockImplementationOnce(() => new Promise(resolve => { finishSubmit = () => resolve(submit()) }))
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(submitButton())
    await user.click(within(certifyDialog()).getByRole('button', { name: 'Submit' }))

    expect(api.submitIdr).toHaveBeenCalledTimes(1)
    expect(api.submitIdr).toHaveBeenCalledWith(IDR_ID)
    const dialog = certifyDialog()
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Working...' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()

    finishSubmit()
    await waitFor(() => expect(certifyDialog()).not.toBeInTheDocument())
    expect(await screen.findByText(/^Submitted on /)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit idr/i })).not.toBeInTheDocument()
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
  })

  it('blocks submit while the header has unsaved changes, without opening the dialog', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    fireEvent.change(screen.getByLabelText('Weather PM'), { target: { value: 'Rainy' } })
    await user.click(submitButton())
    expect(window.alert).toHaveBeenCalledWith('Please save the header before submitting.')
    expect(certifyDialog()).not.toBeInTheDocument()
    expect(api.submitIdr).not.toHaveBeenCalled()
  })

  it('on a submit error keeps the dialog open with the error inside it; after Cancel the error stays under the button', async () => {
    const ERROR = 'Submit failed: IDR must contain at least one report before submission.'
    api.submitIdr.mockRejectedValueOnce(new Error('IDR must contain at least one report before submission.'))
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(submitButton())
    await user.click(within(certifyDialog()).getByRole('button', { name: 'Submit' }))

    const dialog = certifyDialog()
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(ERROR)
    expect(within(dialog).getByRole('button', { name: 'Submit' })).toBeEnabled()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(certifyDialog()).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(ERROR)
    expect(submitButton()).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// Read-only (submitted) IDRs
// ---------------------------------------------------------------------------

describe('IDRPage — read-only', () => {
  const submitted = () => draftIdr({
    status: 'submitted',
    submitted_at: '2026-09-25T16:05:23Z',
    total_pages: 2,
    reports: [
      report({ report_id: 'rep-gen', report_type: 'GEN', page_number: 1, report_data: { description: 'x' } }),
      report({ report_id: 'rep-sk', report_type: 'SKETCH', is_addendum: true, parent_report_id: 'rep-gen', page_number: 2 }),
    ],
  })

  it('shows the Submitted banner, disables every header field and hides all actions', async () => {
    server = submitted()
    renderPage('archive')
    await ready()
    expect(screen.getByRole('status')).toHaveTextContent(/^Submitted on Sep 25, 2026 at \d{1,2}:\d{2} [AP]M$/)
    for (const label of ['Work Activity Start', 'Daily Temp High (°F)', 'Weather AM']) {
      expect(screen.getByLabelText(label)).toBeDisabled()
    }
    for (const name of [/save header/i, /^add$/i, /delete/i, /submit idr/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  it('still lets a General report be opened and shows page numbers', async () => {
    server = submitted()
    renderPage('archive')
    await ready()
    const [general, sketch] = reportRows()
    expect(general).toHaveTextContent('Page 1 of 2')
    expect(sketch).toHaveTextContent('Page 2 of 2')
    expect(within(general).getByRole('button', { name: 'Open' })).toBeEnabled()
  })

  it('omits page numbers for a migrated IDR whose page_number/total_pages are null', async () => {
    server = draftIdr({
      status: 'submitted',
      submitted_at: '2026-09-24T16:07:33Z',
      total_pages: null,
      reports: [report({ report_id: 'rep-gen', report_type: 'GEN', report_data: { description: 'x' } })],
    })
    renderPage('archive')
    await ready()
    expect(reportRows()[0]).toHaveTextContent('Saved')
    expect(screen.queryByText(/^Page /)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

describe('IDRPage — export', () => {
  const exportButton = () => screen.getByRole('button', { name: /export/i })

  it('offers "Export Draft (.xlsx)" next to Submit on a draft, exporting this IDR', async () => {
    api.generateExport.mockResolvedValue('IDR.xlsx')
    renderPage()
    await ready()
    expect(exportButton()).toHaveTextContent('Export Draft (.xlsx)')
    expect(exportButton().parentElement.parentElement).toContainElement(submitButton())  // the same row
    await userEvent.click(exportButton())
    expect(api.generateExport).toHaveBeenCalledWith(IDR_ID)
  })

  it('offers "Export (.xlsx)" in the page header once submitted, above the Submitted banner', async () => {
    server = draftIdr({ status: 'submitted', submitted_at: '2026-09-25T16:05:23Z', total_pages: 1 })
    renderPage('archive')
    await ready()
    expect(exportButton()).toHaveTextContent('Export (.xlsx)')
    expect(exportButton()).toBeEnabled()
    expect(exportButton().closest('header')).not.toBeNull()
    expect(exportButton().compareDocumentPosition(screen.getByRole('status')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('is disabled while the IDR has no reports', async () => {
    server = draftIdr({ reports: [] })
    renderPage()
    await ready()
    expect(exportButton()).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Silent refetch
// ---------------------------------------------------------------------------

describe('IDRPage — refetch after changes', () => {
  it('keeps the current page up (no loading screen) while the refetch runs', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    api.getIdr.mockReturnValue(new Promise(() => {})) // refetch never finishes
    await user.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => expect(api.getIdr).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Loading IDR...')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Inspector Daily Report' })).toBeInTheDocument()
  })

  it('shows an explicit error when the refetch fails, and retries it', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    api.getIdr.mockRejectedValueOnce(new Error('Network error'))
    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(await screen.findByText("Couldn't refresh this IDR: Network error")).toBeInTheDocument()

    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: /retry/i }))
    await waitFor(() => expect(screen.queryByText(/Couldn't refresh/)).not.toBeInTheDocument())
    expect(screen.getByText('No reports yet. Add one below.')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Demo mode: everything but Submit
// ---------------------------------------------------------------------------

describe('IDRPage — demo user', () => {
  const DEMO_HINT = 'Demo mode — submit is disabled'

  beforeEach(() => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: DEMO_USER })
  })

  it('disables Submit with a tooltip and a visible note, even with reports to submit', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    expect(submitButton()).toBeDisabled()
    expect(submitButton().closest('[title]')).toHaveAttribute('title', DEMO_HINT)
    expect(screen.getByText(DEMO_HINT)).toBeInTheDocument()
    await user.click(submitButton())
    expect(screen.queryByRole('dialog', { name: 'Certification' })).not.toBeInTheDocument()
    expect(api.submitIdr).not.toHaveBeenCalled()
  })

  it('shows the demo note instead of the "add a report" hint on an empty IDR', async () => {
    server = draftIdr({ reports: [] })
    renderPage()
    await ready()
    expect(screen.getByText(DEMO_HINT)).toBeInTheDocument()
    expect(screen.queryByText('Add at least one report before submitting.')).not.toBeInTheDocument()
  })

  it('still lets a demo user add reports and export the draft', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    expect(screen.getByRole('button', { name: /Export Draft/ })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /Export Draft/ }))
    expect(api.generateExport).toHaveBeenCalledWith(IDR_ID)
  })
})

describe('IDRPage — signed-in user who is not a demo user', () => {
  it('leaves Submit enabled with no tooltip or demo note', async () => {
    renderPage()
    await ready()
    expect(submitButton()).toBeEnabled()
    expect(submitButton().closest('[title]')).toBeNull()
    expect(screen.queryByText('Demo mode — submit is disabled')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Go to Project Page
// ---------------------------------------------------------------------------

describe('IDRPage — Go to Project Page', () => {
  const goToProject = () => screen.queryByRole('button', { name: 'Go to Project Page' })

  it.each([['drafts', 'Back to Drafts'], ['archive', 'Back to Archive']])(
    'sits beside "%s"-opened IDR\'s Back button and goes to the project page',
    async (from, backLabel) => {
      const user = userEvent.setup()
      renderPage(from)
      await ready()
      const back = screen.getByRole('button', { name: backLabel })
      expect(goToProject().parentElement).toBe(back.parentElement)
      expect(back.nextElementSibling).toBe(goToProject())
      await user.click(goToProject())
      expect(screen.getByTestId('url')).toHaveTextContent(/^\/project\/HWS0023$/)
    })

  it('is left out when Back already goes to the project page', async () => {
    renderPage()
    await ready()
    expect(screen.getByRole('button', { name: 'Back to Project Dashboard' })).toBeInTheDocument()
    expect(goToProject()).not.toBeInTheDocument()
  })

  it('is there on a submitted IDR too', async () => {
    server = draftIdr({ status: 'submitted', submitted_at: '2026-09-25T16:05:00Z', total_pages: 1 })
    renderPage('archive')
    await ready()
    expect(goToProject()).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Submitting signs the IDR: the signature comes first
// ---------------------------------------------------------------------------

describe('IDRPage — signature before submit', () => {
  const ATTESTATION = 'I attest that the information in this IDR is accurate and complete to the best of my knowledge.'
  const certifyDialog = () => screen.queryByRole('dialog', { name: 'Certification' })
  const signatureDialog = () => screen.queryByRole('dialog', { name: 'Set Up Your Signature' })

  it('shows the attestation under the certification statement, above Submit', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(submitButton())
    const dialog = certifyDialog()
    const attestation = within(dialog).getByText(ATTESTATION)
    const certification = within(dialog).getByText(/The above described work was incorporated/)
    expect(certification.compareDocumentPosition(attestation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const submit = within(dialog).getByRole('button', { name: 'Submit' })
    expect(attestation.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('goes straight to certification for a user with a signature', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(submitButton())
    expect(certifyDialog()).toBeInTheDocument()
    expect(signatureDialog()).not.toBeInTheDocument()
  })

  it('asks a user without a signature to set one up first, not to certify yet', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: UNSIGNED_USER })
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(submitButton())
    expect(signatureDialog()).toBeInTheDocument()
    expect(certifyDialog()).not.toBeInTheDocument()
    expect(api.submitIdr).not.toHaveBeenCalled()
  })

  it('opens certification once the signature is set, and submits from there', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: UNSIGNED_USER })
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(submitButton())
    await user.click(screen.getByRole('button', { name: 'finish signature' }))
    expect(signatureDialog()).not.toBeInTheDocument()
    const dialog = certifyDialog()
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText(ATTESTATION)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(api.submitIdr).toHaveBeenCalledWith(IDR_ID))
  })

  it('goes back to the page, with nothing submitted, when signature setup is cancelled', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: UNSIGNED_USER })
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(submitButton())
    await user.click(screen.getByRole('button', { name: 'cancel signature' }))
    expect(signatureDialog()).not.toBeInTheDocument()
    expect(certifyDialog()).not.toBeInTheDocument()
    expect(api.submitIdr).not.toHaveBeenCalled()
    expect(submitButton()).toBeEnabled()
  })

  it('still asks for unsaved header changes to be saved before anything else', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: UNSIGNED_USER })
    const user = userEvent.setup()
    renderPage()
    await ready()
    fireEvent.change(screen.getByLabelText('Daily Temp Low (°F)'), { target: { value: '48' } })
    await user.click(submitButton())
    expect(window.alert).toHaveBeenCalledWith('Please save the header before submitting.')
    expect(signatureDialog()).not.toBeInTheDocument()
  })

  it('never offers signature setup to a demo user: Submit stays disabled', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: DEMO_USER })
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(submitButton())
    expect(signatureDialog()).not.toBeInTheDocument()
    expect(certifyDialog()).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// The signed-state banner on a submitted IDR
// ---------------------------------------------------------------------------

describe('IDRPage — signed banner', () => {
  const SIGNED_AT = '2026-10-05T15:52:10Z'
  const OTHER = '5246b39d-87fe-4e21-92a3-2804c899e8b3'
  const local = iso => format(parseISO(iso), "MMM d, yyyy 'at' h:mm a")
  const signedIdr = (overrides = {}) => draftIdr({
    status: 'submitted', submitted_at: '2026-10-05T15:52:09Z', total_pages: 1,
    inspector_signature_path: 'idrs/idr-1/inspector_abc.png', inspector_signed_at: SIGNED_AT, ...overrides,
  })
  const banner = () => screen.getByRole('status')

  it('says who submitted it and when, from the signed-in user when the IDR is their own', async () => {
    server = signedIdr()
    renderPage('archive')
    await ready()
    expect(banner()).toHaveTextContent(`Submitted by Genghis Khan on ${local(SIGNED_AT)}`)
    expect(api.listUsers).not.toHaveBeenCalled()
  })

  it('sits at the top of the page, above the title, and the Submit area is gone', async () => {
    server = signedIdr()
    renderPage('archive')
    const title = await ready()
    expect(banner().compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('button', { name: /submit idr/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('status')).toHaveLength(1) // one banner, not the old lock notice as well
  })

  it('looks the name up in the user list for someone else\'s IDR', async () => {
    server = signedIdr({ reporter_uuid: OTHER })
    api.listUsers.mockResolvedValue([
      { user_id: TEST_USER_ID, email: 'KhanG@magnoleng.pc', first_name: 'Genghis', last_name: 'Khan' },
      { user_id: OTHER, email: 'Nadir.shah@goorkaneng.com', first_name: 'Nadir', last_name: 'Shah' },
    ])
    renderPage('archive')
    await ready()
    await waitFor(() => expect(banner()).toHaveTextContent(`Submitted by Nadir Shah on ${local(SIGNED_AT)}`))
  })

  it.each([
    ['their first name when there is no last name', { first_name: 'Nadir', last_name: null }, 'Nadir'],
    ['their email when there is no name', { first_name: null, last_name: null }, 'Nadir.shah@goorkaneng.com'],
  ])('falls back to %s', async (_, names, shown) => {
    server = signedIdr({ reporter_uuid: OTHER })
    api.listUsers.mockResolvedValue([{ user_id: OTHER, email: 'Nadir.shah@goorkaneng.com', ...names }])
    renderPage('archive')
    await ready()
    await waitFor(() => expect(banner()).toHaveTextContent(`Submitted by ${shown} on ${local(SIGNED_AT)}`))
  })

  it('uses the signed-in user\'s first name alone when they have no last name', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { ...TEST_USER, last_name: null } })
    server = signedIdr()
    renderPage('archive')
    await ready()
    expect(banner()).toHaveTextContent(`Submitted by Genghis on ${local(SIGNED_AT)}`)
  })

  it.each([
    ['the user list fails to load', () => api.listUsers.mockRejectedValue(new Error('Internal Server Error'))],
    ['the signer is not in the user list', () => api.listUsers.mockResolvedValue([])],
  ])('still says when, without a name, if %s', async (_, arrange) => {
    arrange()
    server = signedIdr({ reporter_uuid: OTHER })
    renderPage('archive')
    await ready()
    await waitFor(() => expect(api.listUsers).toHaveBeenCalled())
    expect(banner()).toHaveTextContent(`Submitted on ${local(SIGNED_AT)}`)
    expect(banner()).not.toHaveTextContent(' by ')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument() // not an error worth showing
  })

  it('shows "Submitted on <submit time>" for an IDR submitted before signatures, without a name or a lookup', async () => {
    server = draftIdr({ status: 'submitted', submitted_at: '2026-09-25T16:05:23Z', total_pages: 1,
      reporter_uuid: OTHER })
    renderPage('archive')
    await ready()
    expect(banner()).toHaveTextContent(`Submitted on ${local('2026-09-25T16:05:23Z')}`)
    expect(banner()).not.toHaveTextContent(' by ')
    expect(api.listUsers).not.toHaveBeenCalled()
  })

  it('shows no banner on a draft', async () => {
    renderPage()
    await ready()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(api.listUsers).not.toHaveBeenCalled()
  })

  it('appears once the IDR is submitted from this page', async () => {
    api.submitIdr.mockImplementation(async () => {
      server = signedIdr({ reports: server.reports.map((r, i) => ({ ...r, page_number: i + 1 })) })
      return structuredClone(server)
    })
    const user = userEvent.setup()
    renderPage()
    await ready()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.click(submitButton())
    await user.click(within(screen.getByRole('dialog', { name: 'Certification' })).getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(banner()).toHaveTextContent(`Submitted by Genghis Khan on ${local(SIGNED_AT)}`))
  })
})

// ---------------------------------------------------------------------------
// Review: status, IDR number, return comment, the toolbar and the way back to the queue
// ---------------------------------------------------------------------------

describe('IDRPage — review', () => {
  const OLIVE = '5246b39d-87fe-4e21-92a3-2804c899e8b3' // a reviewer who is not the inspector
  const submitted = (overrides = {}) => draftIdr({
    status: 'submitted', submitted_at: '2026-09-25T16:05:00Z', total_pages: 1, inspector_signed_at: '2026-09-25T16:05:00Z',
    idr_number: null, stage1_reviewer_uuid: null, re_reviewer_uuid: null, return_reason: null, returned_from: null,
    ...overrides,
  })

  // The page as a reviewer sees it: signed in as Olive, holding the given roles on the IDR's project
  function renderAsReviewer(roles, from) {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { ...TEST_USER, uuid: OLIVE, first_name: 'Olive', last_name: 'Engineer' } })
    api.listUsers.mockResolvedValue([{ user_id: TEST_USER_ID, email: TEST_USER.email, first_name: 'Genghis', last_name: 'Khan' }])
    return render(
      <MemoryRouter initialEntries={[{ pathname: IDR_URL, state: from ? { from } : undefined }]}>
        <ProjectRolesContext.Provider value={{ rolesByProject: { HWS0023: roles }, error: null, reload: () => {} }}>
          <Routes>
            <Route path="/project/:projectId/idr/:idrId" element={<IDRPage />} />
            <Route path="*" element={<CurrentUrl />} />
          </Routes>
        </ProjectRolesContext.Provider>
      </MemoryRouter>
    )
  }

  const toolbar = () => screen.queryByRole('region', { name: 'Review' })
  // The title card: the heading, its badges and the lines under it
  const title = () => screen.getByRole('heading', { name: 'Inspector Daily Report' }).parentElement.parentElement

  it('shows a draft as Draft, with no number badge and no toolbar', async () => {
    renderPage()
    await ready()
    expect(title()).toHaveTextContent('Draft')
    expect(title()).not.toHaveTextContent('IDR #')
    expect(toolbar()).not.toBeInTheDocument()
    expect(screen.queryByText(/^Returned/)).not.toBeInTheDocument()
  })

  it.each([
    ['submitted', 'Submitted'], ['stage1_review', 'IDR Check'], ['stage2_review', 'RE Review'],
    ['approved', 'Approved'],
  ])('shows a %s IDR as "%s", read-only, under the submitted banner', async (status, label) => {
    server = submitted({ status, idr_number: status === 'submitted' ? null : '005' })
    renderPage()
    await ready()
    expect(title()).toHaveTextContent(label)
    expect(title()).toHaveTextContent(status === 'submitted' ? 'No IDR # yet' : '005')
    expect(screen.getByText(/^Submitted by Genghis Khan on/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit idr/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save header/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
  })

  it('says when an approved IDR was approved', async () => {
    server = submitted({ status: 'approved', idr_number: '005', re_signed_at: '2026-09-28T15:00:00Z' })
    renderPage()
    await ready()
    expect(title()).toHaveTextContent(`Approved on ${format(parseISO('2026-09-28T15:00:00Z'), "MMM d, yyyy 'at' h:mm a")}`)
  })

  it("shows the inspector the reviewer's comment on a returned draft, which is editable again", async () => {
    server = draftIdr({ return_reason: 'fix the pay-item quantity', returned_from: 'stage1', idr_number: '005' })
    renderPage()
    await ready()
    const notice = screen.getByText('Returned from IDR Check').closest('[role="status"]')
    expect(notice).toHaveTextContent('fix the pay-item quantity')
    expect(title()).toHaveTextContent('Returned')
    expect(title()).toHaveTextContent('005') // the number it will keep
    expect(submitButton()).toBeEnabled()
    expect(toolbar()).not.toBeInTheDocument()
  })

  it('shows the OE the comment on an IDR the RE sent back to Stage 1', async () => {
    server = submitted({ status: 'stage1_review', idr_number: '005', stage1_reviewer_uuid: OLIVE,
      return_reason: 'check the station', returned_from: 'stage2' })
    renderAsReviewer(['oe'])
    await ready()
    expect(screen.getByText('Returned from RE Review').closest('[role="status"]')).toHaveTextContent('check the station')
    expect(title()).toHaveTextContent('IDR Check')
  })

  it('gives the inspector no toolbar on their own submitted IDR', async () => {
    server = submitted()
    renderPage()
    await ready()
    expect(toolbar()).not.toBeInTheDocument()
  })

  it('puts the toolbar under the submitted banner for a reviewer', async () => {
    server = submitted()
    renderAsReviewer(['oe'])
    await ready()
    const banner = await screen.findByText(/^Submitted by Genghis Khan on/) // the name comes from the user list
    expect(banner.compareDocumentPosition(toolbar()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(toolbar()).getByRole('button', { name: 'Accept Task - IDR Check' })).toBeEnabled()
  })

  it('accepts for Stage 1 with a number and shows where the IDR now stands', async () => {
    server = submitted()
    api.acceptStage1.mockImplementation(async (_, number) => {
      server = { ...server, status: 'stage1_review', idr_number: number, stage1_reviewer_uuid: OLIVE }
      return structuredClone(server)
    })
    const user = userEvent.setup()
    renderAsReviewer(['oe'])
    await ready()
    await user.click(within(toolbar()).getByRole('button', { name: 'Accept Task - IDR Check' }))
    await user.type(screen.getByLabelText('IDR #'), '005')
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(title()).toHaveTextContent('IDR Check'))
    expect(api.acceptStage1).toHaveBeenCalledWith(IDR_ID, '005')
    expect(title()).toHaveTextContent('005')
    expect(within(toolbar()).getAllByRole('button').map(b => b.textContent)).toEqual([
      'Approve → RE Review', 'Return to Inspector',
    ])
  })

  it('drops the toolbar once the reviewer returns the IDR to its inspector', async () => {
    server = submitted({ status: 'stage1_review', idr_number: '005', stage1_reviewer_uuid: OLIVE })
    api.returnIdr.mockImplementation(async (_, { comment }) => {
      server = { ...server, status: 'draft', return_reason: comment, returned_from: 'stage1' }
      return structuredClone(server)
    })
    const user = userEvent.setup()
    renderAsReviewer(['oe'])
    await ready()
    await user.click(within(toolbar()).getByRole('button', { name: 'Return to Inspector' }))
    await user.type(screen.getByLabelText('Comment for the inspector'), 'fix the pay-item quantity')
    await user.click(screen.getByRole('button', { name: 'Return' }))
    await waitFor(() => expect(title()).toHaveTextContent('Returned'))
    expect(api.returnIdr).toHaveBeenCalledWith(IDR_ID, { to: 'inspector', comment: 'fix the pay-item quantity' })
    expect(toolbar()).not.toBeInTheDocument()
  })

  it('keeps an approved IDR read-only with no toolbar, for a reviewer too', async () => {
    server = submitted({ status: 'approved', idr_number: '005', stage1_reviewer_uuid: OLIVE, re_reviewer_uuid: OLIVE,
      re_signed_at: '2026-09-28T15:00:00Z' })
    renderAsReviewer(['oe', 're'])
    await ready()
    expect(toolbar()).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save header/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add report/i })).not.toBeInTheDocument()
  })

  it('goes back to the queue when opened from it, and still offers the project page', async () => {
    server = submitted()
    const user = userEvent.setup()
    renderAsReviewer(['oe'], 'review')
    await ready()
    expect(screen.getByRole('button', { name: /Go to Project Page/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Back to My Tasks/ }))
    expect(screen.getByTestId('url')).toHaveTextContent('/review')
  })
})

// ---------------------------------------------------------------------------
// The task count: a submit is a new task for whoever reviews on the project
// ---------------------------------------------------------------------------

describe('IDRPage — task count', () => {
  function renderCounted(refresh) {
    return render(
      <MemoryRouter initialEntries={[IDR_URL]}>
        <TaskCountContext.Provider value={{ total: 0, refresh }}>
          <Routes>
            <Route path="/project/:projectId/idr/:idrId" element={<IDRPage />} />
          </Routes>
        </TaskCountContext.Provider>
      </MemoryRouter>
    )
  }

  it('refreshes the count once a submit goes through', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderCounted(refresh)
    await ready()
    await user.click(submitButton())
    expect(refresh).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog', { name: 'Certification' })).getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('leaves the count alone when the submit fails', async () => {
    api.submitIdr.mockRejectedValue(new Error('Signature required before submitting'))
    const refresh = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderCounted(refresh)
    await ready()
    await user.click(submitButton())
    await user.click(within(screen.getByRole('dialog', { name: 'Certification' })).getByRole('button', { name: 'Submit' }))
    expect(await screen.findAllByText(/Submit failed: Signature required before submitting/)).not.toHaveLength(0)
    expect(refresh).not.toHaveBeenCalled()
  })
})
