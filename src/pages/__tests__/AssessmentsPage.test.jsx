import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AssessmentsPage from '../AssessmentsPage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { TEST_USER } from '../../test/users'

vi.mock('../../services/api', () => ({
  getAssessmentSites: vi.fn(), downloadAssessmentSummary: vi.fn(), downloadTailoredAssessmentSummary: vi.fn(),
  downloadConstructionReport: vi.fn(),
  listPedRampInspections: vi.fn(), bulkDownloadPedRampInspections: vi.fn(), downloadInspectionDotForms: vi.fn(),
  listUsers: vi.fn(), downloadFile: vi.fn(), LISTING_PAGE_SIZE: 30, listTaskOrders: vi.fn(),
}))

const TASK_ORDERS = [{ id: 't0000000-0000-4000-8000-000000000001', task_order_number: 'TO-001' },
  { id: 't0000000-0000-4000-8000-000000000002', task_order_number: 'TO-002' }]

const MAIN = 'a0000000-0000-4000-8000-000000000001'
const ELM = 'a0000000-0000-4000-8000-000000000002'
const OAK = 'a0000000-0000-4000-8000-000000000003'

// A site as the backend sends it: no 7" work and no remarks unless a test says otherwise
const site = (property_id, display_address, extra = {}) => ({
  property_id, kind: 'sidewalk', display_address, block: null, lot: null, violation_no: null, community_board: null,
  four_assessable: 0, four_non_assessable: 0, four_total: 0, four_amount: 0,
  seven_assessable: 0, seven_non_assessable: 0, seven_total: 0, seven_amount: 0, grand_total: 0,
  remarks: [], used_approval_date: false, ...extra,
})

const SITES = [
  site(MAIN, '138-22 227 STREET', {
    block: '13140', lot: '49', violation_no: 'V-100', community_board: 'QN12',
    four_assessable: 113.19, four_non_assessable: 137.75, four_total: 250.94, four_amount: 1306.21,
    seven_assessable: 94.14, seven_non_assessable: 77.67, seven_total: 171.81, seven_amount: 1189.93, grand_total: 2496.14,
  }),
  site(ELM, '350 Main St, Brooklyn', {
    block: '1234', lot: '51', community_board: 'BK10', four_assessable: 180, four_total: 180, four_amount: 2077.2,
    seven_assessable: 45, seven_total: 45, seven_amount: 568.8, grand_total: 2646, remarks: ['7" rate not set'],
  }),
  site(OAK, '40 Oak Ave', { block: '555', lot: '7', four_assessable: 10, four_total: 10, four_amount: 115.4, grand_total: 115.4 }),
]
const FOUND = {
  range: { from: null, to: null }, cost_per_sf_4in: 11.54, cost_per_sf_7in: 12.64, sites: SITES,
  totals: {},
}

function PageWithUrl() {
  const location = useLocation()
  return (
    <>
      <div data-testid="page-url">{location.search}</div>
      <AssessmentsPage />
    </>
  )
}

