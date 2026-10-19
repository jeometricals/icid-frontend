import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DSPReportPage from '../DSPReportPage'
import * as api from '../../../services/api'
import { MOCK_CONTRACT_ITEMS } from '../../../test/contractItems'
import { FIELD_ORDER_NUMBER_REQUIRED, emptyDspData } from '../../../data/dspForm'
import { NO_DETAILS_WARNING } from '../../../components/reports/DspChecklistSection'
import { SHEET_ASSIGNED_AT_EXPORT } from '../../../components/reports/DspPatrolMetadata'

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-dsp'
const IDR_DATE = '2026-09-30' // a Wednesday
const REPORT_URL = `/project/HWS0023/idr/${IDR_ID}/dsp/${REPORT_ID}`
const SAVED_AT = '2026-09-30T14:05:00Z'

// The parent IDR as GET /v1/idrs/{id} returns it, with this DSP as a main report
function parentIdr({ reportData = {}, reportType = 'DSP', ...overrides } = {}) {
  return {
    idr_id: IDR_ID,
    project_id: 'HWS0023',
    report_date: IDR_DATE,
    idr_number: null,
    status: 'draft',
    submitted_at: null,
    total_pages: null,
    reports: [
      { report_id: REPORT_ID, idr_id: IDR_ID, report_type: reportType, is_addendum: false, parent_report_id: null,
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
    report_id: reportId, report_type: 'DSP', report_data: reportData, updated_at: SAVED_AT,
  }))
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[REPORT_URL]}>
      <Routes>
        <Route path="/project/:projectId/idr/:idrId/dsp/:reportId" element={<DSPReportPage />} />
      </Routes>
    </MemoryRouter>
  )
}

const saveButton = () => screen.getAllByRole('button', { name: /save draft|saving/i })[0]
const loaded = () => screen.findByRole('heading', { name: 'Daily Site Patrol' })
const savedData = () => api.saveReport.mock.calls[0][2]
const radio = (question, answer) => screen.getByRole('radio', { name: `${question} ${answer}` })
const TRENCHES = 'Are all open trenches plated or fully enclosed with adequate fencing ?'

describe('DSPReportPage — loading', () => {
  it('shows a load error when the report is another type', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ reportType: 'CONC_CYL' }))
    renderPage()
    expect(await screen.findByText('This report is not a Daily Site Patrol report')).toBeInTheDocument()
  })

  it('shows the patrol card read-only, then both checklists and the field order', async () => {
    renderPage()
    await loaded()
    const headings = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(headings.slice(0, 4)).toEqual(['Patrol', 'Maintenance of Site', 'Maintenance and Protection of Traffic',
      'Field Order'])
    expect(screen.getByText('Day of Week').nextSibling).toHaveTextContent('Wednesday')
    expect(screen.getByText('Date').nextSibling).toHaveTextContent('09/30/2026')
    expect(screen.getByText('I.R. No.').nextSibling).toHaveTextContent('—')
    expect(screen.getByText('Sheet No.').nextSibling).toHaveTextContent(SHEET_ASSIGNED_AT_EXPORT)
    expect(screen.getByLabelText('Time of Patrol')).toHaveValue('')
  })

  it('shows the IDR number once it has one', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ idr_number: '005' }))
    renderPage()
    await loaded()
    expect(screen.getByText('I.R. No.').nextSibling).toHaveTextContent('005')
  })

  it('has a Yes / No / N/A row for each of the 22 questions, nothing chosen on a new report', async () => {
    renderPage()
    await loaded()
    expect(screen.getAllByRole('radio', { name: / Yes$/ })).toHaveLength(22)
    expect(screen.getAllByRole('radio').filter(r => r.checked)).toHaveLength(1) // Field Order Issued? No
  })
})

describe('DSPReportPage — editing and saving', () => {
  it('saves the whole form, the backend shape', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(radio(TRENCHES, 'No'))
    await user.type(screen.getByLabelText(`${TRENCHES} Details`), 'Plates missing')
    await user.click(saveButton())
    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    const expected = emptyDspData()
    expected.mosChecklist[1] = { item: 'open_trenches_plated_fenced', answer: 'no', details: 'Plates missing' }
    expect(savedData()).toEqual(expected)
  })

  it('takes the time of patrol', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.type(screen.getByLabelText('Time of Patrol'), '14:30')
    await user.click(saveButton())
    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect(savedData().timeOfPatrol).toBe('14:30')
  })

  it('warns on a No without details, and still saves', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    expect(screen.queryByText(NO_DETAILS_WARNING)).not.toBeInTheDocument()
    await user.click(radio(TRENCHES, 'No'))
    expect(screen.getByText(NO_DETAILS_WARNING)).toBeInTheDocument()
    await user.click(saveButton())
    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    await user.type(screen.getByLabelText(`${TRENCHES} Details`), 'x')
    expect(screen.queryByText(NO_DETAILS_WARNING)).not.toBeInTheDocument()
  })

  it('blocks a save with a field order issued but no number, until one is typed', async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded()
    await user.click(screen.getByRole('radio', { name: 'Yes', exact: true }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(saveButton())
    expect(await screen.findByText(FIELD_ORDER_NUMBER_REQUIRED)).toBeInTheDocument()
    expect(api.saveReport).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Field Order No.'), 'FO-12')
    expect(screen.queryByText(FIELD_ORDER_NUMBER_REQUIRED)).not.toBeInTheDocument()
    await user.click(saveButton())
    await waitFor(() => expect(api.saveReport).toHaveBeenCalled())
    expect([savedData().fieldOrderIssued, savedData().fieldOrderNumber]).toEqual([true, 'FO-12'])
  })

  it('loads a saved report', async () => {
    const saved = emptyDspData()
    saved.timeOfPatrol = '09:15'
    saved.mptChecklist[0] = { item: 'traffic_maintained_per_plan', answer: 'na', details: null }
    saved.fieldOrderIssued = true
    saved.fieldOrderNumber = 'FO-7'
    api.getIdr.mockResolvedValue(parentIdr({ reportData: saved }))
    renderPage()
    await loaded()
    expect(screen.getByLabelText('Time of Patrol')).toHaveValue('09:15')
    expect(radio('Is traffic maintained in accordance with approved traffic plan / stipulations ?', 'N/A')).toBeChecked()
    expect(screen.getByLabelText('Field Order No.')).toHaveValue('FO-7')
  })
})

describe('DSPReportPage — read-only', () => {
  it('disables every input once the IDR is submitted', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted', submitted_at: SAVED_AT }))
    renderPage()
    await loaded()
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
    expect(screen.getByLabelText('Time of Patrol')).toBeDisabled()
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()
  })
})
