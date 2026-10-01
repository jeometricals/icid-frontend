import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { format } from 'date-fns'
import ConcMixReportPage from '../ConcMixReportPage'
import * as api from '../../../services/api'
import { MOCK_CONTRACT_ITEMS } from '../../../test/contractItems'

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-mix'
const PARENT_ID = 'rep-swcb'
const REPORT_URL = `/project/HWS0023/idr/${IDR_ID}/conc-mix/${REPORT_ID}`
const SAVED_AT = '2026-09-25T14:05:00Z'
const SUBMITTED_AT = '2026-09-25T15:10:00Z'

const SAVED_DATA = {
  locationOfUse: { curb: true, sidewalk: false, concreteBase: false, structural: false },
  mixerType: { type: 'other', otherLabel: 'Volumetric' },
  trucks: [{ truckOrTicketNo: 'T-101', inspectionSticker: 'Y', loadSizeCy: '10' }],
  concreteSpecs: { classOfConcrete: '40', slumpMin: '3', slumpMax: '5', airMin: '', airMax: '' },
  materialUsage: { batchReportNo: 'BR-9' },
  remarks: 'Poured north side',
}

// The parent IDR as GET /v1/idrs/{id} returns it: an SWCB main report and this CONC_MIX addendum under it
function parentIdr({ reportData = SAVED_DATA, reportType = 'CONC_MIX', ...overrides } = {}) {
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
    report_id: reportId, report_type: 'CONC_MIX', report_data: reportData, updated_at: SAVED_AT,
  }))
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[REPORT_URL]}>
      <Routes>
        <Route path="/project/:projectId/idr/:idrId/conc-mix/:reportId" element={<ConcMixReportPage />} />
      </Routes>
    </MemoryRouter>
  )
}

const saveButton = () => screen.getAllByRole('button', { name: /save draft|saving/i })[0]
const loaded = () => screen.findByRole('heading', { name: 'Concrete Truck & Mix Info' })
const savedData = () => api.saveReport.mock.calls[0][2]

const EMPTY_TRUCK = {
  truckOrTicketNo: '', inspectionSticker: null, loadSizeCy: '', endBatch: '', mixingRevs: '', startDischTime: '',
  endDischTime: '', slump: '', airContent: '', concTemp: '', cylinderNumbers: '',
}

describe('ConcMixReportPage — loading', () => {
  it('shows a spinner while the IDR loads', () => {
    api.getIdr.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows a load error when the report is another type', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportType: 'SWCB' }))
    renderPage()
    expect(await screen.findByText('This report is not a Concrete Truck & Mix Info report')).toBeInTheDocument()
  })

  it('has no Description of Work block', async () => {
    renderPage()
    await loaded()
    expect(screen.queryByRole('heading', { name: 'Description of Work Performed and Inspected' })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/detailed description of work/i)).not.toBeInTheDocument()
  })

  it('shows the six sections in DDC template order', async () => {
    renderPage()
    await loaded()
    const sections = ['Location of Use', 'Mixer Type', 'Trucks', 'Concrete Specifications', 'Material Usage', 'Remarks']
    const headings = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(headings.filter(h => sections.includes(h))).toEqual(sections)
    expect(screen.queryByText(/coming in Chunk C1b/)).not.toBeInTheDocument()
  })

  it('fills every section from the saved report_data', async () => {
    renderPage()
    await loaded()
    expect(screen.getByRole('checkbox', { name: 'Curb' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Sidewalk' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Other' })).toBeChecked()
    expect(screen.getByLabelText('Other mixer type')).toHaveValue('Volumetric')
    expect(screen.getByLabelText('Truck 1 Truck or Ticket No')).toHaveValue('T-101')
    expect(screen.getByRole('radio', { name: 'Truck 1 Inspection Sticker: Y' })).toBeChecked()
    expect(screen.getByLabelText('Truck 1 Load Size C.Y.')).toHaveValue(10)
    expect(screen.getByLabelText('Class of Concrete')).toHaveValue('40')
    expect(screen.getByLabelText('Slump Max')).toHaveValue(5)
    expect(screen.getByLabelText('Batch Report No')).toHaveValue('BR-9')
    expect(screen.getByDisplayValue('Poured north side')).toBeInTheDocument()
  })

  it('loads a report saved by the placeholder page (old shapes) as a clean blank form', async () => {
    api.getIdr.mockResolvedValue(parentIdr({
      reportData: { description: 'typed on the placeholder page', locationOfUse: {}, mixerType: '', trucks: [],
        concreteSpecs: {}, materialUsage: {}, remarks: '' },
    }))
    const user = userEvent.setup()
    renderPage()
    await loaded()
    expect(screen.getByRole('radio', { name: 'Ready Mix' })).not.toBeChecked()
    expect(screen.getByLabelText('Class of Concrete')).toHaveValue('')
    await user.click(saveButton())

    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect(savedData().mixerType).toEqual({ type: '', otherLabel: '' })
    expect(savedData().locationOfUse).toEqual({ curb: false, sidewalk: false, concreteBase: false, structural: false })
    expect(savedData().materialUsage.quantityWasted).toBe('')
    // The placeholder page's description is kept in the data, not deleted
    expect(savedData().description).toBe('typed on the placeholder page')
  })

  it('has attachments but no Addendums section (an addendum cannot have addendums)', async () => {
    renderPage()
    await loaded()
    expect(screen.getByTestId('attachments-section')).toHaveAttribute('data-report', REPORT_ID)
    expect(screen.queryByRole('heading', { name: 'Addendums' })).not.toBeInTheDocument()
  })
})

