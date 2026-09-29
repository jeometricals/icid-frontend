import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { format } from 'date-fns'
import ConcMixReportPage from '../ConcMixReportPage'
import * as api from '../../../services/api'

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-mix'
const PARENT_ID = 'rep-swcb'
const REPORT_URL = `/project/HWS0023/idr/${IDR_ID}/conc-mix/${REPORT_ID}`
const SAVED_AT = '2026-09-25T14:05:00Z'
const SUBMITTED_AT = '2026-09-25T15:10:00Z'

// The parent IDR as GET /v1/idrs/{id} returns it: an SWCB main report and this CONC_MIX addendum under it
function parentIdr({ reportData = { description: 'Curb pour, 12 CY' }, reportType = 'CONC_MIX', ...overrides } = {}) {
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
const loaded = () => screen.findByDisplayValue('Curb pour, 12 CY')

describe('ConcMixReportPage', () => {
  it('shows a spinner while the IDR loads', () => {
    api.getIdr.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows the title, the description subheading and the saved description', async () => {
    renderPage()
    expect(await loaded()).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Concrete Truck & Mix Info' })).toBeInTheDocument()
    expect(screen.getByText('Describe the concrete pour this report covers.')).toBeInTheDocument()
    expect(api.getIdr).toHaveBeenCalledWith(IDR_ID)
  })

  it('shows a load error when the report is another type', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportType: 'SWCB' }))
    renderPage()
    expect(await screen.findByText('This report is not a Concrete Truck & Mix Info report')).toBeInTheDocument()
  })

  it('shows the six placeholder cards in order', async () => {
    renderPage()
    await loaded()
    const titles = ['Location of Use', 'Mixer Type', 'Trucks', 'Concrete Specifications', 'Material Usage', 'Remarks']
    const headings = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(headings.filter(h => titles.includes(h))).toEqual(titles)
    for (const title of titles) {
      expect(screen.getByText(`${title} — coming in Chunk C1b.`)).toHaveClass('italic')
    }
  })

  it('has attachments but no Addendums section (an addendum cannot have addendums)', async () => {
    renderPage()
    await loaded()
    expect(screen.getByTestId('attachments-section')).toHaveAttribute('data-report', REPORT_ID)
    expect(screen.queryByRole('heading', { name: 'Addendums' })).not.toBeInTheDocument()
  })

  it('saves the whole form, including the blank body fields', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await loaded(), ' - north side')
    await user.click(saveButton())

    expect(await screen.findByText(`Saved at ${format(new Date(SAVED_AT), 'HH:mm')}`)).toBeInTheDocument()
    expect(api.saveReport).toHaveBeenCalledWith(IDR_ID, REPORT_ID, {
      description: 'Curb pour, 12 CY - north side',
      locationOfUse: {},
      mixerType: '',
      trucks: [],
      concreteSpecs: {},
      materialUsage: {},
      remarks: '',
    })
  })

  it('opens a never-edited addendum (empty report_data) as a blank form', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportData: {} }))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByPlaceholderText(/detailed description of work/i)).toHaveValue('')
    await user.click(saveButton())
    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect(api.saveReport.mock.calls[0][2].trucks).toEqual([])
  })

  it('is read-only once the IDR is submitted', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted', submitted_at: SUBMITTED_AT }))
    renderPage()
    expect(await loaded()).toBeDisabled()
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()
  })
})
