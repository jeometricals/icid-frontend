import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import SWCBReportPage from '../SWCBReportPage'
import * as api from '../../../services/api'

// ---------------------------------------------------------------------------
// The SWCB report's imported sites' pay-item summaries (W4) and pay-item totals (Slice V1)
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
  getPayItemSources: vi.fn(), getIdrFlags: vi.fn(), getIdrSegments: vi.fn(), listSitePayItems: vi.fn(), addSitePayItem: vi.fn(), updateSitePayItem: vi.fn(),
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
  api.getIdrFlags.mockResolvedValue({ flags: [] })
  api.getIdrSegments.mockResolvedValue({ segments: [] })
  api.listSitePayItems.mockResolvedValue({ rows: [], audit: [] })
  api.listProperties.mockResolvedValue([SIDEWALK, RAMP, ELSEWHERE])
  api.listTaskOrders.mockResolvedValue([{ id: 'to-1', task_order_number: 'TO-001' }])
  api.getTaskOrder.mockResolvedValue({ id: 'to-1', properties: [SIDEWALK] })
})

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

describe("Imported sites' Pay items column (W4)", () => {
  it("sums each site's pay items from the totals' site lines, per unit", async () => {
    api.listReportSites.mockResolvedValue([site(SIDEWALK), site(RAMP), site(ELSEWHERE)])
    api.getPayItemSources.mockResolvedValue({ pay_items: [
      ...SOURCES.pay_items,
      { pay_item_ref: '4.08 AA', budget_code: 'HW-200(S)', description: 'Curb', unit: 'LF', total: 30, flags: 0,
        segments: 0, sites: 30, manual: 0, manual_lines: [],
        site_lines: [{ amount: 10, site_id: 's-p-2', property_id: 'p-2' }, { amount: 20, site_id: 's-p-2', property_id: 'p-2' }] },
    ] })
    renderPage()
    expect(await screen.findByTestId('site-pay-items-s-p-1')).toHaveTextContent(/^2 items · 5 SF · 12\.5 LS$/)
    expect(screen.getByTestId('site-pay-items-s-p-2')).toHaveTextContent('2 items · 30 LF')
    expect(screen.getByTestId('site-pay-items-s-p-3')).toHaveTextContent('—')
    expect(api.getPayItemSources).toHaveBeenCalledWith(IDR_ID, REPORT_ID)
  })

  it("counts what each site's attributed flags and curb segments come to, flags first", async () => {
    const drawing = { property_id: 'p-1', state: 'attributed', budget_code: 'HW-200(S)' }
    api.listReportSites.mockResolvedValue([site(SIDEWALK), site(RAMP)])
    api.getIdrFlags.mockResolvedValue({ flags: [
      { ...drawing, pay_item_ref: '4.13 AAS', unit: 'SF', amount: 100 },
      { ...drawing, pay_item_ref: '4.13 AAS', unit: 'SF', amount: 80 },
      { ...drawing, pay_item_ref: '4.13 AAS', unit: 'SF', amount: 50, state: 'excluded' },
      { ...drawing, pay_item_ref: '4.13 AAS', unit: 'SF', amount: null },
    ] })
    api.getIdrSegments.mockResolvedValue({ segments: [{ ...drawing, pay_item_ref: '4.08 AA', unit: 'LF', amount: 20 }] })
    api.getPayItemSources.mockResolvedValue({ pay_items: [SOURCES.pay_items[1]] })
    renderPage()
    expect(await screen.findByTestId('site-pay-items-s-p-1')).toHaveTextContent(/^3 items · 180 SF · 20 LF · 12\.5 LS$/)
    expect(screen.getByTestId('site-pay-items-s-p-2')).toHaveTextContent('—')
    expect(api.getIdrFlags).toHaveBeenCalledWith(IDR_ID)
    expect(api.getIdrSegments).toHaveBeenCalledWith(IDR_ID)
  })

  it('has no editor on the row: no toggle and nothing read per site', async () => {
    api.listReportSites.mockResolvedValue([site(SIDEWALK)])
    api.getPayItemSources.mockResolvedValue(SOURCES)
    renderPage()
    await screen.findByTestId('site-pay-items-s-p-1')
    expect(screen.queryByRole('button', { name: /^Pay items/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Pay items at 138-22 227 Street')).not.toBeInTheDocument()
    expect(api.listSitePayItems).not.toHaveBeenCalled()
  })

  it('reads the same on a submitted IDR', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted' }))
    api.listReportSites.mockResolvedValue([site(SIDEWALK)])
    api.getPayItemSources.mockResolvedValue({ pay_items: [SOURCES.pay_items[1]] })
    renderPage()
    expect(await screen.findByTestId('site-pay-items-s-p-1')).toHaveTextContent('1 item · 12.5 LS')
  })
})

describe("Pay Items card: the sites' pay items, read-only, above the extras (Slice X)", () => {
  const drawing = (property, extra) => ({ property_id: property, state: 'attributed', budget_code: 'HW-200(S)',
    pay_item_description: '4in sidewalk', ...extra })

  beforeEach(() => {
    api.listReportSites.mockResolvedValue([site(SIDEWALK), site(RAMP)])
    api.getIdrFlags.mockResolvedValue({ flags: [
      drawing('p-1', { pay_item_ref: '4.01 AAS', unit: 'SF', amount: 100 }),
      drawing('p-2', { pay_item_ref: '4.01 AAS', unit: 'SF', amount: 40 }),
    ] })
    api.getPayItemSources.mockResolvedValue({ pay_items: [SOURCES.pay_items[1]] })
  })

  const siteTable = () => screen.findByRole('table', { name: 'Pay items from imported sites' })

  it('sums each pay item over the sites, linking each site to its page in this IDR', async () => {
    renderPage()
    const table = await siteTable()
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(3))
    const [sidewalk, mtp] = within(table).getAllByRole('row').slice(1)
    expect(sidewalk).toHaveTextContent(/^4\.01 AASHW-200\(S\)140SF4in sidewalk138-22 227 Street \(100\), 38 St & 31 Ave/)
    expect(mtp).toHaveTextContent(/^6\.70 ABHW-200\(S\)12\.5LSMaintenance and protection of traffic138-22 227 Street$/)
    const context = `returnTo=${encodeURIComponent(REPORT_URL)}&idrId=${IDR_ID}&reportId=${REPORT_ID}`
    expect(within(sidewalk).getByRole('link', { name: '138-22 227 Street' }))
      .toHaveAttribute('href', `/project/HWS0023/properties/p-1/pir?${context}`)
    expect(within(sidewalk).getByRole('link', { name: RAMP.display_address }))
      .toHaveAttribute('href', `/project/HWS0023/properties/p-2?${context}`)
    expect(within(table).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it("keeps the report's own items editable below, as cross-site extras, with Add Item", async () => {
    renderPage()
    await siteTable()
    expect(screen.getByRole('heading', { name: 'Cross-site extras' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeEnabled()
  })

  it('still shows them once the IDR is submitted', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted' }))
    renderPage()
    const table = await siteTable()
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(3))
  })

  it('says when the sites bring no pay items', async () => {
    api.getIdrFlags.mockResolvedValue({ flags: [] })
    api.getPayItemSources.mockResolvedValue({ pay_items: [] })
    renderPage()
    expect(await screen.findByText('No pay items from imported sites.')).toBeInTheDocument()
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

describe("A site's override replaces its auto amount on the SWCB (Slice X.1)", () => {
  const drawing = (property, amount) => ({ property_id: property, state: 'attributed', budget_code: 'HW-200(S)',
    pay_item_id: 'ci-sw', pay_item_ref: '4.13 AAS', pay_item_description: '4in sidewalk', unit: 'SF', amount })
  const line = (siteId, propertyId, amount, overridesAuto) => ({ amount, report_id: REPORT_ID, site_id: siteId,
    property_id: propertyId, label: '', overrides_auto: overridesAuto })
  const sources = (siteLines) => ({ pay_items: [{ pay_item_ref: '4.13 AAS', budget_code: 'HW-200(S)',
    description: '4in sidewalk', unit: 'SF', total: 0, flags: 0, segments: 0, sites: 0, manual: 0, manual_lines: [],
    site_lines: siteLines }] })

  beforeEach(() => {
    api.listReportSites.mockResolvedValue([site(SIDEWALK), site(RAMP)])
    // 152: 180 SF from its flags; the ramp: 40 SF
    api.getIdrFlags.mockResolvedValue({ flags: [drawing('p-1', 100), drawing('p-1', 80), drawing('p-2', 40)] })
  })

  it('185 replaces 180 in the site summary and the From imported sites row, not 365', async () => {
    api.getPayItemSources.mockResolvedValue(sources([line('s-p-1', 'p-1', 185, true)]))
    renderPage()
    await waitFor(() => expect(screen.getByTestId('site-pay-items-s-p-1')).toHaveTextContent(/^1 item · 185 SF$/))
    expect(screen.getByTestId('site-pay-items-s-p-2')).toHaveTextContent(/^1 item · 40 SF$/)
    const table = await screen.findByRole('table', { name: 'Pay items from imported sites' })
    const [row] = within(table).getAllByRole('row').slice(1)
    expect(row).toHaveTextContent(/^4\.13 AASHW-200\(S\)225SF4in sidewalk138-22 227 Street \(185\), 38 St & 31 Ave.* \(40\)$/)
  })

  it('takes a lower override too, and an ordinary line still adds', async () => {
    api.getPayItemSources.mockResolvedValue(sources([line('s-p-1', 'p-1', 160, true), line('s-p-1', 'p-1', 5, false)]))
    renderPage()
    await waitFor(() => expect(screen.getByTestId('site-pay-items-s-p-1')).toHaveTextContent(/^2 items · 165 SF$/))
    const table = await screen.findByRole('table', { name: 'Pay items from imported sites' })
    await waitFor(() => expect(within(table).getAllByRole('row')[1]).toHaveTextContent(/^4\.13 AASHW-200\(S\)205SF/))
  })

  it('an override with no auto row left is counted as it stands', async () => {
    api.getIdrFlags.mockResolvedValue({ flags: [] })
    api.getPayItemSources.mockResolvedValue(sources([line('s-p-1', 'p-1', 185, true)]))
    renderPage()
    expect(await screen.findByTestId('site-pay-items-s-p-1')).toHaveTextContent(/^1 item · 185 SF$/)
  })
})
