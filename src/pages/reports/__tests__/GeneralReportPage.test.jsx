import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import GeneralReportPage from '../GeneralReportPage'
import * as api from '../../../services/api'
import * as AuthContext from '../../../contexts/AuthContext'

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const DEV_USER = {
  id: '327d3ed2-a3d6-4235-9408-7fe721b12bed',
  email: 'KhanG@magnoleng.pc',
  user_metadata: { full_name: 'Genghis Khan' }
}

const REPORT_ID = '9b1c2f3e-0000-4000-8000-000000000001'
const SAVED_AT = '2026-09-23T14:05:00Z'
const SAVED_TEXT = `Saved at ${format(new Date(SAVED_AT), 'HH:mm')}`
const OTHER_REPORT_ID = '9b1c2f3e-0000-4000-8000-000000000002'
const SUBMITTED_AT = '2026-09-23T15:10:00Z'
const SUBMITTED_TEXT = `Submitted at ${format(new Date(SUBMITTED_AT), "HH:mm 'on' MMMM d, yyyy")}`

// A saved draft as GET /v1/reports/{id} returns it (general_form has every key, camelCase)
function savedReport(id, description, overrides = {}) {
  return {
    report_id: id,
    status: 'draft',
    general_form: {
      date: '2026-09-20', sheetNo: 'S-7', workActivityStart: '07:00', workActivityEnd: '', inspectorTimeStart: '',
      inspectorTimeEnd: '', dailyTempLow: '', dailyTempHigh: '', weatherAM: 'Clear', weatherPM: '',
      description, payItems: [{ itemNo: '4.01', budgetCode: '', payQuantity: '12', quantityChk: '', description: '' }],
      workforce: { superintendent: '', foreman: '2', operator: '', flagger: '' },
      equipment: {
        frontEndLoader: { model: '', number: '' }, backhoe: { model: '', number: '' },
        truckDump: { model: '', number: '' }, excavator: { model: '', number: '' },
      },
      safetyChecks: {
        plasticBarrels: true, pedestrianBarricades: null, timberCurbs: null, timberBreakawayBarricades: null,
        generalSafety: null, localEmergencyAccess: null, fencing: null, plates: null, arrowBoard: null, siteCleaned: null,
      },
      safetyRemarks: '', comments: '',
    },
    ...overrides,
  }
}

vi.mock('../../../services/api', () => ({
  createReport: vi.fn(),
  saveGeneralForm: vi.fn(),
  getReport: vi.fn(),
  submitReport: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: DEV_USER })
  api.createReport.mockResolvedValue({ report_id: REPORT_ID, status: 'draft' })
  api.saveGeneralForm.mockResolvedValue({ report_id: REPORT_ID, completed_form_id: 'cf-1', saved_at: SAVED_AT })
  // Default: a server copy that would clobber local typing if the page ever reloaded it unexpectedly
  api.getReport.mockResolvedValue(savedReport(REPORT_ID, 'SERVER COPY'))
  api.submitReport.mockResolvedValue({ report_id: REPORT_ID, status: 'submitted', submitted_at: SUBMITTED_AT })
  window.confirm = vi.fn(() => true) // jsdom has no confirm()
})

// Test helpers rendered beside the page: show the current URL, and navigate without remounting the page.
function RouterProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <div data-testid="url">{location.pathname + location.search}</div>
      <button onClick={() => navigate('/project/HWS0023/report/general?report_id=' + OTHER_REPORT_ID)}>
        go to other draft
      </button>
    </>
  )
}

function renderPage(url = '/project/HWS0023/report/general') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/project/:projectId/report/general" element={<GeneralReportPage />} />
        <Route path="*" element={<div>other page</div>} />
      </Routes>
      <RouterProbe />
    </MemoryRouter>
  )
}

// The page has two Save Draft buttons (sticky header + footer); both share one handler.
const saveButton = () => screen.getAllByRole('button', { name: /save draft|saving/i })[0]
const descriptionBox = () => screen.getByPlaceholderText(/detailed description of work/i)

// ---------------------------------------------------------------------------
// Save flow
// ---------------------------------------------------------------------------

