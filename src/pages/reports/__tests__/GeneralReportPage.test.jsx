import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import GeneralReportPage from '../GeneralReportPage'
import * as api from '../../../services/api'

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-gen'
const IDR_PATH = `/project/HWS0023/idr/${IDR_ID}`
const REPORT_URL = `${IDR_PATH}/report/${REPORT_ID}`
const SAVED_AT = '2026-09-25T14:05:00Z'
const SAVED_TEXT = `Saved at ${format(new Date(SAVED_AT), 'HH:mm')}`
const SUBMITTED_AT = '2026-09-25T15:10:00Z'
const SUBMITTED_TEXT =
  `This report belongs to an IDR that was submitted at ${format(new Date(SUBMITTED_AT), "HH:mm 'on' MMMM d, yyyy")}`

// Keys older reports stored in report_data that now live on the IDR; the page must neither show nor save them
const IDR_LEVEL_KEYS = [
  'date', 'sheetNo', 'dayOfWeek', 'workActivityStart', 'workActivityEnd', 'inspectorTimeStart', 'inspectorTimeEnd',
  'dailyTempLow', 'dailyTempHigh', 'weatherAM', 'weatherPM',
]

// A General report's saved report_data as a pre-refactor report stored it: report fields plus the legacy IDR-level keys
function generalData(description) {
  return {
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
  }
}

// The parent IDR as GET /v1/idrs/{id} returns it, holding this General report
function parentIdr({ reportData = generalData('Poured curb'), ...overrides } = {}) {
  return {
    idr_id: IDR_ID,
    project_id: 'HWS0023',
    report_date: '2026-09-27',
    work_start_time: '07:30:00',
    work_end_time: '16:00:00',
    temp_low: 42.0,
    temp_high: 61.0,
    weather_am: 'Clear',
    weather_pm: 'Cloudy',
    status: 'draft',
    submitted_at: null,
    total_pages: null,
    reports: [{
      report_id: REPORT_ID,
      idr_id: IDR_ID,
      report_type: 'GEN',
      is_addendum: false,
      parent_report_id: null,
      page_number: null,
      report_data: reportData,
      created_at: '2026-09-25T13:00:00Z',
      updated_at: '2026-09-25T13:00:00Z',
    }],
    ...overrides,
  }
}

vi.mock('../../../services/api', () => ({
  getIdr: vi.fn(),
  saveReport: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.getIdr.mockResolvedValue(parentIdr())
  api.saveReport.mockImplementation(async (_, reportId, reportData) => ({
    report_id: reportId, report_type: 'GEN', report_data: reportData, updated_at: SAVED_AT,
  }))
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

// `from` mimics the list page the IDR was opened from, carried through by the IDR page's Open button
function renderPage(from) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: REPORT_URL, state: from ? { from } : null }]}>
      <Routes>
        <Route path="/project/:projectId/idr/:idrId/report/:reportId" element={<GeneralReportPage />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

// The page has two Save Draft buttons (sticky header + footer); both share one handler.
const saveButton = () => screen.getAllByRole('button', { name: /save draft|saving/i })[0]
const descriptionBox = () => screen.getByPlaceholderText(/detailed description of work/i)
const loaded = () => screen.findByDisplayValue('Poured curb')

// ---------------------------------------------------------------------------
// Loading from the parent IDR
// ---------------------------------------------------------------------------

describe('loading', () => {
  it('shows a spinner instead of the form while the IDR loads', () => {
    api.getIdr.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/detailed description of work/i)).not.toBeInTheDocument()
  })

  it("loads the parent IDR and fills the form from this report's report_data", async () => {
    renderPage()
    expect(await loaded()).toBeInTheDocument()
    expect(api.getIdr).toHaveBeenCalledWith(IDR_ID)
    expect(screen.getByDisplayValue('4.01')).toBeInTheDocument()
    // Loading is not an edit
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('shows the IDR date, weather, temps and work hours as a read-only context line', async () => {
    renderPage()
    await loaded()
    expect(screen.getByText(/Set on the IDR page/).parentElement).toHaveTextContent(
      'Date: Sep 27, 2026 · Weather: Clear / Cloudy · Temp: 42 / 61 °F · Work: 07:30 - 16:00'
    )
  })

  it('has no editable date, sheet, time, temperature or weather fields (they live on the IDR)', async () => {
    renderPage()
    await loaded()
    for (const label of ['Date', 'Sheet No.', 'Day of Week', 'Work Activity Start', 'Inspector Time End',
      'Daily Temp Low (°F)', 'Weather AM', 'Weather PM']) {
      expect(screen.queryByText(label, { selector: 'label' })).not.toBeInTheDocument()
    }
    // Legacy values stored in report_data are not shown anywhere
    expect(screen.queryByDisplayValue('S-7')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('2026-09-20')).not.toBeInTheDocument()
  })

  it('opens a never-edited report (empty report_data) as a blank form', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {} }))
    renderPage()
    expect(await screen.findByPlaceholderText(/detailed description of work/i)).toHaveValue('')
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument()
  })

  it('has no Submit button (submitting happens on the IDR page)', async () => {
    renderPage()
    await loaded()
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument()
  })

  it('on load failure shows the error, and Retry loads again', async () => {
    api.getIdr.mockRejectedValueOnce(new Error('IDR not found'))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('IDR not found')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(await loaded()).toBeInTheDocument()
    expect(api.getIdr).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['the report is not in the IDR', parentIdr({ reports: [] }), 'Report not found in this IDR'],
    ['the report is not a General', (() => { const i = parentIdr(); i.reports[0].report_type = 'SWR'; return i })(), 'This report is not a General report'],
    ['the IDR belongs to another project', parentIdr({ project_id: 'OTHER' }), 'IDR not found in this project'],
  ])('shows a load error when %s', async (_, idr, message) => {
    api.getIdr.mockResolvedValue(idr)
    renderPage()
    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it('on load failure, Back to IDR goes to the parent IDR page', async () => {
    api.getIdr.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    renderPage('drafts')
    await user.click(await screen.findByRole('button', { name: 'Back to IDR' }))
    expect(screen.getByTestId('url')).toHaveTextContent(new RegExp(`^${IDR_PATH}$`))
    expect(screen.getByTestId('from')).toHaveTextContent('drafts')
  })
})

