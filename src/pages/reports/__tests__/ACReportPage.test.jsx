import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { format } from 'date-fns'
import ACReportPage from '../ACReportPage'
import * as api from '../../../services/api'

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-ac'
const REPORT_URL = `/project/HWS0023/idr/${IDR_ID}/ac/${REPORT_ID}`
const SAVED_AT = '2026-09-30T14:05:00Z'
const SAVED_TEXT = `Saved at ${format(new Date(SAVED_AT), 'HH:mm')}`
const SUBMITTED_AT = '2026-09-30T15:10:00Z'
const SUBMITTED_TEXT =
  `This report belongs to an IDR that was submitted at ${format(new Date(SUBMITTED_AT), "HH:mm 'on' MMMM d, yyyy")}`

const EMPTY_COURSE = {
  itemNo: '', mixType: '', stationFrom: '', stationTo: '', lane: '', length: '', width: '', course: '',
  designDepth: '', area: '', weight: '',
}
const EMPTY_USAGE = { noOfTickets: '', firstTicketNo: '', lastTicketNo: '', qtyReceived: '', qtyUsed: '', qtyWasted: '' }
const EMPTY_REQUIREMENTS = Object.fromEntries(
  ['subgradeCompacted', 'roadwayCleanDry', 'acRollerPerSpec', 'densityTestsTaken', 'spotCheckAcDepth',
    'tackCoatPerSpec', 'tackCoatOnEdges'].map(key => [key, { value: '', remarks: '' }])
)

// A saved AC report_data with something in every AC section plus a comment and a pay item
const AC_DATA = {
  pavingContractor: { pavingContractorName: 'Tri-State Paving', subcontractor: '', riceNo: '2.515' },
  temperature: { surfaceStart: '55', surfaceFinish: '62', ambientStart: '58', ambientFinish: '66' },
  maxDensity: { top: '152.4', binder: '150.1' },
  pavementCourses: [{ ...EMPTY_COURSE, itemNo: '4.02 AB-R', stationFrom: '5+40', stationTo: '12+00', area: '312.5' }],
  materialUsageTop: { ...EMPTY_USAGE, firstTicketNo: 'T-100', qtyUsed: '84.5' },
  materialUsageBinder: { ...EMPTY_USAGE, firstTicketNo: 'B-200', qtyUsed: '120' },
  acRequirements: { ...EMPTY_REQUIREMENTS, densityTestsTaken: { value: 'Y', remarks: '3 cores' } },
  tackCoat: { noOfGallons: '45', gallonsPerSy: '0.05', applicationMethod: 'Spray bar' },
  deliveryTickets: [{ location: 'Sta 12+40, N lane', ticketNo: 'T-88', temperature: '285' }],
  comments: 'Milled and paved Main St',
  payItems: [{ itemNo: '4.02', budgetCode: '', payQuantity: '120', description: '' }],
}

// The parent IDR as GET /v1/idrs/{id} returns it, holding this AC report
function parentIdr({ reportData = AC_DATA, reportType = 'AC', ...overrides } = {}) {
  return {
    idr_id: IDR_ID,
    project_id: 'HWS0023',
    report_date: '2026-09-30',
    work_start_time: '07:30:00',
    work_end_time: '16:00:00',
    temp_low: 48.0,
    temp_high: 66.0,
    weather_am: 'Clear',
    weather_pm: 'Clear',
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
      created_at: '2026-09-30T13:00:00Z',
      updated_at: '2026-09-30T13:00:00Z',
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
    report_id: reportId, report_type: 'AC', report_data: reportData, updated_at: SAVED_AT,
  }))
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[REPORT_URL]}>
      <Routes>
        <Route path="/project/:projectId/idr/:idrId/ac/:reportId" element={<ACReportPage />} />
      </Routes>
    </MemoryRouter>
  )
}

// The page has two Save Draft buttons (sticky header + footer); both share one handler.
const saveButton = () => screen.getAllByRole('button', { name: /save draft|saving/i })[0]
const commentsBox = () => screen.getByPlaceholderText(/additional comments/i)
const title = () => screen.findByRole('heading', { name: "Asphaltic Concrete Inspector's Report" })
const loaded = () => screen.findByDisplayValue('Tri-State Paving')
const savedData = () => api.saveReport.mock.calls[0][2]
// The two Material Usage cards share field labels, so they're read within their own region
const usageCard = (which) => within(screen.getByRole('region', { name: `Material Usage — ${which}` }))

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