describe('Save Draft', () => {
  it('first save creates the report then saves the form to it', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(descriptionBox(), 'Poured curb')
    await user.click(saveButton())

    await screen.findByText(SAVED_TEXT)
    expect(api.createReport).toHaveBeenCalledWith({
      projectId: 'HWS0023',
      reporterUuid: DEV_USER.id,
      reportDate: format(new Date(), 'yyyy-MM-dd'),
    })
    expect(api.saveGeneralForm).toHaveBeenCalledWith(
      REPORT_ID,
      expect.objectContaining({ description: 'Poured curb' })
    )
  })

  it('later saves reuse the report id without creating another report', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    await user.type(descriptionBox(), 'More work')
    await user.click(saveButton())

    await waitFor(() => expect(api.saveGeneralForm).toHaveBeenCalledTimes(2))
    expect(api.createReport).toHaveBeenCalledTimes(1)
    expect(api.saveGeneralForm).toHaveBeenLastCalledWith(REPORT_ID, expect.objectContaining({ description: 'More work' }))
  })

  it('shows Saving... and disables both buttons while the request is in flight', async () => {
    let finishSave
    api.saveGeneralForm.mockReturnValue(new Promise(resolve => { finishSave = resolve }))
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())

    const busy = await screen.findAllByRole('button', { name: /saving/i })
    expect(busy).toHaveLength(2)
    busy.forEach(button => expect(button).toBeDisabled())

    finishSave({ report_id: REPORT_ID, completed_form_id: 'cf-1', saved_at: SAVED_AT })
    await screen.findByText(SAVED_TEXT)
    expect(saveButton()).toBeEnabled()
  })

  it('shows the backend error and keeps the typed form data', async () => {
    api.saveGeneralForm.mockRejectedValue(new Error('Only draft reports can be edited'))
    const user = userEvent.setup()
    renderPage()
    await user.type(descriptionBox(), 'Do not lose me')
    await user.click(saveButton())

    expect(await screen.findByText(/save failed: only draft reports can be edited/i)).toBeInTheDocument()
    expect(descriptionBox()).toHaveValue('Do not lose me')
  })

  it('retry after a failed form save reuses the created report', async () => {
    api.saveGeneralForm.mockRejectedValueOnce(new Error('Network error'))
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())
    await screen.findByText(/save failed: network error/i)

    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    expect(api.createReport).toHaveBeenCalledTimes(1)
    expect(api.saveGeneralForm).toHaveBeenCalledTimes(2)
    expect(api.saveGeneralForm).toHaveBeenLastCalledWith(REPORT_ID, expect.any(Object))
    expect(screen.queryByText(/save failed/i)).not.toBeInTheDocument()
  })

  it('retry after a failed create tries creating the report again', async () => {
    api.createReport.mockRejectedValueOnce(new Error('Reporter is not assigned to this project'))
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())
    await screen.findByText(/save failed: reporter is not assigned/i)
    expect(api.saveGeneralForm).not.toHaveBeenCalled()

    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    expect(api.createReport).toHaveBeenCalledTimes(2)
  })

  it('saves pay item rows typed into the table', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /add item/i }))
    await user.type(screen.getByPlaceholderText('Item No.'), '4.01')
    await user.type(screen.getByPlaceholderText('Qty'), '12')
    await user.click(saveButton())

    await waitFor(() => expect(api.saveGeneralForm).toHaveBeenCalled())
    expect(api.saveGeneralForm.mock.calls[0][1].payItems).toEqual([
      { itemNo: '4.01', budgetCode: '', payQuantity: '12', quantityChk: '', description: '' },
    ])
  })
})

// ---------------------------------------------------------------------------
// Unsaved changes
// ---------------------------------------------------------------------------