// ---------------------------------------------------------------------------
// Back navigation
// ---------------------------------------------------------------------------

describe('Back to IDR', () => {
  it('goes to the parent IDR page, keeping where the IDR was opened from', async () => {
    const user = userEvent.setup()
    renderPage('archive')
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Back to IDR' }))
    expect(screen.getByTestId('url')).toHaveTextContent(new RegExp(`^${IDR_PATH}$`))
    expect(screen.getByTestId('from')).toHaveTextContent('archive') // so the IDR page's Back still goes to Archive
  })
})

// ---------------------------------------------------------------------------
// Save Draft
// ---------------------------------------------------------------------------

describe('Save Draft', () => {
  it('PUTs the whole form to this report, then shows "Saved at" from the response', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await loaded(), ' - day 2')
    await user.click(saveButton())

    await screen.findByText(SAVED_TEXT)
    expect(api.saveReport).toHaveBeenCalledWith(
      IDR_ID,
      REPORT_ID,
      expect.objectContaining({ description: 'Poured curb - day 2', payItems: expect.any(Array) })
    )
  })

  it('never saves the IDR-level keys, even when the loaded report_data still had them', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(saveButton())
    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())

    const saved = api.saveReport.mock.calls[0][2]
    for (const key of IDR_LEVEL_KEYS) expect(saved).not.toHaveProperty(key)
    expect(saved).toMatchObject({ workforce: { foreman: '2' }, safetyChecks: { plasticBarrels: true } })
  })

  it('a blank report saves no IDR-level keys either', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {} }))
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByPlaceholderText(/detailed description of work/i), 'First words')
    await user.click(saveButton())
    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    for (const key of IDR_LEVEL_KEYS) expect(api.saveReport.mock.calls[0][2]).not.toHaveProperty(key)
  })

  it('the context line follows the IDR after the post-save refetch', async () => {
    api.getIdr
      .mockResolvedValueOnce(parentIdr())
      .mockResolvedValue(parentIdr({ weather_pm: 'Rainy' }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(saveButton())
    expect(await screen.findByText(/Clear \/ Rainy/)).toBeInTheDocument()
  })

  it('silently refetches the parent IDR after a successful save', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    await waitFor(() => expect(api.getIdr).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('the refetch never overwrites the form (typing is kept)', async () => {
    api.getIdr
      .mockResolvedValueOnce(parentIdr())
      .mockResolvedValue(parentIdr({ reportData: generalData('SERVER COPY') }))
    const user = userEvent.setup()
    renderPage()
    await user.type(await loaded(), ' edited')
    await user.click(saveButton())
    await waitFor(() => expect(api.getIdr).toHaveBeenCalledTimes(2))
    expect(descriptionBox()).toHaveValue('Poured curb edited')
  })

  it('switches to read-only when the refetch shows the IDR was submitted', async () => {
    api.getIdr
      .mockResolvedValueOnce(parentIdr())
      .mockResolvedValue(parentIdr({ status: 'submitted', submitted_at: SUBMITTED_AT }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(saveButton())
    expect(await screen.findByText(SUBMITTED_TEXT)).toBeInTheDocument()
    expect(descriptionBox()).toBeDisabled()
  })

  it('shows an explicit error when the refetch fails, and retries it', async () => {
    api.getIdr.mockResolvedValueOnce(parentIdr()).mockRejectedValueOnce(new Error('Network error'))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(saveButton())
    expect(await screen.findByText("Couldn't refresh this IDR: Network error")).toBeInTheDocument()
    expect(screen.getByText(SAVED_TEXT)).toBeInTheDocument() // the save itself worked

    await user.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => expect(screen.queryByText(/couldn't refresh/i)).not.toBeInTheDocument())
  })

  it('does not refetch after a failed save', async () => {
    api.saveReport.mockRejectedValueOnce(new Error('Network error'))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(saveButton())
    await screen.findByText(/save failed: network error/i)
    expect(api.getIdr).toHaveBeenCalledTimes(1)
  })

  it('shows Saving... and disables both buttons while the request is in flight', async () => {
    let finishSave
    api.saveReport.mockReturnValue(new Promise(resolve => { finishSave = resolve }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(saveButton())

    const busy = await screen.findAllByRole('button', { name: /saving/i })
    expect(busy).toHaveLength(2)
    busy.forEach(button => expect(button).toBeDisabled())

    finishSave({ report_id: REPORT_ID, updated_at: SAVED_AT })
    await screen.findByText(SAVED_TEXT)
    expect(saveButton()).toBeEnabled()
  })

  it('shows the backend error, keeps the typed data, and a retry saves', async () => {
    api.saveReport.mockRejectedValueOnce(new Error('Network error'))
    const user = userEvent.setup()
    renderPage()
    await user.type(await loaded(), ' - keep me')
    await user.click(saveButton())

    expect(await screen.findByText(/save failed: network error/i)).toBeInTheDocument()
    expect(descriptionBox()).toHaveValue('Poured curb - keep me')

    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    expect(api.saveReport).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(/save failed/i)).not.toBeInTheDocument()
  })

  it('saves pay item rows typed into the table', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {} }))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /add item/i }))
    await user.type(screen.getByPlaceholderText('Item No.'), '4.01')
    await user.type(screen.getByPlaceholderText('Qty'), '12')
    await user.click(saveButton())

    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect(api.saveReport.mock.calls[0][2].payItems).toEqual([
      { itemNo: '4.01', budgetCode: '', payQuantity: '12', quantityChk: '', description: '' },
    ])
  })
})

