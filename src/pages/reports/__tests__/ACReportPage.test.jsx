import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

// A saved AC report_data with a comment and one pay item filled in
const AC_DATA = {
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
const loaded = () => screen.findByDisplayValue('Milled and paved Main St')

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

describe('ACReportPage — loading', () => {
  it('shows the AC title and fills the shared sections from the report_data', async () => {
    renderPage()
    expect(await loaded()).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: "Asphaltic Concrete Inspector's Report" })).toBeInTheDocument()
    expect(api.getIdr).toHaveBeenCalledWith(IDR_ID)
    expect(screen.getByDisplayValue('4.02')).toBeInTheDocument()
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('shows a load error when the report is not an AC report', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportType: 'GEN' }))
    renderPage()
    expect(await screen.findByText('This report is not a Asphaltic Concrete report')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/additional comments/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

describe('ACReportPage — sections', () => {
  it('renders all 13 section cards in template order (Workforce and Equipment share one card)', async () => {
    renderPage()
    await loaded()
    const headings = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    const expected = [
      'Paving Contractor Info',
      'Temperature',
      'Theoretical Max Density',
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
    expect(headings.filter(h => expected.includes(h))).toEqual(expected)
    expect(screen.getByRole('combobox', { name: 'Add trade' })).toBeInTheDocument()
    expect(screen.getByTestId('attachments-section')).toHaveAttribute('data-report', REPORT_ID)
  })
})

// ---------------------------------------------------------------------------
// Save Draft
// ---------------------------------------------------------------------------

describe('ACReportPage — Save Draft', () => {
  it('PUTs the shared sections to this report', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await loaded(), ' - day 2')
    await user.click(saveButton())

    expect(await screen.findByText(SAVED_TEXT)).toBeInTheDocument()
    expect(api.saveReport).toHaveBeenCalledWith(IDR_ID, REPORT_ID, expect.any(Object))
    const saved = api.saveReport.mock.calls[0][2]
    expect(saved.comments).toBe('Milled and paved Main St - day 2')
    expect(saved.payItems).toEqual(AC_DATA.payItems)
    expect(saved).toMatchObject({ additionalWorkforce: [], additionalEquipment: [] })
  })

  it('opens a never-edited report (empty report_data) as a blank form that saves the shared shape', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {} }))
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: "Asphaltic Concrete Inspector's Report" })
    expect(commentsBox()).toHaveValue('')
    await user.click(saveButton())

    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    const saved = api.saveReport.mock.calls[0][2]
    expect(saved.workforce).toEqual({ superintendent: '', foremen: '', operators: '', laborers: '', flaggers: '' })
    expect(saved.safetyRemarks.siteCleaned).toBe('')
    expect(saved.comments).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Read-only when the parent IDR is submitted
// ---------------------------------------------------------------------------

describe('ACReportPage — read-only', () => {
  it('renders read-only with the submitted banner and no Save Draft', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted', submitted_at: SUBMITTED_AT }))
    renderPage()
    await loaded()
    expect(screen.getByText(SUBMITTED_TEXT)).toBeInTheDocument()
    expect(commentsBox()).toBeDisabled()
    expect(screen.getByRole('button', { name: /add item/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()
    expect(screen.getByTestId('attachments-section')).toHaveAttribute('data-submitted', 'true')
  })
})
