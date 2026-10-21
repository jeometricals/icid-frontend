import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import SWCBReportPage from '../SWCBReportPage'
import * as api from '../../../services/api'

// ---------------------------------------------------------------------------
// The SWCB report's site pay items and pay-item totals (Slice V1)
// ---------------------------------------------------------------------------

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-swcb'
const GEN_ID = 'rep-gen'
const REPORT_URL = `/project/HWS0023/idr/${IDR_ID}/swcb/${REPORT_ID}`

const report = (reportId, reportType, pageNumber, reportData = {}) => ({
  report_id: reportId, idr_id: IDR_ID, report_type: reportType, is_addendum: false, parent_report_id: null,
  page_number: pageNumber, report_data: reportData, created_at: '2026-10-21T13:00:00Z', updated_at: '2026-10-21T13:00:00Z',
})

function parentIdr({ description = '', status = 'draft' } = {}) {
  return {
    idr_id: IDR_ID, project_id: 'HWS0023', report_date: '2026-10-21', status, submitted_at: null, total_pages: null,
    task_order_id: null,
    reports: [report(GEN_ID, 'GEN', 1), report(REPORT_ID, 'SWCB', 2, { description })],
  }
}

const SIDEWALK = {
  id: 'p-1', project_id: 'HWS0023', kind: 'sidewalk', boro: 'Queens', block: '123', lot: '45',
  address: '138-22 227 Street', display_address: '138-22 227 Street', community_board: 'QN13',
}
const RAMP = {
  id: 'p-2', project_id: 'HWS0023', kind: 'ped_ramp', boro: 'Queens', block: null, lot: null, address: null,
  intersection_street_1: '38 St', intersection_street_2: '31 Ave', quadrant: 'NE', facing_street: 'street_1',
  display_address: '38 St & 31 Ave — NE Quadrant (Facing 38 St)',
}
const ELSEWHERE = { ...SIDEWALK, id: 'p-3', address: '1 Main Street', display_address: '1 Main Street', lot: '9' }

const site = (property, extra = {}) => ({
  ...property, id: `s-${property.id}`, report_id: REPORT_ID, idr_id: IDR_ID, property_id: property.id,
  work_type: 'concrete', work_type_other: null, ...extra,
})

vi.mock('../../../services/api', () => ({
  getContractItems: vi.fn(), getIdr: vi.fn(), getProjectById: vi.fn(), saveReport: vi.fn(),
  addReport: vi.fn(), deleteReport: vi.fn(),
  listReportSites: vi.fn(), importReportSite: vi.fn(), updateReportSite: vi.fn(), removeReportSite: vi.fn(),
  getPayItemSources: vi.fn(), listSitePayItems: vi.fn(), addSitePayItem: vi.fn(), updateSitePayItem: vi.fn(),
  removeSitePayItem: vi.fn(),
  listProperties: vi.fn(), listTaskOrders: vi.fn(), getTaskOrder: vi.fn(),
}))
vi.mock('../../../components/AttachmentsSection', () => ({ default: () => <div data-testid="attachments-section" /> }))

function ShowLocation() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[REPORT_URL]}>
      <Routes>
        <Route path="/project/:projectId/idr/:idrId/swcb/:reportId" element={<SWCBReportPage />} />
        <Route path="*" element={<ShowLocation />} />
      </Routes>
    </MemoryRouter>,
  )
}

const description = () => screen.getByPlaceholderText('Enter detailed description of work performed...')

beforeEach(() => {
  vi.clearAllMocks()
  api.getIdr.mockResolvedValue(parentIdr())
  api.getProjectById.mockResolvedValue({ project_id: 'HWS0023', project_name: 'S/W Queens' })
  api.getContractItems.mockResolvedValue([])
  api.listReportSites.mockResolvedValue([])
  api.getPayItemSources.mockResolvedValue({ pay_items: [] })
  api.listSitePayItems.mockResolvedValue([])
  api.listProperties.mockResolvedValue([SIDEWALK, RAMP, ELSEWHERE])
  api.listTaskOrders.mockResolvedValue([{ id: 'to-1', task_order_number: 'TO-001' }])
  api.getTaskOrder.mockResolvedValue({ id: 'to-1', properties: [SIDEWALK] })
})