describe('unsaved changes', () => {
  it('shows after an edit and clears only when create + save both succeed', async () => {
    api.saveGeneralForm.mockRejectedValueOnce(new Error('Network error'))
    const user = userEvent.setup()
    renderPage()
    await user.type(descriptionBox(), 'x')
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()

    // Report created, form save failed: still dirty (error shown instead)
    await user.click(saveButton())
    await screen.findByText(/save failed/i)

    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('comes back after editing a saved form', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)

    await user.type(descriptionBox(), 'y')
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
  })

  it('stays set when the form is edited while a save is in flight', async () => {
    let finishSave
    api.saveGeneralForm.mockReturnValue(new Promise(resolve => { finishSave = resolve }))
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())
    await screen.findAllByRole('button', { name: /saving/i })
    await user.type(descriptionBox(), 'typed mid-save')

    finishSave({ report_id: REPORT_ID, completed_form_id: 'cf-1', saved_at: SAVED_AT })
    expect(await screen.findByText(/unsaved changes/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Reopening a draft from ?report_id=
// ---------------------------------------------------------------------------

describe('reopening a draft', () => {
  const draftUrl = `/project/HWS0023/report/general?report_id=${REPORT_ID}`

  it('loads the saved form into the fields', async () => {
    api.getReport.mockResolvedValue(savedReport(REPORT_ID, 'Poured curb on 5th Ave'))
    renderPage(draftUrl)

    expect(await screen.findByDisplayValue('Poured curb on 5th Ave')).toBeInTheDocument()
    expect(api.getReport).toHaveBeenCalledWith(REPORT_ID)
    expect(screen.getByDisplayValue('S-7')).toBeInTheDocument()
    expect(screen.getByDisplayValue('4.01')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-09-20')).toBeInTheDocument()
    // Loading is not an edit
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('shows a spinner instead of the form while loading', async () => {
    api.getReport.mockReturnValue(new Promise(() => {}))
    renderPage(draftUrl)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/detailed description of work/i)).not.toBeInTheDocument()
  })

  it('saves edits to the opened draft without creating a new report', async () => {
    api.getReport.mockResolvedValue(savedReport(REPORT_ID, 'Poured curb'))
    const user = userEvent.setup()
    renderPage(draftUrl)
    await user.type(await screen.findByDisplayValue('Poured curb'), ' - day 2')
    await user.click(saveButton())

    await screen.findByText(SAVED_TEXT)
    expect(api.createReport).not.toHaveBeenCalled()
    expect(api.saveGeneralForm).toHaveBeenCalledWith(
      REPORT_ID,
      expect.objectContaining({ description: 'Poured curb - day 2', sheetNo: 'S-7' })
    )
  })

  it('a report with no saved form opens blank and saves to the same report', async () => {
    api.getReport.mockResolvedValue({ report_id: REPORT_ID, status: 'draft', general_form: null })
    const user = userEvent.setup()
    renderPage(draftUrl)
    await user.type(await screen.findByPlaceholderText(/detailed description of work/i), 'First words')
    await user.click(saveButton())

    await screen.findByText(SAVED_TEXT)
    expect(api.createReport).not.toHaveBeenCalled()
    expect(api.saveGeneralForm).toHaveBeenCalledWith(REPORT_ID, expect.objectContaining({ description: 'First words' }))
  })

  it('on load failure shows the error, and Retry loads again', async () => {
    api.getReport
      .mockRejectedValueOnce(new Error('Report not found'))
      .mockResolvedValueOnce(savedReport(REPORT_ID, 'Loaded on retry'))
    const user = userEvent.setup()
    renderPage(draftUrl)

    expect(await screen.findByText('Report not found')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByDisplayValue('Loaded on retry')).toBeInTheDocument()
    expect(api.getReport).toHaveBeenCalledTimes(2)
  })

  it('Back to Drafts goes to the project drafts list', async () => {
    api.getReport.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    renderPage(draftUrl)
    await user.click(await screen.findByRole('button', { name: /back to drafts/i }))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/drafts')
  })

  it('switching to another report_id loads that draft', async () => {
    api.getReport.mockImplementation(id =>
      Promise.resolve(savedReport(id, id === REPORT_ID ? 'Draft A' : 'Draft B'))
    )
    const user = userEvent.setup()
    renderPage(draftUrl)
    await screen.findByDisplayValue('Draft A')

    await user.click(screen.getByRole('button', { name: /go to other draft/i }))
    expect(await screen.findByDisplayValue('Draft B')).toBeInTheDocument()
  })

  it('a slow response for the previous report_id does not overwrite the current one', async () => {
    let resolveA
    api.getReport.mockImplementation(id =>
      id === REPORT_ID
        ? new Promise(resolve => { resolveA = resolve })
        : Promise.resolve(savedReport(id, 'Draft B'))
    )
    const user = userEvent.setup()
    renderPage(draftUrl)
    await user.click(screen.getByRole('button', { name: /go to other draft/i }))
    await screen.findByDisplayValue('Draft B')

    resolveA(savedReport(REPORT_ID, 'Draft A'))
    await new Promise(r => setTimeout(r, 0))
    expect(screen.getByDisplayValue('Draft B')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Draft A')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// New report: report_id goes into the URL on first save
// ---------------------------------------------------------------------------

describe('first save of a new report', () => {
  it('puts the new report_id in the URL', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    expect(screen.getByTestId('url')).toHaveTextContent(`/project/HWS0023/report/general?report_id=${REPORT_ID}`)
  })

  it('does not reload the report it just created, so typing during the save is kept', async () => {
    let finishSave
    api.saveGeneralForm.mockReturnValue(new Promise(resolve => { finishSave = resolve }))
    const user = userEvent.setup()
    renderPage()
    await user.type(descriptionBox(), 'before save')
    await user.click(saveButton())

    // report created and URL updated while the form save is still in flight
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent(`report_id=${REPORT_ID}`))
    await user.type(descriptionBox(), ' + during save')

    finishSave({ report_id: REPORT_ID, completed_form_id: 'cf-1', saved_at: SAVED_AT })
    await screen.findByText(/unsaved changes/i)
    expect(api.getReport).not.toHaveBeenCalled()
    expect(descriptionBox()).toHaveValue('before save + during save')
  })
})

// ---------------------------------------------------------------------------
// Submit flow
// ---------------------------------------------------------------------------

// Two Submit buttons (sticky header + footer) share one handler.
const submitButton = () => screen.getAllByRole('button', { name: /submit report|submitting/i })[0]

describe('Submit', () => {
  const draftUrl = `/project/HWS0023/report/general?report_id=${REPORT_ID}`

  // Opens a saved draft with nothing unsaved, ready to submit.
  async function openSavedDraft() {
    api.getReport.mockResolvedValue(savedReport(REPORT_ID, 'Poured curb'))
    renderPage(draftUrl)
    await screen.findByDisplayValue('Poured curb')
  }

  it('is disabled on a new report that has never been saved', () => {
    renderPage()
    screen.getAllByRole('button', { name: /submit report/i }).forEach(b => expect(b).toBeDisabled())
  })

  it('becomes enabled once the first save creates the report', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    expect(submitButton()).toBeEnabled()
  })

  it('with unsaved changes, asks to save first and does not confirm or submit', async () => {
    const user = userEvent.setup()
    await openSavedDraft()
    await user.type(descriptionBox(), ' more')
    await user.click(submitButton())

    expect(screen.getByRole('alert')).toHaveTextContent('Please save your changes before submitting.')
    expect(window.confirm).not.toHaveBeenCalled()
    expect(api.submitReport).not.toHaveBeenCalled()
  })

  it('the save-first message clears after saving, and submit then goes through', async () => {
    const user = userEvent.setup()
    await openSavedDraft()
    await user.type(descriptionBox(), ' more')
    await user.click(submitButton())
    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(submitButton())
    expect(api.submitReport).toHaveBeenCalledWith(REPORT_ID)
  })

  it('does nothing when the confirm dialog is cancelled', async () => {
    window.confirm.mockReturnValue(false)
    const user = userEvent.setup()
    await openSavedDraft()
    await user.click(submitButton())

    expect(window.confirm).toHaveBeenCalledWith("Submit this report? You won't be able to edit it after.")
    expect(api.submitReport).not.toHaveBeenCalled()
    expect(descriptionBox()).toBeEnabled()
  })

  it('on success locks the form from the submit response, without refetching', async () => {
    const user = userEvent.setup()
    await openSavedDraft()
    await user.click(submitButton())

    expect(await screen.findByText(SUBMITTED_TEXT)).toBeInTheDocument()
    expect(api.getReport).toHaveBeenCalledTimes(1)
    expect(descriptionBox()).toBeDisabled()
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit report/i })).not.toBeInTheDocument()
  })

  it('on failure shows the backend error and leaves the form editable', async () => {
    api.submitReport.mockRejectedValue(new Error('Save the General Form before submitting'))
    const user = userEvent.setup()
    await openSavedDraft()
    await user.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Submit failed: Save the General Form before submitting')
    expect(descriptionBox()).toBeEnabled()
    expect(submitButton()).toBeEnabled()
  })

  it('opening a submitted report renders it read-only with the banner', async () => {
    api.getReport.mockResolvedValue(
      savedReport(REPORT_ID, 'Final', { status: 'submitted', submitted_at: SUBMITTED_AT })
    )
    renderPage(draftUrl)

    expect(await screen.findByText(SUBMITTED_TEXT)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Final')).toBeDisabled()
    expect(screen.getByDisplayValue('4.01')).toBeDisabled()
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit report/i })).not.toBeInTheDocument()
  })
})
