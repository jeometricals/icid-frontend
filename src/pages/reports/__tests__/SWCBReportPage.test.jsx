import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import SWCBReportPage from '../SWCBReportPage'
import * as api from '../../../services/api'

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-swcb'
const IDR_PATH = `/project/HWS0023/idr/${IDR_ID}`
const REPORT_URL = `${IDR_PATH}/swcb/${REPORT_ID}`
const SAVED_AT = '2026-09-25T14:05:00Z'
const SAVED_TEXT = `Saved at ${format(new Date(SAVED_AT), 'HH:mm')}`
const SUBMITTED_AT = '2026-09-25T15:10:00Z'
const SUBMITTED_TEXT =
  `This report belongs to an IDR that was submitted at ${format(new Date(SUBMITTED_AT), "HH:mm 'on' MMMM d, yyyy")}`

// A saved SWCB report_data with a description and one activity row filled in
function swcbData(description) {
  return {
    description,
    activity: { pour: { fromStation: '10+00', toStation: '10+40', remarks: 'Curb pour' } },
    payItems: [{ itemNo: '6.06', budgetCode: '', payQuantity: '40', description: '' }],
  }
}

// The parent IDR as GET /v1/idrs/{id} returns it, holding this SWCB report
function parentIdr({ reportData = swcbData('Poured curb'), reportType = 'SWCB', ...overrides } = {}) {
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
      report_type: reportType,
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

const PROJECT = {
  project_id: 'HWS0023',
  project_name: 'S/W Queens 2025',
  project_description: 'Installation of Curb, Sidewalk and Ped-Ramp',
  registration_code: '2024123457',
  borough: 'Queens',
  status: 'active',
}

vi.mock('../../../services/api', () => ({
  getIdr: vi.fn(),
  getProjectById: vi.fn(),
  saveReport: vi.fn(),
  addReport: vi.fn(),
  deleteReport: vi.fn(),
}))

// AttachmentsSection fetches its own data and needs AuthProvider; these tests only check it is mounted
vi.mock('../../../components/AttachmentsSection', () => ({
  default: (props) => (
    <div data-testid="attachments-section" data-report={props.reportId} data-submitted={String(props.isSubmitted)} />
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.getIdr.mockResolvedValue(parentIdr())
  api.getProjectById.mockResolvedValue(PROJECT)
  api.saveReport.mockImplementation(async (_, reportId, reportData) => ({
    report_id: reportId, report_type: 'SWCB', report_data: reportData, updated_at: SAVED_AT,
  }))
})

function CurrentUrl() {
  const location = useLocation()
  return <div data-testid="url">{location.pathname}</div>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[REPORT_URL]}>
      <Routes>
        <Route path="/project/:projectId/idr/:idrId/swcb/:reportId" element={<SWCBReportPage />} />
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
// Loading
// ---------------------------------------------------------------------------

describe('SWCBReportPage — loading', () => {
  it('shows a spinner instead of the form while the IDR loads', () => {
    api.getIdr.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/detailed description of work/i)).not.toBeInTheDocument()
  })

  it('shows the SWCB title and fills the form from the report_data', async () => {
    renderPage()
    expect(await loaded()).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: "Sidewalk, Curb, Concrete Base Inspector's Report" })).toBeInTheDocument()
    expect(api.getIdr).toHaveBeenCalledWith(IDR_ID)
    expect(api.getProjectById).toHaveBeenCalledWith('HWS0023')
    expect(screen.getByDisplayValue('6.06')).toBeInTheDocument()
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
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
    ['the report is a General', parentIdr({ reportType: 'GEN' }), 'This report is not a Sidewalk, Curb, Concrete Base report'],
    ['the report is not in the IDR', parentIdr({ reports: [] }), 'Report not found in this IDR'],
    ['the IDR belongs to another project', parentIdr({ project_id: 'OTHER' }), 'IDR not found in this project'],
  ])('shows a load error when %s', async (_, idr, message) => {
    api.getIdr.mockResolvedValue(idr)
    renderPage()
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/detailed description of work/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

describe('SWCBReportPage — sections', () => {
  it('shows the SWCB Description of Work wording', async () => {
    renderPage()
    await loaded()
    expect(screen.getByText(/Nature of Work, Hot\/Cold weather Protection and Details\./)).toBeInTheDocument()
  })

  it('shows the Detailed Activity table and the Inspection Matrix (no placeholders left)', async () => {
    renderPage()
    await loaded()
    expect(screen.getByRole('heading', { name: 'Detailed Activity' })).toBeInTheDocument()
    expect(screen.getByLabelText('Excavation From Station')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Inspection Matrix' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Subgrade Compacted, Base: Y' })).toBeInTheDocument()
    expect(screen.queryByText(/coming in Chunk B3/)).not.toBeInTheDocument()
  })

  it('fills the activity table and matrix from the saved report_data', async () => {
    api.getIdr.mockResolvedValue(parentIdr({
      reportData: {
        ...swcbData('Poured curb'),
        inspectionMatrix: {
          subgradeCompacted: { base: 'Y', sidewalk: 'N', curb: 'NA' },
          rebarInstalled: { base: null, sidewalk: 'Y', curb: null },
        },
      },
    }))
    renderPage()
    await loaded()
    expect(screen.getByLabelText('Pour From Station')).toHaveValue('10+00')
    expect(screen.getByLabelText('Pour To Station')).toHaveValue('10+40')
    expect(screen.getByLabelText('Pour Remarks')).toHaveValue('Curb pour')
    expect(screen.getByLabelText('Excavation From Station')).toHaveValue('')
    expect(screen.getByRole('radio', { name: 'Subgrade Compacted, Base: Y' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Subgrade Compacted, Sidewalk: N' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Subgrade Compacted, Curb: N/A' })).toBeChecked()
    expect(screen.getByRole('radio', { name: /^Rebar Installed.*, Sidewalk: Y$/ })).toBeChecked()
    // A line missing from the saved data loads unanswered
    expect(screen.getByRole('radio', { name: 'Compaction Test Taken, Base: Y' })).not.toBeChecked()
  })

  it('renders the shared sections and the attachments for this report', async () => {
    renderPage()
    await loaded()
    for (const name of ['Pay Items', 'Workforce and Equipment', 'End of the Day MPT/Safety Check List',
      'Comments, Visitors, Other Work']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('combobox', { name: 'Add trade' })).toBeInTheDocument()
    expect(screen.getByTestId('attachments-section')).toHaveAttribute('data-report', REPORT_ID)
  })

  it("lists this report's addendums from the loaded IDR, with Add addendum on a draft", async () => {
    const idr = parentIdr()
    idr.reports.push({
      report_id: 'rep-mix', idr_id: IDR_ID, report_type: 'CONC_MIX', is_addendum: true, parent_report_id: REPORT_ID,
      page_number: null, report_data: {},
    })
    api.getIdr.mockResolvedValue(idr)
    renderPage()
    await loaded()
    expect(screen.getByRole('heading', { name: 'Addendums' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Concrete Truck & Mix Info' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /add addendum/i })).toBeInTheDocument()
  })

  it('Add addendum saves the SWCB edits first, then creates the addendum and opens it', async () => {
    const order = []
    api.saveReport.mockImplementation(async (_, reportId, reportData) => {
      order.push('save')
      return { report_id: reportId, report_type: 'SWCB', report_data: reportData, updated_at: SAVED_AT }
    })
    api.addReport.mockImplementation(async () => {
      order.push('add')
      return { report_id: 'rep-mix', report_type: 'CONC_MIX', is_addendum: true, parent_report_id: REPORT_ID }
    })
    const user = userEvent.setup()
    renderPage()
    await user.type(await loaded(), ' - day 2')
    await user.click(screen.getByRole('button', { name: /add addendum/i }))
    await user.click(screen.getByRole('button', { name: 'Concrete Truck & Mix Info' }))

    expect(await screen.findByTestId('url')).toHaveTextContent(`${IDR_PATH}/conc-mix/rep-mix`)
    expect(order).toEqual(['save', 'add'])
    expect(api.saveReport.mock.calls[0][2].description).toBe('Poured curb - day 2')
    expect(api.addReport).toHaveBeenCalledWith(IDR_ID, { reportType: 'CONC_MIX', isAddendum: true, parentReportId: REPORT_ID })
  })

  it('Add addendum creates nothing when saving the SWCB edits fails', async () => {
    api.saveReport.mockRejectedValueOnce(new Error('Network error'))
    const user = userEvent.setup()
    renderPage()
    await user.type(await loaded(), ' - day 2')
    await user.click(screen.getByRole('button', { name: /add addendum/i }))
    await user.click(screen.getByRole('button', { name: 'Concrete Truck & Mix Info' }))

    expect(await screen.findByText(/save failed: network error/i)).toBeInTheDocument()
    expect(api.addReport).not.toHaveBeenCalled()
    expect(descriptionBox()).toHaveValue('Poured curb - day 2')
    expect(screen.queryByTestId('url')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Save Draft
// ---------------------------------------------------------------------------

describe('SWCBReportPage — Save Draft', () => {
  it('PUTs the whole form to this report, keeping saved activity and filling the SWCB defaults', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await loaded(), ' - day 2')
    await user.click(saveButton())

    expect(await screen.findByText(SAVED_TEXT)).toBeInTheDocument()
    expect(api.saveReport).toHaveBeenCalledWith(IDR_ID, REPORT_ID, expect.any(Object))
    const saved = api.saveReport.mock.calls[0][2]
    expect(saved.description).toBe('Poured curb - day 2')
    expect(saved.activity).toEqual({
      excavation: { fromStation: '', toStation: '', remarks: '' },
      formPrep: { fromStation: '', toStation: '', remarks: '' },
      pour: { fromStation: '10+00', toStation: '10+40', remarks: 'Curb pour' },
    })
    expect(Object.keys(saved.inspectionMatrix)).toEqual([
      'subgradeCompacted', 'compactionTestTaken', 'sidewalkFoundationPlaced', 'roadwayStoneBasePlaced',
      'curingCompoundApplied', 'otherCuringMethods', 'rebarInstalled',
    ])
    expect(saved.inspectionMatrix.rebarInstalled).toEqual({ base: null, sidewalk: null, curb: null })
    expect(saved).toMatchObject({ additionalWorkforce: [], additionalEquipment: [], comments: '' })
  })

  it('saves what was typed into the activity table and picked in the matrix', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.type(screen.getByLabelText('Excavation From Station'), '9+50')
    await user.type(screen.getByLabelText('Form / Prep Remarks'), 'Forms set')
    await user.click(screen.getByRole('radio', { name: 'Curing Compound Applied, Curb: Y' }))
    await user.click(screen.getByRole('radio', { name: 'Compaction Test Taken, Base: N/A' }))
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    await user.click(saveButton())

    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    const saved = api.saveReport.mock.calls[0][2]
    expect(saved.activity).toEqual({
      excavation: { fromStation: '9+50', toStation: '', remarks: '' },
      formPrep: { fromStation: '', toStation: '', remarks: 'Forms set' },
      pour: { fromStation: '10+00', toStation: '10+40', remarks: 'Curb pour' },
    })
    expect(saved.inspectionMatrix.curingCompoundApplied).toEqual({ base: null, sidewalk: null, curb: 'Y' })
    expect(saved.inspectionMatrix.compactionTestTaken).toEqual({ base: 'NA', sidewalk: null, curb: null })
    expect(saved.inspectionMatrix.subgradeCompacted).toEqual({ base: null, sidewalk: null, curb: null })
  })

  it('opens a never-edited report (empty report_data) as a blank form that saves the full SWCB shape', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {} }))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByPlaceholderText(/detailed description of work/i)).toHaveValue('')
    await user.click(saveButton())

    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    const saved = api.saveReport.mock.calls[0][2]
    expect(saved.activity.excavation).toEqual({ fromStation: '', toStation: '', remarks: '' })
    expect(saved.workforce).toEqual({ superintendent: '', foremen: '', operators: '', laborers: '', flaggers: '' })
    expect(saved.safetyRemarks.siteCleaned).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Read-only when the parent IDR is submitted
// ---------------------------------------------------------------------------

describe('SWCBReportPage — read-only', () => {
  it('renders read-only with the submitted banner and no Save Draft', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted', submitted_at: SUBMITTED_AT }))
    renderPage()
    await loaded()
    expect(screen.getByText(SUBMITTED_TEXT)).toBeInTheDocument()
    expect(descriptionBox()).toBeDisabled()
    expect(screen.getByRole('button', { name: /add item/i })).toBeDisabled()
    expect(screen.getByLabelText('Pour From Station')).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Subgrade Compacted, Base: Y' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()
    expect(screen.getByTestId('attachments-section')).toHaveAttribute('data-submitted', 'true')
  })
})
