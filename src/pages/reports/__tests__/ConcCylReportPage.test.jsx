import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { format } from 'date-fns'
import ConcCylReportPage from '../ConcCylReportPage'
import * as api from '../../../services/api'

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-cyl'
const PARENT_ID = 'rep-swcb'
const IDR_DATE = '2026-09-27'
const REPORT_URL = `/project/HWS0023/idr/${IDR_ID}/conc-cyl/${REPORT_ID}`
const SAVED_AT = '2026-09-25T14:05:00Z'
const SUBMITTED_AT = '2026-09-25T15:10:00Z'

const SAVED_DATA = {
  testingLab: { labName: 'Acme Labs', labAddress: '1 Main St', labPhonePrimary: '555-0100', labPhoneAlt: '' },
  deliveryCasting: { dateOfDelivery: '2026-09-26', cyPoured: '12.5', dateCast: '2026-09-26', jobLocation: 'Main St' },
  cylinders: [{ class: '40', cylinderNo: 'A-1', slump: '4.5' }],
  placementLocation: 'Pier 3',
  remarks: 'Four cylinders taken',
}

// The parent IDR as GET /v1/idrs/{id} returns it: an SWCB main report and this CONC_CYL addendum under it
function parentIdr({ reportData = SAVED_DATA, reportType = 'CONC_CYL', ...overrides } = {}) {
  return {
    idr_id: IDR_ID,
    project_id: 'HWS0023',
    report_date: IDR_DATE,
    work_start_time: '07:30:00',
    work_end_time: '16:00:00',
    temp_low: 42.0,
    temp_high: 61.0,
    weather_am: 'Clear',
    weather_pm: 'Cloudy',
    status: 'draft',
    submitted_at: null,
    total_pages: null,
    reports: [
      { report_id: PARENT_ID, idr_id: IDR_ID, report_type: 'SWCB', is_addendum: false, parent_report_id: null,
        page_number: null, report_data: {} },
      { report_id: REPORT_ID, idr_id: IDR_ID, report_type: reportType, is_addendum: true, parent_report_id: PARENT_ID,
        page_number: null, report_data: reportData },
    ],
    ...overrides,
  }
}

const PROJECT = {
  project_id: 'HWS0023',
  project_description: 'Installation of Curb, Sidewalk and Ped-Ramp',
  registration_code: '2024123457',
  borough: 'Queens',
}

vi.mock('../../../services/api', () => ({
  getIdr: vi.fn(),
  getProjectById: vi.fn(),
  saveReport: vi.fn(),
}))

vi.mock('../../../components/AttachmentsSection', () => ({
  default: (props) => <div data-testid="attachments-section" data-report={props.reportId} />,
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.getIdr.mockResolvedValue(parentIdr())
  api.getProjectById.mockResolvedValue(PROJECT)
  api.saveReport.mockImplementation(async (_, reportId, reportData) => ({
    report_id: reportId, report_type: 'CONC_CYL', report_data: reportData, updated_at: SAVED_AT,
  }))
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[REPORT_URL]}>
      <Routes>
        <Route path="/project/:projectId/idr/:idrId/conc-cyl/:reportId" element={<ConcCylReportPage />} />
      </Routes>
    </MemoryRouter>
  )
}

const saveButton = () => screen.getAllByRole('button', { name: /save draft|saving/i })[0]
const loaded = () => screen.findByRole('heading', { name: 'Concrete Cylinder Data' })
const dateCast = () => screen.getByLabelText('Date Cast')
const savedData = () => api.saveReport.mock.calls[0][2]