const CONTRACT_ITEM = { contract_item_id: 'ci-1', item_no: '6.70 AB', budget_code: 'HW-200(S)',
  description: 'Maintenance and protection of traffic', pay_unit: 'LS' }
const PAY_ITEM = { id: 'sp-1', report_site_id: 's-p-1', contract_item_id: 'ci-1', quantity: 12.5, note: 'MTP',
  pay_item_ref: '6.70 AB', budget_code: 'HW-200(S)', description: 'Maintenance and protection of traffic', unit: 'LS' }
const SOURCES = {
  pay_items: [
    { pay_item_ref: '4.01 AAS', budget_code: 'HW-200(S)', description: '4in sidewalk', unit: 'SF', total: 125,
      flags: 100, segments: 0, sites: 5, manual: 20,
      site_lines: [{ amount: 5, report_id: REPORT_ID, site_id: 's-p-1', property_id: 'p-1', label: '138-22 227 Street' }],
      manual_lines: [{ amount: 20, report_id: REPORT_ID }] },
    { pay_item_ref: '6.70 AB', budget_code: 'HW-200(S)', description: 'Maintenance and protection of traffic', unit: 'LS',
      total: 12.5, flags: 0, segments: 0, sites: 12.5, manual: 0,
      site_lines: [{ amount: 12.5, report_id: REPORT_ID, site_id: 's-p-1', property_id: 'p-1', label: '138-22 227 Street' }],
      manual_lines: [] },
  ],
}

