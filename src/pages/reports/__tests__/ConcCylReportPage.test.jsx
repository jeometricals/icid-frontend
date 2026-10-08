import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { format } from 'date-fns'
import ConcCylReportPage from '../ConcCylReportPage'
import * as api from '../../../services/api'
import { MOCK_CONTRACT_ITEMS } from '../../../test/contractItems'

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-cyl'
const PARENT_ID = 'rep-swcb'
const IDR_DATE = '2026-09-27'
const REPORT_URL = `/project/HWS0023/idr/${IDR_ID}/conc-cyl/${REPORT_ID}`
const SAVED_AT = '2026-09-25T14:05:00Z'
const SUBMITTED_AT = '2026-09-25T15:10:00Z'

const SAVED_DATA = {
  deliveryCasting: { dateOfDelivery: '2026-09-26', cyPoured: '12.5', dateCast: '2026-09-26', jobLocation: 'Main St' },
  sheetNo: '1',
  sheetOf: '2',
  cylinders: [{ class: '40', cylinderNo: 'A-1', slump: '4.5' }],
  placementLocation: 'Pier 3',
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
  getContractItems: vi.fn(),
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
  api.getContractItems.mockResolvedValue(MOCK_CONTRACT_ITEMS)
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
const addCylinder = () => screen.getByRole('button', { name: 'Add Cylinder' })
// One per cylinder row; the empty state has none
const cylinderRows = () => screen.queryAllByLabelText(/^Cylinder \d+ Cylinder #$/)

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

  it('shows Delivery & Casting, Cylinders and the instruction lines, with no lab, remarks or description section', async () => {
    renderPage()
    await loaded()
    const sections = ['Delivery & Casting', 'Cylinders']
    const headings = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(headings.filter(h => sections.includes(h))).toEqual(sections)
    expect(screen.getByText('Resident Engineer or Inspector to complete columns 1, 2, 3.')).toBeInTheDocument()
    for (const name of ['Testing Laboratory', 'Remarks', 'Description of Work Performed and Inspected']) {
      expect(screen.queryByRole('heading', { name })).not.toBeInTheDocument()
    }
    expect(screen.queryByLabelText('Laboratory Name')).not.toBeInTheDocument()
  })

  it('shows the project card, the day of week and an empty cylinder table on an empty payload', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {} }))
    renderPage()
    await loaded()
    expect(screen.getByText('Contract No:').parentElement).toHaveTextContent('HWS0023')
    expect(screen.getByText('Reg. No:').parentElement).toHaveTextContent('2024123457')
    expect(screen.getByText('Day of Week:').parentElement).toHaveTextContent('Day of Week: Sunday') // 2026-09-27
    expect(screen.getByLabelText('Date of Delivery')).toHaveValue('')
    expect(screen.getByLabelText('Sheet No.')).toHaveValue('')
    expect(screen.getByLabelText('Sheet No. of')).toHaveValue('')
    expect(screen.getByLabelText('Specific Location of Placement')).toHaveValue('')
    expect(cylinderRows()).toHaveLength(0)
    expect(screen.getByText('No cylinders added yet. Click Add Cylinder to record one.')).toBeInTheDocument()
  })

  it('fills every section from the saved report_data', async () => {
    renderPage()
    await loaded()
    expect(screen.getByLabelText('C.Y. Poured')).toHaveValue(12.5)
    expect(dateCast()).toHaveValue('2026-09-26')
    expect(screen.getByLabelText('Sheet No.')).toHaveValue('1')
    expect(screen.getByLabelText('Sheet No. of')).toHaveValue('2')
    expect(screen.getByLabelText('Cylinder 1 Cylinder #')).toHaveValue('A-1')
    expect(screen.getByLabelText('Specific Location of Placement')).toHaveValue('Pier 3')
  })

  it('loads partial or older shapes without crashing, leaving keys the page no longer shows as they were', async () => {
    const testingLab = { labName: 'Acme Labs', labAddress: '', labPhonePrimary: '', labPhoneAlt: '' }
    api.getIdr.mockResolvedValue(parentIdr({
      reportData: { testingLab, remarks: 'typed before', deliveryCasting: 'bad', cylinders: [{ class: '40' }] },
    }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    expect(screen.getByLabelText('Job Location')).toHaveValue('')
    expect(screen.getByLabelText('Cylinder 1 Class of Concrete')).toHaveValue('40')
    expect(screen.getByLabelText('Cylinder 1 Cylinder #')).toHaveValue('')
    await user.click(saveButton())

    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect(savedData().cylinders).toEqual([{ class: '40', cylinderNo: '', slump: '' }])
    expect(savedData().sheetNo).toBe('')
    expect(savedData().testingLab).toEqual(testingLab)
    expect(savedData().remarks).toBe('typed before')
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

describe('ConcCylReportPage — cylinders', () => {
  it('adds a row per Add Cylinder click', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    expect(cylinderRows()).toHaveLength(1)
    await user.click(addCylinder())
    expect(cylinderRows()).toHaveLength(2)
    expect(screen.getByLabelText('Cylinder 2 Cylinder #')).toHaveValue('')
  })

  it('turns Add Cylinder off at 18 rows', async () => {
    const seventeen = Array.from({ length: 17 }, (_, i) => ({ class: '40', cylinderNo: `A-${i + 1}`, slump: '4' }))
    api.getIdr.mockResolvedValue(parentIdr({ reportData: { ...SAVED_DATA, cylinders: seventeen } }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    expect(addCylinder()).toBeEnabled()
    await user.click(addCylinder())
    expect(cylinderRows()).toHaveLength(18)
    expect(addCylinder()).toBeDisabled()
    // Removing one frees a row again
    await user.click(screen.getByRole('button', { name: 'Remove cylinder 18' }))
    expect(cylinderRows()).toHaveLength(17)
    expect(addCylinder()).toBeEnabled()
  })

  it('removes a cylinder', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(addCylinder())
    expect(cylinderRows()).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Remove cylinder 1' }))
    expect(cylinderRows()).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Remove cylinder 1' }))
    expect(screen.getByText('No cylinders added yet. Click Add Cylinder to record one.')).toBeInTheDocument()
    await user.click(saveButton())
    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect(savedData().cylinders).toEqual([])
  })

  it('shows the lab columns as disabled placeholders', async () => {
    renderPage()
    await loaded()
    expect(screen.getByLabelText('Cylinder 1 PSI (filled by the lab)')).toBeDisabled()
    expect(screen.getByLabelText('Cylinder 1 Slump')).toBeEnabled()
  })
})

describe('ConcCylReportPage — cylinder ids', () => {
  // As a report reads after a submit and a return: the backend gave every cylinder an id
  const WITH_IDS = {
    ...SAVED_DATA,
    cylinders: [
      { id: 'cyl-aaa', class: '40', cylinderNo: 'A-1', slump: '4.5' },
      { id: 'cyl-bbb', class: '40', cylinderNo: 'A-2', slump: '4' },
      { id: 'cyl-ccc', class: '40', cylinderNo: 'A-3', slump: '4' },
    ],
  }

  it('sends every saved cylinder id back unchanged, and a new row without one', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: WITH_IDS }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.clear(screen.getByLabelText('Cylinder 1 Slump'))
    await user.type(screen.getByLabelText('Cylinder 1 Slump'), '5')
    await user.click(addCylinder())
    await user.type(screen.getByLabelText('Cylinder 4 Cylinder #'), 'A-4')
    await user.click(saveButton())

    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect(savedData().cylinders).toEqual([
      { id: 'cyl-aaa', class: '40', cylinderNo: 'A-1', slump: '5' },
      { id: 'cyl-bbb', class: '40', cylinderNo: 'A-2', slump: '4' },
      { id: 'cyl-ccc', class: '40', cylinderNo: 'A-3', slump: '4' },
      { class: '', cylinderNo: 'A-4', slump: '' },
    ])
    expect(savedData().cylinders[3]).not.toHaveProperty('id')
  })

  it('keeps the other ids on their own rows when a cylinder is removed', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: WITH_IDS }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Remove cylinder 2' }))
    await user.click(saveButton())

    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect(savedData().cylinders).toEqual([WITH_IDS.cylinders[0], WITH_IDS.cylinders[2]])
  })
})

