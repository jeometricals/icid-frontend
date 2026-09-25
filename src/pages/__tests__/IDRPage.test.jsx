import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import IDRPage from '../IDRPage'
import * as api from '../../services/api'

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
    reporter_uuid: '327d3ed2-a3d6-4235-9408-7fe721b12bed',
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
}))

beforeEach(() => {
  vi.clearAllMocks()
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

  it('opens a report at /project/:projectId/idr/:idrId/report/:reportId', async () => {
    const user = userEvent.setup()
    renderPage('drafts')
    await ready()
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByTestId('url')).toHaveTextContent(`${IDR_URL}/report/rep-gen`)
    expect(screen.getByTestId('from')).toHaveTextContent('drafts') // carried so the IDR's Back still works later
  })
})

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

describe('IDRPage — submit', () => {
  it('is disabled with a hint when the IDR has no reports', async () => {
    server = draftIdr({ reports: [] })
    renderPage()
    await ready()
    expect(submitButton()).toBeDisabled()
    expect(screen.getByText('Add at least one report before submitting.')).toBeInTheDocument()
  })

  it('asks for confirmation and does nothing on Cancel', async () => {
    window.confirm.mockReturnValue(false)
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(submitButton())
    expect(window.confirm).toHaveBeenCalledWith("Submit this IDR? Once submitted, it can't be edited.")
    expect(api.submitIdr).not.toHaveBeenCalled()
  })

  it('submits on OK, then refetches and switches to read-only', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(submitButton())
    expect(api.submitIdr).toHaveBeenCalledWith(IDR_ID)
    expect(await screen.findByText(/^Submitted at /)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit idr/i })).not.toBeInTheDocument()
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
  })

  it('blocks submit while the header has unsaved changes', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    fireEvent.change(screen.getByLabelText('Weather PM'), { target: { value: 'Rainy' } })
    await user.click(submitButton())
    expect(window.alert).toHaveBeenCalledWith('Please save the header before submitting.')
    expect(window.confirm).not.toHaveBeenCalled()
    expect(api.submitIdr).not.toHaveBeenCalled()
  })

  it('shows a submit error and stays editable', async () => {
    api.submitIdr.mockRejectedValueOnce(new Error('IDR must contain at least one report before submission.'))
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(submitButton())
    expect(await screen.findByText('Submit failed: IDR must contain at least one report before submission.'))
      .toBeInTheDocument()
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
    expect(screen.getByText(/^Submitted at \d{2}:\d{2} on September 25, 2026$/)).toBeInTheDocument()
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