describe('Site pay items', () => {
  it("shows each site's pay-item count from the totals and opens its editor", async () => {
    api.listReportSites.mockResolvedValue([site(SIDEWALK), site(RAMP)])
    api.getPayItemSources.mockResolvedValue(SOURCES)
    api.listSitePayItems.mockResolvedValue([PAY_ITEM])
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Pay items (2)' }))
    expect(screen.getByRole('button', { name: 'Pay items (0)' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Quantity of 6.70 AB')).toHaveValue(12.5)
    expect(screen.getByLabelText('Note on 6.70 AB')).toHaveValue('MTP')
    expect(api.listSitePayItems).toHaveBeenCalledWith(IDR_ID, REPORT_ID, 's-p-1')
    expect(api.getPayItemSources).toHaveBeenCalledWith(IDR_ID, REPORT_ID)
  })

  it('adds a pay item with the picker, quantity and note, then reloads the totals', async () => {
    api.listReportSites.mockResolvedValue([site(SIDEWALK)])
    api.getContractItems.mockResolvedValue([CONTRACT_ITEM])
    api.addSitePayItem.mockResolvedValue(PAY_ITEM)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Pay items (0)' }))
    await screen.findByText('No pay items entered on this site.')
    await user.selectOptions(screen.getByLabelText('Pay item'), 'ci-1')
    await user.type(screen.getByLabelText('Quantity'), '12.5')
    await user.type(screen.getByLabelText('Note'), ' MTP ')
    await user.click(screen.getByRole('button', { name: 'Add pay item' }))
    await waitFor(() => expect(api.addSitePayItem).toHaveBeenCalledWith(IDR_ID, REPORT_ID, 's-p-1',
      { contract_item_id: 'ci-1', quantity: '12.5', note: 'MTP' }))
    expect(await screen.findByLabelText('Quantity of 6.70 AB')).toBeInTheDocument()
    await waitFor(() => expect(api.getPayItemSources).toHaveBeenCalledTimes(2))
  })

  it('refuses a quantity not above 0 without calling the backend', async () => {
    api.listReportSites.mockResolvedValue([site(SIDEWALK)])
    api.getContractItems.mockResolvedValue([CONTRACT_ITEM])
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Pay items (0)' }))
    await screen.findByText('No pay items entered on this site.')
    await user.selectOptions(screen.getByLabelText('Pay item'), 'ci-1')
    await user.type(screen.getByLabelText('Quantity'), '0')
    await user.click(screen.getByRole('button', { name: 'Add pay item' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a quantity above 0')
    expect(api.addSitePayItem).not.toHaveBeenCalled()
  })

  it('changes a quantity on blur and removes a pay item', async () => {
    api.listReportSites.mockResolvedValue([site(SIDEWALK)])
    api.getPayItemSources.mockResolvedValue(SOURCES)
    api.listSitePayItems.mockResolvedValue([PAY_ITEM])
    api.updateSitePayItem.mockResolvedValue({ ...PAY_ITEM, quantity: 4 })
    api.removeSitePayItem.mockResolvedValue()
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Pay items (2)' }))
    const quantity = await screen.findByLabelText('Quantity of 6.70 AB')
    await user.clear(quantity)
    await user.type(quantity, '4')
    await user.tab()
    await waitFor(() => expect(api.updateSitePayItem).toHaveBeenCalledWith(IDR_ID, REPORT_ID, 's-p-1', 'sp-1', { quantity: '4' }))
    const editor = screen.getByLabelText('Pay items at 138-22 227 Street')
    await user.click(within(editor).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(api.removeSitePayItem).toHaveBeenCalledWith(IDR_ID, REPORT_ID, 's-p-1', 'sp-1'))
    expect(await screen.findByText('No pay items entered on this site.')).toBeInTheDocument()
  })

  it('a submitted IDR shows the pay items read-only', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted' }))
    api.listReportSites.mockResolvedValue([site(SIDEWALK)])
    api.getPayItemSources.mockResolvedValue(SOURCES)
    api.listSitePayItems.mockResolvedValue([PAY_ITEM])
    renderPage()
    expect(await screen.findByText('Concrete')).toBeInTheDocument()
    // user-event won't click anything inside the read-only page's disabled fieldset; a browser only disables its controls
    fireEvent.click(await screen.findByRole('button', { name: 'Pay items (2)' }))
    const editor = await screen.findByLabelText('Pay items at 138-22 227 Street')
    expect(await within(editor).findByText('12.5 LS')).toBeInTheDocument()
    expect(within(editor).queryByRole('button', { name: 'Add pay item' })).not.toBeInTheDocument()
    expect(within(editor).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })
})

describe('Pay item totals', () => {
  it('lists each pay item with its total and expands to its sources, sites named', async () => {
    api.getPayItemSources.mockResolvedValue(SOURCES)
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('125 SF')).toBeInTheDocument()
    expect(screen.getByText('12.5 LS')).toBeInTheDocument()
    const [first] = screen.getAllByRole('button', { name: 'Source breakdown' })
    await user.click(first)
    const list = screen.getByRole('list', { name: 'Sources of 4.01 AAS' })
    expect(within(list).getByText('PIR flags: 100 SF')).toBeInTheDocument()
    expect(within(list).getByText(/Imported sites: 5 SF/)).toBeInTheDocument()
    expect(within(list).getByText('138-22 227 Street: 5 SF')).toBeInTheDocument()
    expect(within(list).getByText('Entered on this report: 20 SF')).toBeInTheDocument()
    expect(within(list).queryByText(/Curb segments/)).not.toBeInTheDocument()
  })

  it('expands on a read-only report too', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted' }))
    api.getPayItemSources.mockResolvedValue(SOURCES)
    renderPage()
    await screen.findByText('125 SF')
    fireEvent.click(screen.getAllByRole('button', { name: 'Source breakdown' })[1])
    expect(screen.getByRole('list', { name: 'Sources of 6.70 AB' })).toHaveTextContent('Imported sites: 12.5 LS')
  })

  it('says when there are none', async () => {
    renderPage()
    expect(await screen.findByText('No pay items yet.')).toBeInTheDocument()
  })
})