describe('ACReportPage — loading', () => {
  it('shows the AC title and fills every section from the report_data', async () => {
    renderPage()
    expect(await loaded()).toBeInTheDocument()
    expect(await title()).toBeInTheDocument()
    expect(api.getIdr).toHaveBeenCalledWith(IDR_ID)
    expect(screen.getByLabelText('Rice No. / Specific Gravity')).toHaveValue(2.515)
    expect(screen.getByLabelText('Ambient Finish')).toHaveValue(66)
    expect(screen.getByLabelText('Top')).toHaveValue(152.4)
    expect(screen.getByLabelText('Course 1 Item No.')).toHaveValue('4.02 AB-R')
    expect(screen.getByLabelText('Course 1 Area (S.Y.)')).toHaveValue(312.5)
    expect(usageCard('Top').getByLabelText('First Ticket No.')).toHaveValue('T-100')
    expect(usageCard('Binder').getByLabelText('First Ticket No.')).toHaveValue('B-200')
    expect(screen.getByRole('radio', { name: 'Density Tests Taken: Y' })).toBeChecked()
    expect(screen.getByLabelText('Density Tests Taken Remarks')).toHaveValue('3 cores')
    expect(screen.getByLabelText('Tack Coat Application Method / Type')).toHaveValue('Spray bar')
    expect(screen.getByLabelText('Ticket 1 Ticket No.')).toHaveValue('T-88')
    expect(screen.getByDisplayValue('4.02')).toBeInTheDocument()
    expect(commentsBox()).toHaveValue('Milled and paved Main St')
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('shows a load error when the report is not an AC report', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportType: 'GEN' }))
    renderPage()
    expect(await screen.findByText('This report is not a Asphaltic Concrete report')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/additional comments/i)).not.toBeInTheDocument()
  })

  it('loads partial, malformed or placeholder-era shapes without crashing, keeping extra keys', async () => {
    api.getIdr.mockResolvedValue(parentIdr({
      reportData: {
        legacyNote: 'kept',
        pavingContractor: { pavingContractorName: 'Tri-State Paving' },
        temperature: {},
        maxDensity: 'bad',
        pavementCourses: { not: 'an array' },
        materialUsageTop: [],
        acRequirements: { densityTestsTaken: { value: 'N' }, spotCheckAcDepth: 'Y' },
        deliveryTickets: [{ ticketNo: 'T-1' }],
        comments: '',
      },
    }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    expect(screen.getByText('No courses added yet. Click Add Course to record one.')).toBeInTheDocument()
    expect(screen.getByLabelText('Ticket 1 Location')).toHaveValue('')
    expect(screen.getByLabelText('Ticket 1 Ticket No.')).toHaveValue('T-1')
    expect(screen.getByRole('radio', { name: 'Density Tests Taken: N' })).toBeChecked()
    await user.click(saveButton())

    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    const saved = savedData()
    expect(saved.legacyNote).toBe('kept')
    expect(saved.pavingContractor).toEqual({ pavingContractorName: 'Tri-State Paving', subcontractor: '', riceNo: '' })
    expect(saved.temperature).toEqual({ surfaceStart: '', surfaceFinish: '', ambientStart: '', ambientFinish: '' })
    expect(saved.maxDensity).toEqual({ top: '', binder: '' })
    expect(saved.pavementCourses).toEqual([])
    expect(saved.materialUsageTop).toEqual(EMPTY_USAGE)
    expect(saved.materialUsageBinder).toEqual(EMPTY_USAGE)
    expect(saved.acRequirements).toEqual({ ...EMPTY_REQUIREMENTS, densityTestsTaken: { value: 'N', remarks: '' } })
    expect(saved.tackCoat).toEqual({ noOfGallons: '', gallonsPerSy: '', applicationMethod: '' })
    expect(saved.deliveryTickets).toEqual([{ location: '', ticketNo: 'T-1', temperature: '' }])
  })
})

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

describe('ACReportPage — sections', () => {
  it('renders the 13 section cards in template order, with no placeholders left', async () => {
    renderPage()
    await loaded()
    const expected = [
      'Paving Contractor Info',
      'Temperature',
      'Theoretical Max Density (from A/C Plant)',
      'Pavement Course Table',
      'Material Usage — Top',
      'Material Usage — Binder',
      'Pay Items',
      'AC Requirements Checklist',
      'Tack Coat',
      'Delivery Ticket Log',
      'Workforce and Equipment',
      'End of the Day MPT/Safety Check List',
      'Comments, Visitors, Other Work',
    ]
    const headings = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(headings.filter(h => expected.includes(h))).toEqual(expected)
    expect(screen.queryByText(/coming in Chunk E3/)).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Add trade' })).toBeInTheDocument()
    expect(screen.getByTestId('attachments-section')).toHaveAttribute('data-report', REPORT_ID)
  })
})

// ---------------------------------------------------------------------------
// Save Draft
// ---------------------------------------------------------------------------