function CurrentUrl() {
  const location = useLocation()
  return <div data-testid="url">{location.pathname + location.search}</div>
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/project/HWS0023/assessments${search}`]}>
      <Routes>
        <Route path="/project/:projectId/assessments" element={<PageWithUrl />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

const url = () => screen.getByTestId('page-url').textContent
const tabs = () => screen.getAllByRole('tab')
const table = () => screen.findByRole('table', { name: 'Constructed sites' })
const bodyRows = () => within(screen.getByRole('table', { name: 'Constructed sites' })).getAllByRole('row').slice(1, -1)
const addresses = () => bodyRows().map(tr => within(tr).getByRole('link').textContent)
const totalsRow = () => within(screen.getByRole('table', { name: 'Constructed sites' })).getAllByRole('row').at(-1)
const cells = tr => within(tr).getAllByRole('cell').map(td => td.textContent)
const lastCall = () => api.getAssessmentSites.mock.calls.at(-1)

beforeEach(() => {
  vi.clearAllMocks()
  api.getAssessmentSites.mockResolvedValue(FOUND)
  api.listPedRampInspections.mockResolvedValue({ total: 0, page: 1, page_size: 30, rows: [] })
  api.listUsers.mockResolvedValue([])
  api.listTaskOrders.mockResolvedValue(TASK_ORDERS)
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: TEST_USER })
})

describe('AssessmentsPage — the tabs', () => {
  it('opens on the Sidewalk Assessment Summary, with the pedramp report beside it', async () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'As-Builts & Assessments — HWS0023' })).toBeInTheDocument()
    expect(tabs().map(tab => tab.textContent)).toEqual(['Sidewalk Assessment Summary', 'Pedramp Inspection Reports'])
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Sidewalk Assessment Summary')
    await table()
  })

  it('shows the pedramp inspection reports on their tab, and puts the tab in the URL', async () => {
    renderPage()
    await table()
    await userEvent.click(screen.getByRole('tab', { name: 'Pedramp Inspection Reports' }))
    expect(url()).toBe('?tab=ped-ramp')
    expect(await screen.findByText('No corner has an inspection yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(api.listPedRampInspections).toHaveBeenCalledWith('HWS0023', expect.objectContaining({ page: 1 }))
    await userEvent.click(screen.getByRole('tab', { name: 'Sidewalk Assessment Summary' }))
    expect(url()).toBe('')
  })

  it('opens the tab a link names, and the first for an unknown one', async () => {
    const linked = renderPage('?tab=ped-ramp')
    expect(screen.getByRole('tab', { name: 'Pedramp Inspection Reports' })).toHaveAttribute('aria-selected', 'true')
    expect(api.getAssessmentSites).not.toHaveBeenCalled()
    linked.unmount()
    renderPage('?tab=nope')
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true')
    await table()
  })

  it('goes back to Progress and Assessments', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Progress and Assessments' }))
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/project\/HWS0023\/progress$/)
  })
})

describe('AssessmentsPage — the Sidewalk Assessment Summary table', () => {
  it('asks for every date to start, and lists a row per site with the workbook\'s columns, CB and its report', async () => {
    renderPage()
    await table()
    expect(lastCall()).toEqual(['HWS0023', { from: '', to: '' }])
    expect(screen.getAllByRole('columnheader').map(th => th.textContent)).toEqual([
      'Property Address', 'CB', '4" Assessable (SF)', '4" Non-Assessable (SF)', '4" Total (SF)', '4" Amount ($)',
      '7" Assessable (SF)', '7" Non-Assessable (SF)', '7" Total (SF)', '7" Amount ($)', 'Grand Total ($)', 'Remarks',
      'Construction Report',
    ])
    expect(cells(bodyRows()[0])).toEqual([
      '138-22 227 STREETBlock 13140 Lot 49 · V-100', 'QN12', '113.19', '137.75', '250.94', '$1,306.21', '94.14', '77.67',
      '171.81', '$1,189.93', '$2,496.14', '—', 'PDF',
    ])
    expect(cells(bodyRows()[1]).slice(1, 4)).toEqual(['BK10', '180.00', '—'])
    expect(cells(bodyRows()[1])[11]).toBe('7" rate not set')
    expect(screen.getByText('3 sites')).toBeInTheDocument()
  })

  it('totals the rows shown', async () => {
    renderPage()
    await table()
    expect(within(totalsRow()).getByRole('rowheader')).toHaveTextContent('Totals')
    expect(cells(totalsRow()).slice(1, 10)).toEqual([
      '303.19', '137.75', '440.94', '$3,498.81', '139.14', '77.67', '216.81', '$1,758.73', '$5,257.54',
    ])
  })

  it('links each address to its site\'s page', async () => {
    renderPage()
    await table()
    expect(screen.getByRole('link', { name: '350 Main St, Brooklyn' })).toHaveAttribute('href', `/project/HWS0023/properties/${ELM}`)
  })

  it('downloads a site\'s Construction Report from its row', async () => {
    api.downloadConstructionReport.mockResolvedValue('report.pdf')
    renderPage()
    await table()
    await userEvent.click(within(bodyRows()[1]).getByRole('button', { name: 'PDF' }))
    expect(api.downloadConstructionReport).toHaveBeenCalledWith(ELM)
  })

  it('reads a dash for an amount whose rate isn\'t set', async () => {
    api.getAssessmentSites.mockResolvedValue({ ...FOUND, sites: [{ ...SITES[2], four_amount: null, grand_total: null }] })
    renderPage()
    await table()
    expect(cells(bodyRows()[0]).slice(5, 6)).toEqual(['—'])
    expect(cells(totalsRow())[4]).toBe('—')
  })

  it('says so when nothing has been constructed yet', async () => {
    api.getAssessmentSites.mockResolvedValue({ ...FOUND, sites: [] })
    renderPage()
    expect(await screen.findByText('No constructed sites yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download tailored report' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Download accumulative report' })).toBeEnabled()
  })

  it('shows a failed read with Retry', async () => {
    api.getAssessmentSites.mockRejectedValueOnce(new Error('Project access required'))
    renderPage()
    expect(await screen.findByText("Couldn't load the constructed sites: Project access required")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await table()
  })
})

describe('AssessmentsPage — the period and the search', () => {
  it('asks the backend again for a date-constructed period, kept in the URL', async () => {
    renderPage()
    await table()
    fireEvent.change(screen.getByLabelText('Constructed from'), { target: { value: '2026-10-01' } })
    await waitFor(() => expect(lastCall()).toEqual(['HWS0023', { from: '2026-10-01', to: '' }]))
    fireEvent.change(screen.getByLabelText('Constructed to'), { target: { value: '2026-10-31' } })
    await waitFor(() => expect(lastCall()).toEqual(['HWS0023', { from: '2026-10-01', to: '2026-10-31' }]))
    expect(url()).toBe('?from=2026-10-01&to=2026-10-31')
  })

  it('a linked period sets the pickers and the first request, and an empty one says so', async () => {
    api.getAssessmentSites.mockResolvedValue({ ...FOUND, sites: [] })
    renderPage('?from=2026-09-01&to=2026-09-30')
    expect(await screen.findByText('No sites were constructed in this period.')).toBeInTheDocument()
    expect(screen.getByLabelText('Constructed from')).toHaveValue('2026-09-01')
    expect(api.getAssessmentSites).toHaveBeenCalledTimes(1)
  })

  it('From after To shows a hint and asks nothing', async () => {
    renderPage('?from=2026-10-10&to=2026-10-01')
    expect(await screen.findByRole('alert')).toHaveTextContent("From can't be after To.")
    expect(api.getAssessmentSites).not.toHaveBeenCalled()
  })

  it.each([
    ['an address', 'main st', ['350 Main St, Brooklyn']],
    ['a block', '13140', ['138-22 227 STREET']],
    ['a block and lot', '1234/51', ['350 Main St, Brooklyn']],
    ['a block and lot spaced', '555 7', ['40 Oak Ave']],
    ['a violation', 'v-100', ['138-22 227 STREET']],
  ])('narrows the rows by %s, without asking the backend', async (_, text, expected) => {
    renderPage()
    await table()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), text)
    expect(addresses()).toEqual(expected)
    expect(screen.getByText(`1 site of 3`)).toBeInTheDocument()
    expect(api.getAssessmentSites).toHaveBeenCalledTimes(1)
  })

  it('totals only the rows the search leaves', async () => {
    renderPage('?q=oak')
    await table()
    expect(cells(totalsRow())[1]).toBe('10.00')
    expect(cells(totalsRow())[9]).toBe('$115.40')
  })

  it('says when the search matches nothing', async () => {
    renderPage('?q=nowhere')
    expect(await screen.findByText('No constructed sites match "nowhere".')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download tailored report' })).toBeDisabled()
  })
})

// Open a download's menu and pick a format
async function pick(label, format) {
  await userEvent.click(screen.getByRole('button', { name: label }))
  await userEvent.click(within(screen.getByRole('menu', { name: label })).getByRole('menuitem', { name: format }))
}

describe('AssessmentsPage — the downloads', () => {
  it('the tailored report is the period, and every site when nothing is searched', async () => {
    api.downloadTailoredAssessmentSummary.mockResolvedValue('t.xlsx')
    renderPage('?from=2026-10-01')
    await table()
    await pick('Download tailored report', 'XLSX')
    expect(api.downloadTailoredAssessmentSummary).toHaveBeenCalledWith('HWS0023', {
      from: '2026-10-01', to: '', format: 'xlsx', taskOrderId: undefined, propertyIds: undefined })
  })

  it('the tailored report is the rows the search shows', async () => {
    api.downloadTailoredAssessmentSummary.mockResolvedValue('t.xlsx')
    renderPage('?q=main')
    await table()
    await pick('Download tailored report', 'XLSX')
    expect(api.downloadTailoredAssessmentSummary).toHaveBeenCalledWith('HWS0023', {
      from: '', to: '', format: 'xlsx', taskOrderId: undefined, propertyIds: [ELM] })
  })

  it('the accumulative report is the whole project\'s workbook, whatever the period and search', async () => {
    api.downloadAssessmentSummary.mockResolvedValue('a.xlsx')
    renderPage('?from=2026-10-01&q=main')
    await table()
    await pick('Download accumulative report', 'XLSX')
    expect(api.downloadAssessmentSummary).toHaveBeenCalledWith('HWS0023', { format: 'xlsx', taskOrderId: undefined })
  })

  it('offers each as XLSX or CSV from its menu (the polish slice)', async () => {
    api.downloadTailoredAssessmentSummary.mockResolvedValue('t.csv')
    api.downloadAssessmentSummary.mockResolvedValue('a.csv')
    renderPage()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Download tailored report' }))
    const menu = screen.getByRole('menu', { name: 'Download tailored report' })
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['XLSX', 'CSV'])
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'CSV' }))
    expect(api.downloadTailoredAssessmentSummary).toHaveBeenCalledWith('HWS0023', expect.objectContaining({ format: 'csv' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await pick('Download accumulative report', 'CSV')
    expect(api.downloadAssessmentSummary).toHaveBeenCalledWith('HWS0023', { format: 'csv', taskOrderId: undefined })
  })

  it('closes the menu on Escape without downloading', async () => {
    renderPage()
    await table()
    await userEvent.click(screen.getByRole('button', { name: 'Download accumulative report' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(api.downloadAssessmentSummary).not.toHaveBeenCalled()
  })
})

describe('AssessmentsPage — the task order filter (the polish slice)', () => {
  it("lists the project's task orders, all of them to start", async () => {
    renderPage()
    await table()
    expect(api.listTaskOrders).toHaveBeenCalledWith('HWS0023')
    const select = screen.getByLabelText('Task order')
    expect(select).toHaveValue('')
    expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual(['All task orders', 'TO-001', 'TO-002'])
    expect(api.getAssessmentSites).toHaveBeenCalledWith('HWS0023', { from: '', to: '', taskOrderId: undefined })
  })

  it('asks again for a task order\'s sites, keeps it in the URL and narrows both downloads', async () => {
    api.downloadTailoredAssessmentSummary.mockResolvedValue('t.xlsx')
    api.downloadAssessmentSummary.mockResolvedValue('a.xlsx')
    renderPage()
    await table()
    await userEvent.selectOptions(screen.getByLabelText('Task order'), TASK_ORDERS[1].id)
    await waitFor(() => expect(api.getAssessmentSites).toHaveBeenLastCalledWith('HWS0023', {
      from: '', to: '', taskOrderId: TASK_ORDERS[1].id }))
    expect(url()).toContain(`task_order=${TASK_ORDERS[1].id}`)
    await table()
    await pick('Download tailored report', 'CSV')
    expect(api.downloadTailoredAssessmentSummary).toHaveBeenCalledWith('HWS0023', expect.objectContaining({
      taskOrderId: TASK_ORDERS[1].id, format: 'csv' }))
    await pick('Download accumulative report', 'XLSX')
    expect(api.downloadAssessmentSummary).toHaveBeenCalledWith('HWS0023', { format: 'xlsx', taskOrderId: TASK_ORDERS[1].id })
  })

  it('opens on the task order a link names', async () => {
    renderPage(`?task_order=${TASK_ORDERS[0].id}`)
    await table()
    expect(api.getAssessmentSites).toHaveBeenCalledWith('HWS0023', { from: '', to: '', taskOrderId: TASK_ORDERS[0].id })
    await waitFor(() => expect(screen.getByLabelText('Task order')).toHaveValue(TASK_ORDERS[0].id))
  })

  it('still filters by everything when the task orders can\'t be read', async () => {
    api.listTaskOrders.mockRejectedValue(new Error('boom'))
    renderPage()
    await table()
    expect(within(screen.getByLabelText('Task order')).getAllByRole('option')).toHaveLength(1)
  })
})