// ---------------------------------------------------------------------------
// IDR submitted while editing (409 on save)
// ---------------------------------------------------------------------------

describe('IDR submitted mid-edit', () => {
  it('on a 409 says so, reloads the IDR and shows the saved report read-only', async () => {
    api.getIdr
      .mockResolvedValueOnce(parentIdr())
      .mockResolvedValue(parentIdr({ status: 'submitted', submitted_at: SUBMITTED_AT }))
    api.saveReport.mockRejectedValueOnce(Object.assign(new Error('Only draft IDRs can be edited'), { status: 409 }))
    const user = userEvent.setup()
    renderPage()
    await user.type(await loaded(), ' - unsaved')
    await user.click(saveButton())

    expect(await screen.findByText(
      'This IDR was submitted while you were editing. Your unsaved changes could not be saved. Reloading...'
    )).toBeInTheDocument()
    expect(await screen.findByText(SUBMITTED_TEXT)).toBeInTheDocument()
    expect(descriptionBox()).toHaveValue('Poured curb') // server copy, unsaved typing dropped
    expect(descriptionBox()).toBeDisabled()
    expect(screen.queryByText(/save failed/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Unsaved changes/)).not.toBeInTheDocument() // the status text, not the banner
  })
})

// ---------------------------------------------------------------------------
// Unsaved changes
// ---------------------------------------------------------------------------

describe('unsaved changes', () => {
  it('shows after an edit and clears after a successful save', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await loaded(), 'x')
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()

    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('comes back after editing a saved form', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(saveButton())
    await screen.findByText(SAVED_TEXT)

    await user.type(descriptionBox(), 'y')
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
  })

  it('stays set when the form is edited while a save is in flight', async () => {
    let finishSave
    api.saveReport.mockReturnValue(new Promise(resolve => { finishSave = resolve }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(saveButton())
    await screen.findAllByRole('button', { name: /saving/i })
    await user.type(descriptionBox(), ' typed mid-save')

    finishSave({ report_id: REPORT_ID, updated_at: SAVED_AT })
    expect(await screen.findByText(/unsaved changes/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Read-only when the parent IDR is submitted
// ---------------------------------------------------------------------------

describe('read-only', () => {
  it('renders the report read-only with the IDR-submitted banner and no Save Draft', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted', submitted_at: SUBMITTED_AT }))
    renderPage('archive')

    expect(await screen.findByText(SUBMITTED_TEXT)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Poured curb')).toBeDisabled()
    expect(screen.getByDisplayValue('4.01')).toBeDisabled()
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to IDR' })).toBeEnabled()
  })
})