describe('ACReportPage — Save Draft', () => {
  it('saves what was entered across every AC section, keeping the saved values', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.type(screen.getByLabelText('Subcontractor (if any)'), 'Acme')
    await user.type(screen.getByLabelText('Surface Start'), '1')
    await user.type(screen.getByLabelText('Binder'), '9')
    await user.click(screen.getByRole('button', { name: 'Add Course' }))
    await user.type(screen.getByLabelText('Course 2 Lane'), 'S')
    await user.type(usageCard('Top').getByLabelText('Qty Wasted/Rejected'), '2')
    await user.type(usageCard('Binder').getByLabelText('Last Ticket No.'), 'B-230')
    await user.click(screen.getByRole('radio', { name: 'Spot Check A/C Depth: N/A' }))
    await user.type(screen.getByLabelText('Spot Check A/C Depth Remarks'), 'ok')
    await user.clear(screen.getByLabelText('No. of Gallons'))
    await user.type(screen.getByLabelText('No. of Gallons'), '50')
    await user.click(screen.getByRole('button', { name: 'Add Ticket' }))
    await user.type(screen.getByLabelText('Ticket 2 Temperature'), '290')
    await user.type(commentsBox(), ' - day 2')
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    await user.click(saveButton())

    expect(await screen.findByText(SAVED_TEXT)).toBeInTheDocument()
    expect(api.saveReport).toHaveBeenCalledWith(IDR_ID, REPORT_ID, expect.any(Object))
    const saved = savedData()
    expect(saved.pavingContractor).toEqual({ pavingContractorName: 'Tri-State Paving', subcontractor: 'Acme', riceNo: '2.515' })
    expect(saved.temperature.surfaceStart).toBe('551')
    expect(saved.maxDensity).toEqual({ top: '152.4', binder: '150.19' })
    expect(saved.pavementCourses).toEqual([AC_DATA.pavementCourses[0], { ...EMPTY_COURSE, lane: 'S' }])
    expect(saved.materialUsageTop).toEqual({ ...AC_DATA.materialUsageTop, qtyWasted: '2' })
    expect(saved.materialUsageBinder).toEqual({ ...AC_DATA.materialUsageBinder, lastTicketNo: 'B-230' })
    expect(saved.acRequirements.spotCheckAcDepth).toEqual({ value: 'NA', remarks: 'ok' })
    expect(saved.acRequirements.densityTestsTaken).toEqual({ value: 'Y', remarks: '3 cores' })
    expect(saved.tackCoat).toEqual({ noOfGallons: '50', gallonsPerSy: '0.05', applicationMethod: 'Spray bar' })
    expect(saved.deliveryTickets).toEqual([
      AC_DATA.deliveryTickets[0],
      { location: '', ticketNo: '', temperature: '290' },
    ])
    expect(saved.comments).toBe('Milled and paved Main St - day 2')
    expect(saved.payItems).toEqual(AC_DATA.payItems)
  })

  it('removes a course and a delivery ticket', async () => {
    api.getIdr.mockResolvedValue(parentIdr({
      reportData: {
        ...AC_DATA,
        pavementCourses: [{ ...EMPTY_COURSE, itemNo: 'A' }, { ...EMPTY_COURSE, itemNo: 'B' }],
        deliveryTickets: [{ location: '', ticketNo: 'T-1', temperature: '' }, { location: '', ticketNo: 'T-2', temperature: '' }],
      },
    }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Remove course 1' }))
    await user.click(screen.getByRole('button', { name: 'Remove ticket 2' }))
    expect(screen.getByLabelText('Course 1 Item No.')).toHaveValue('B')
    await user.click(saveButton())

    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect(savedData().pavementCourses).toEqual([{ ...EMPTY_COURSE, itemNo: 'B' }])
    expect(savedData().deliveryTickets).toEqual([{ location: '', ticketNo: 'T-1', temperature: '' }])
  })

  it('opens a never-edited report (empty report_data) as a blank form that saves the full AC shape', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {} }))
    const user = userEvent.setup()
    renderPage()
    await title()
    expect(commentsBox()).toHaveValue('')
    await user.click(saveButton())

    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    const saved = savedData()
    expect(saved).toMatchObject({
      pavingContractor: { pavingContractorName: '', subcontractor: '', riceNo: '' },
      temperature: { surfaceStart: '', surfaceFinish: '', ambientStart: '', ambientFinish: '' },
      maxDensity: { top: '', binder: '' },
      pavementCourses: [],
      materialUsageTop: EMPTY_USAGE,
      materialUsageBinder: EMPTY_USAGE,
      acRequirements: EMPTY_REQUIREMENTS,
      tackCoat: { noOfGallons: '', gallonsPerSy: '', applicationMethod: '' },
      deliveryTickets: [],
      comments: '',
    })
    expect(saved.workforce).toEqual({ superintendent: '', foremen: '', operators: '', laborers: '', flaggers: '' })
    expect(saved.safetyRemarks.siteCleaned).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Read-only when the parent IDR is submitted
// ---------------------------------------------------------------------------

describe('ACReportPage — read-only', () => {
  it('renders read-only with the submitted banner, every AC input disabled and no Save Draft', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted', submitted_at: SUBMITTED_AT }))
    renderPage()
    await loaded()
    expect(screen.getByText(SUBMITTED_TEXT)).toBeInTheDocument()
    for (const input of [...screen.getAllByRole('textbox'), ...screen.getAllByRole('spinbutton'), ...screen.getAllByRole('radio')]) {
      expect(input).toBeDisabled()
    }
    for (const name of ['Add Course', 'Remove course 1', 'Add Ticket', 'Remove ticket 1']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()
    expect(screen.getByTestId('attachments-section')).toHaveAttribute('data-submitted', 'true')
  })
})