describe('ConcCylReportPage — Save Draft', () => {
  it('saves everything filled in across the sections', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {} }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await waitFor(() => expect(dateCast()).toHaveValue(IDR_DATE))

    await user.type(screen.getByLabelText('Date of Delivery'), '2026-09-26')
    await user.type(screen.getByLabelText('C.Y. Poured'), '12.5')
    await user.type(screen.getByLabelText('Job Location'), 'Main St')
    await user.type(screen.getByLabelText('Sheet No.'), '1')
    await user.type(screen.getByLabelText('Sheet No. of'), '2')
    await user.click(addCylinder())
    await user.click(addCylinder())
    await user.type(screen.getByLabelText('Cylinder 1 Class of Concrete'), '40')
    await user.type(screen.getByLabelText('Cylinder 1 Cylinder #'), 'A-1')
    await user.type(screen.getByLabelText('Cylinder 1 Slump'), '4.5')
    await user.type(screen.getByLabelText('Cylinder 2 Cylinder #'), 'A-2')
    await user.type(screen.getByLabelText('Specific Location of Placement'), 'Pier 3')

    await user.click(saveButton())
    expect(await screen.findByText(`Saved at ${format(new Date(SAVED_AT), 'HH:mm')}`)).toBeInTheDocument()
    expect(api.saveReport).toHaveBeenCalledWith(IDR_ID, REPORT_ID, {
      deliveryCasting: { dateOfDelivery: '2026-09-26', cyPoured: '12.5', dateCast: IDR_DATE, jobLocation: 'Main St' },
      sheetNo: '1',
      sheetOf: '2',
      cylinders: [
        { class: '40', cylinderNo: 'A-1', slump: '4.5' },
        { class: '', cylinderNo: 'A-2', slump: '' },
      ],
      placementLocation: 'Pier 3',
    })
  })

  it('is read-only once the IDR is submitted', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted', submitted_at: SUBMITTED_AT }))
    renderPage()
    await loaded()
    expect(screen.getByLabelText('Sheet No.')).toBeDisabled()
    expect(screen.getByLabelText('Specific Location of Placement')).toBeDisabled()
    expect(dateCast()).toBeDisabled()
    expect(addCylinder()).toBeDisabled()
    expect(screen.getByLabelText('Cylinder 1 Slump')).toBeDisabled()
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()
  })
})