describe('ConcCylReportPage — loading', () => {
  it('shows a spinner while the IDR loads', () => {
    api.getIdr.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows a load error when the report is another type', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportType: 'CONC_MIX' }))
    renderPage()
    expect(await screen.findByText('This report is not a Concrete Cylinder Data report')).toBeInTheDocument()
  })

  it('shows the five sections in template order, with no Description of Work', async () => {
    renderPage()
    await loaded()
    const sections = ['Testing Laboratory', 'Delivery & Casting', 'Cylinders', 'Specific Location of Placement', 'Remarks']
    const headings = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(headings.filter(h => sections.includes(h))).toEqual(sections)
    expect(screen.queryByRole('heading', { name: 'Description of Work Performed and Inspected' })).not.toBeInTheDocument()
  })

  it('fills every section from the saved report_data', async () => {
    renderPage()
    await loaded()
    expect(screen.getByLabelText('Laboratory Name')).toHaveValue('Acme Labs')
    expect(screen.getByLabelText('C.Y. Poured')).toHaveValue(12.5)
    expect(dateCast()).toHaveValue('2026-09-26')
    expect(screen.getByLabelText('Cylinder 1 Cylinder #')).toHaveValue('A-1')
    expect(screen.getByLabelText('Specific Location of Placement')).toHaveValue('Pier 3')
    expect(screen.getByDisplayValue('Four cylinders taken')).toBeInTheDocument()
  })

  it('loads partial or placeholder-era shapes without crashing, keeping any old description', async () => {
    api.getIdr.mockResolvedValue(parentIdr({
      reportData: { description: 'typed before', testingLab: {}, deliveryCasting: 'bad', cylinders: [{ class: '40' }] },
    }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    expect(screen.getByLabelText('Laboratory Name')).toHaveValue('')
    expect(screen.getByLabelText('Cylinder 1 Class of Concrete')).toHaveValue('40')
    expect(screen.getByLabelText('Cylinder 1 Cylinder #')).toHaveValue('')
    await user.click(saveButton())

    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect(savedData().testingLab).toEqual({ labName: '', labAddress: '', labPhonePrimary: '', labPhoneAlt: '' })
    expect(savedData().cylinders).toEqual([{ class: '40', cylinderNo: '', slump: '' }])
    expect(savedData().description).toBe('typed before')
  })

  it('has attachments but no Addendums section', async () => {
    renderPage()
    await loaded()
    expect(screen.getByTestId('attachments-section')).toHaveAttribute('data-report', REPORT_ID)
    expect(screen.queryByRole('heading', { name: 'Addendums' })).not.toBeInTheDocument()
  })
})

describe('ConcCylReportPage — Date Cast auto-fill', () => {
  it('fills Date Cast with the IDR date on a never-saved report', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {} }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await waitFor(() => expect(dateCast()).toHaveValue(IDR_DATE))
    // The fill is an edit, so it is saved like one
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    await user.click(saveButton())
    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect(savedData().deliveryCasting.dateCast).toBe(IDR_DATE)
  })

  it('does not overwrite a saved Date Cast', async () => {
    renderPage()
    await loaded()
    expect(dateCast()).toHaveValue('2026-09-26')
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('does not re-fill after the inspector clears it', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {} }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await waitFor(() => expect(dateCast()).toHaveValue(IDR_DATE))
    await user.clear(dateCast())
    await user.type(screen.getByLabelText('Job Location'), 'x') // another edit re-renders the page
    expect(dateCast()).toHaveValue('')
  })

  it('leaves a Date Cast that was cleared and saved blank on a later visit', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: { deliveryCasting: { dateCast: '' } } }))
    renderPage()
    await loaded()
    expect(dateCast()).toHaveValue('')
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
  })

  it('does nothing on a submitted IDR', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {}, status: 'submitted', submitted_at: SUBMITTED_AT }))
    renderPage()
    await loaded()
    expect(dateCast()).toHaveValue('')
  })
})

describe('ConcCylReportPage — Save Draft', () => {
  it('saves everything filled in across the five sections', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {} }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await waitFor(() => expect(dateCast()).toHaveValue(IDR_DATE))

    await user.type(screen.getByLabelText('Laboratory Name'), 'Acme Labs')
    await user.type(screen.getByLabelText('Address'), '1 Main St')
    await user.type(screen.getByLabelText('Phone'), '555-0100')
    await user.type(screen.getByLabelText('Date of Delivery'), '2026-09-26')
    await user.type(screen.getByLabelText('C.Y. Poured'), '12.5')
    await user.type(screen.getByLabelText('Job Location'), 'Main St')
    await user.click(screen.getByRole('button', { name: 'Add Cylinder' }))
    await user.click(screen.getByRole('button', { name: 'Add Cylinder' }))
    await user.type(screen.getByLabelText('Cylinder 1 Class of Concrete'), '40')
    await user.type(screen.getByLabelText('Cylinder 1 Cylinder #'), 'A-1')
    await user.type(screen.getByLabelText('Cylinder 1 Slump'), '4.5')
    await user.type(screen.getByLabelText('Cylinder 2 Cylinder #'), 'A-2')
    await user.type(screen.getByLabelText('Specific Location of Placement'), 'Pier 3')
    await user.type(screen.getByPlaceholderText(/additional comments/i), 'Four cylinders taken')

    await user.click(saveButton())
    expect(await screen.findByText(`Saved at ${format(new Date(SAVED_AT), 'HH:mm')}`)).toBeInTheDocument()
    expect(api.saveReport).toHaveBeenCalledWith(IDR_ID, REPORT_ID, {
      testingLab: { labName: 'Acme Labs', labAddress: '1 Main St', labPhonePrimary: '555-0100', labPhoneAlt: '' },
      deliveryCasting: { dateOfDelivery: '2026-09-26', cyPoured: '12.5', dateCast: IDR_DATE, jobLocation: 'Main St' },
      cylinders: [
        { class: '40', cylinderNo: 'A-1', slump: '4.5' },
        { class: '', cylinderNo: 'A-2', slump: '' },
      ],
      placementLocation: 'Pier 3',
      remarks: 'Four cylinders taken',
    })
  })

  it('removes a cylinder', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Remove cylinder 1' }))
    expect(screen.getByText('No cylinders added yet. Click Add Cylinder to record one.')).toBeInTheDocument()
    await user.click(saveButton())
    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect(savedData().cylinders).toEqual([])
  })

  it('is read-only once the IDR is submitted', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted', submitted_at: SUBMITTED_AT }))
    renderPage()
    await loaded()
    expect(screen.getByLabelText('Laboratory Name')).toBeDisabled()
    expect(dateCast()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add Cylinder' })).toBeDisabled()
    expect(screen.getByLabelText('Cylinder 1 Slump')).toBeDisabled()
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()
  })
})