describe('ConcMixReportPage — Save Draft', () => {
  it('saves everything filled in across the six sections', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {} }))
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByRole('checkbox', { name: 'Curb' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sidewalk' }))
    await user.click(screen.getByRole('radio', { name: 'Ready Mix' }))

    await user.click(screen.getByRole('button', { name: 'Add Truck' }))
    await user.click(screen.getByRole('button', { name: 'Add Truck' }))
    await user.type(screen.getByLabelText('Truck 1 Truck or Ticket No'), 'T-101')
    await user.click(screen.getByRole('radio', { name: 'Truck 1 Inspection Sticker: Y' }))
    await user.type(screen.getByLabelText('Truck 1 Load Size C.Y.'), '10')
    await user.type(screen.getByLabelText('Truck 1 Start Disch. Time'), '10:45 AM')
    await user.type(screen.getByLabelText('Truck 2 Truck or Ticket No'), 'T-102')
    await user.click(screen.getByRole('radio', { name: 'Truck 2 Inspection Sticker: N/A' }))
    await user.type(screen.getByLabelText('Truck 2 Slump'), '4.5')

    await user.type(screen.getByLabelText('Class of Concrete'), '40')
    await user.type(screen.getByLabelText('Slump Min'), '3')
    await user.type(screen.getByLabelText('Slump Max'), '5')
    await user.type(screen.getByLabelText('Air Min'), '5')
    await user.type(screen.getByLabelText('Air Max'), '8')

    await user.type(screen.getByLabelText('Batch Report No'), 'BR-9')
    await user.type(screen.getByLabelText('Quantity Used'), '19.5')

    await user.type(screen.getByPlaceholderText(/additional comments/i), 'Poured north side')

    await user.click(saveButton())
    expect(await screen.findByText(`Saved at ${format(new Date(SAVED_AT), 'HH:mm')}`)).toBeInTheDocument()

    expect(api.saveReport).toHaveBeenCalledWith(IDR_ID, REPORT_ID, {
      locationOfUse: { curb: true, sidewalk: true, concreteBase: false, structural: false },
      mixerType: { type: 'readyMix', otherLabel: '' },
      trucks: [
        { ...EMPTY_TRUCK, truckOrTicketNo: 'T-101', inspectionSticker: 'Y', loadSizeCy: '10', startDischTime: '10:45 AM' },
        { ...EMPTY_TRUCK, truckOrTicketNo: 'T-102', inspectionSticker: 'NA', slump: '4.5' },
      ],
      concreteSpecs: { classOfConcrete: '40', slumpMin: '3', slumpMax: '5', airMin: '5', airMax: '8' },
      materialUsage: {
        batchReportNo: 'BR-9', noOfTickets: '', firstTicketNo: '', lastTicketNo: '', quantityDispatched: '',
        quantityReceived: '', quantityUsed: '19.5', quantityWasted: '',
      },
      remarks: 'Poured north side',
    })
  })

  it('removes a truck', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Remove truck 1' }))
    expect(screen.getByText("No trucks yet. Click 'Add Truck' to begin.")).toBeInTheDocument()
    await user.click(saveButton())
    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect(savedData().trucks).toEqual([])
  })

  it('is read-only once the IDR is submitted', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted', submitted_at: SUBMITTED_AT }))
    renderPage()
    await loaded()
    expect(screen.getByRole('checkbox', { name: 'Curb' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add Truck' })).toBeDisabled()
    expect(screen.getByLabelText('Truck 1 Truck or Ticket No')).toBeDisabled()
    expect(screen.getByLabelText('Class of Concrete')).toBeDisabled()
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()
  })
})
