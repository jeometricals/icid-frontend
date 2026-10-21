import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PirPage from '../PirPage'
import SWCBReportPage from '../reports/SWCBReportPage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { TEST_USER } from '../../test/users'

// ---------------------------------------------------------------------------
// A site's pay items end to end (Slice X): on the site's PIR workspace opened from a draft IDR's SWCB, the one table of
// its auto rows (flags, a curb segment) and a pay item entered by hand; then the SWCB's imported sites and totals.
// The backend is a mock holding the state between the two pages.
// ---------------------------------------------------------------------------

vi.mock('../../services/api', async (importOriginal) => {
  const { nextRotation } = await importOriginal()
  return {
    nextRotation,
    // The PIR workspace
    getProperty: vi.fn(), getPirByProperty: vi.fn(), listPirPages: vi.fn(), deletePirPages: vi.fn(),
    setPirPageRotation: vi.fn(), setPirPageScale: vi.fn(),
    listFlags: vi.fn(), createFlagOnPage: vi.fn(), updateFlag: vi.fn(), deleteFlag: vi.fn(),
    listPirFeatures: vi.fn(), listPirSegments: vi.fn(), listFlagNonAssessableAreas: vi.fn(),
    getPageTitleBlock: vi.fn(), updatePirTitleBlock: vi.fn(), getPropertyPayItemSummary: vi.fn(),
    // The IDR, its sites and their pay items
    getIdr: vi.fn(), getContractItems: vi.fn(), getIdrFlags: vi.fn(), getIdrSegments: vi.fn(),
    listReportSites: vi.fn(), importReportSite: vi.fn(), updateReportSite: vi.fn(), removeReportSite: vi.fn(),
    listSitePayItems: vi.fn(), addSitePayItem: vi.fn(), updateSitePayItem: vi.fn(), removeSitePayItem: vi.fn(),
    getPayItemSources: vi.fn(),
    // The SWCB page
    getProjectById: vi.fn(), saveReport: vi.fn(), addReport: vi.fn(), deleteReport: vi.fn(),
    listProperties: vi.fn(), listTaskOrders: vi.fn(), getTaskOrder: vi.fn(),
  }
})
vi.mock('../../components/AttachmentsSection', () => ({ default: () => <div data-testid="attachments-section" /> }))

const IDR_ID = 'idr-1'
const REPORT_ID = 'rep-swcb'
const REPORT_URL = `/project/HWS0023/idr/${IDR_ID}/swcb/${REPORT_ID}`
const CODE = 'HW-200(S)'

const property = (id, address) => ({
  id, project_id: 'HWS0023', kind: 'sidewalk', boro: 'Queens', block: '100', lot: id.slice(-1), address,
  display_address: address, deleted_at: null,
})
const SITE_152 = property('p-1', '152 23 ST')
const SITE_160 = property('p-2', '160 23 ST')
const SITE_170 = property('p-3', '170 23 ST')

const site = (prop) => ({
  ...prop, id: `s-${prop.id}`, report_id: REPORT_ID, idr_id: IDR_ID, property_id: prop.id, work_type: 'concrete',
  work_type_other: null, added_at: '2026-10-21T13:00:00Z', added_by_name: 'Jane Doe', updated_at: null,
})

const CONTRACT_ITEMS = [
  { contract_item_id: 'ci-sw', item_no: '4.13 AAS', budget_code: CODE, description: '4in sidewalk', pay_unit: 'SF' },
  { contract_item_id: 'ci-curb', item_no: '4.08 AA', budget_code: CODE, description: 'Concrete curb', pay_unit: 'LF' },
  { contract_item_id: 'ci-mtp', item_no: '6.70 AB', budget_code: CODE, description: 'Maintenance and protection of traffic',
    pay_unit: 'EA' },
]

// 152 23 ST: 8 flags of 22.5 SF and a 20 LF curb; 160 23 ST: 2 flags of 60 SF; 170 23 ST: a 15 LF curb
const drawing = (propertyId, ref, description, unit, amount) => ({
  property_id: propertyId, state: 'attributed', pay_item_ref: ref, budget_code: CODE, pay_item_description: description,
  unit, amount, claimed_by_idr_id: null, claimed_by_idr_number: null, constructed_on: null,
})
const FLAGS = [
  ...[...Array(8)].map((_, n) => ({ ...drawing('p-1', '4.13 AAS', '4in sidewalk', 'SF', 22.5), flag_id: `f-${n}` })),
  ...[...Array(2)].map((_, n) => ({ ...drawing('p-2', '4.13 AAS', '4in sidewalk', 'SF', 60), flag_id: `g-${n}` })),
]
const SEGMENTS = [
  { ...drawing('p-1', '4.08 AA', 'Concrete curb', 'LF', 20), segment_id: 'seg-1' },
  { ...drawing('p-3', '4.08 AA', 'Concrete curb', 'LF', 15), segment_id: 'seg-2' },
]

let enteredOnSites // the backend's site pay items: [{site_id, ...row}]

// The totals the backend gives over every source, from the flags, segments and site pay items as they stand
function payItemSources() {
  const items = new Map()
  const item = (ref, description, unit) => {
    const key = `${ref}|${CODE}`
    if (!items.has(key)) {
      items.set(key, { pay_item_ref: ref, budget_code: CODE, description, unit, total: 0, flags: 0, segments: 0, sites: 0,
        manual: 0, site_lines: [], manual_lines: [] })
    }
    return items.get(key)
  }
  for (const flag of FLAGS) { const it = item(flag.pay_item_ref, flag.pay_item_description, flag.unit); it.flags += flag.amount; it.total += flag.amount }
  for (const seg of SEGMENTS) { const it = item(seg.pay_item_ref, seg.pay_item_description, seg.unit); it.segments += seg.amount; it.total += seg.amount }
  for (const row of enteredOnSites) {
    const it = item(row.pay_item_ref, row.description, row.unit)
    it.sites += row.quantity
    it.total += row.quantity
    it.site_lines.push({ amount: row.quantity, report_id: REPORT_ID, site_id: row.site_id, property_id: 'p-1', label: '152 23 ST' })
  }
  return { pay_items: [...items.values()] }
}

beforeEach(() => {
  vi.clearAllMocks()
  enteredOnSites = []
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: TEST_USER })

  api.getIdr.mockResolvedValue({
    idr_id: IDR_ID, project_id: 'HWS0023', report_date: '2026-10-21', status: 'draft', idr_number: null,
    reporter_uuid: TEST_USER.uuid, deleted_at: null, submitted_at: null, total_pages: null, task_order_id: null,
    reports: [{ report_id: REPORT_ID, idr_id: IDR_ID, report_type: 'SWCB', is_addendum: false, parent_report_id: null,
      page_number: 1, report_data: { description: '' }, created_at: '2026-10-21T13:00:00Z', updated_at: '2026-10-21T13:00:00Z' }],
  })
  api.getContractItems.mockResolvedValue(CONTRACT_ITEMS)
  api.getIdrFlags.mockImplementation(async () => ({ flags: structuredClone(FLAGS) }))
  api.getIdrSegments.mockImplementation(async () => ({ segments: structuredClone(SEGMENTS) }))
  api.listReportSites.mockResolvedValue([site(SITE_152), site(SITE_160), site(SITE_170)])
  api.listSitePayItems.mockImplementation(async (_i, _r, siteId) => enteredOnSites.filter(row => row.site_id === siteId))
  api.addSitePayItem.mockImplementation(async (_i, _r, siteId, body) => {
    const item = CONTRACT_ITEMS.find(ci => ci.contract_item_id === body.contract_item_id)
    const row = { id: `spi-${enteredOnSites.length + 1}`, site_id: siteId, contract_item_id: item.contract_item_id,
      quantity: Number(body.quantity), note: body.note, pay_item_ref: item.item_no, budget_code: item.budget_code,
      description: item.description, unit: item.pay_unit }
    enteredOnSites.push(row)
    return row
  })
  api.getPayItemSources.mockImplementation(async () => payItemSources())

  // The PIR workspace: one page, nothing drawn on it here (the IDR's flags come from attributed-flags)
  api.getProperty.mockResolvedValue(SITE_152)
  api.getPirByProperty.mockResolvedValue({ id: 'pir-1', property_id: 'p-1', project_id: 'HWS0023', as_built_signed_at: null })
  api.listPirPages.mockResolvedValue([{ pir_page_id: 'page-1', pir_id: 'pir-1', page_number: 1, image_url: 'https://s/p1.png',
    width_px: 1200, height_px: 800, scale_px_per_ft: 15, rotation_deg: 0 }])
  api.listFlags.mockResolvedValue([])
  api.listPirFeatures.mockResolvedValue([])
  api.listPirSegments.mockResolvedValue([])
  api.getPageTitleBlock.mockResolvedValue(null)
  api.getPropertyPayItemSummary.mockResolvedValue([])

  // The SWCB page
  api.getProjectById.mockResolvedValue({ project_id: 'HWS0023', project_name: 'S/W Queens' })
  api.listProperties.mockResolvedValue([SITE_152, SITE_160, SITE_170])
  api.listTaskOrders.mockResolvedValue([])
})

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/project/:projectId/properties/:propertyId/pir" element={<PirPage />} />
        <Route path="/project/:projectId/idr/:idrId/swcb/:reportId" element={<SWCBReportPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("A site's pay items, from its PIR workspace to the SWCB (Slice X)", () => {
  it('shows the auto rows, takes a pay item entered by hand, and the SWCB counts both', async () => {
    const user = userEvent.setup()
    const returnTo = encodeURIComponent(REPORT_URL)
    const { unmount } = renderAt(`/project/HWS0023/properties/p-1/pir?returnTo=${returnTo}&idrId=${IDR_ID}&reportId=${REPORT_ID}`)

    // (a) One table: the curb and the sidewalk, from the sketch
    const section = await screen.findByRole('region', { name: 'Pay items for this site' })
    expect(await within(section).findByText('This IDR: Draft')).toBeInTheDocument()
    const table = await within(section).findByRole('table', { name: 'Pay items for this site' })
    const bodyRows = () => within(table).getAllByRole('row').slice(1, -1) // less the heads and the add row
    expect(bodyRows().map(row => row.textContent)).toEqual([
      '4.08 AA (HW-200(S))Concrete curb20LFauto (1 segment)from the sketch',
      '4.13 AAS (HW-200(S))4in sidewalk180SFauto (8 flags)from the sketch',
    ])

    // (b) A pay item entered by hand: MTP, 1 EA
    await user.selectOptions(within(table).getByLabelText('Pay item'), 'ci-mtp')
    await user.type(within(table).getByLabelText('Quantity'), '1')
    await user.click(within(table).getByRole('button', { name: '+ Add pay item' }))
    await waitFor(() => expect(api.addSitePayItem).toHaveBeenCalledWith(IDR_ID, REPORT_ID, 's-p-1',
      { contract_item_id: 'ci-mtp', quantity: '1', note: null }))
    const entered = await within(table).findByLabelText('Quantity of 6.70 AB')
    expect(entered).toHaveValue(1)
    const row = entered.closest('tr')
    expect(within(row).getByText('entered')).toBeInTheDocument()
    expect(within(row).getByText('EA')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    unmount()

    // (c) The SWCB: 152 23 ST's summary counts its auto rows and the entered one; the totals sum the three sites
    renderAt(REPORT_URL)
    expect(await screen.findByTestId('site-pay-items-s-p-1')).toHaveTextContent('3 items · 180 SF · 20 LF · 1 EA')
    expect(screen.getByTestId('site-pay-items-s-p-2')).toHaveTextContent('1 item · 120 SF')
    expect(screen.getByTestId('site-pay-items-s-p-3')).toHaveTextContent('1 item · 15 LF')
    const totals = screen.getByRole('heading', { name: 'Pay item totals' }).closest('.form-section')
    const totalRows = within(await within(totals).findByRole('table')).getAllByRole('row').slice(1)
    expect(totalRows.map(r => r.querySelectorAll('td')[0].textContent + ' ' + r.querySelectorAll('td')[3].textContent))
      .toEqual(['4.13 AAS 300 SF', '4.08 AA 35 LF', '6.70 AB 1 EA'])
    // The Pay Items card mirrors them, read-only, summed over the sites
    const siteRows = within(screen.getByRole('table', { name: 'Pay items from imported sites' })).getAllByRole('row').slice(1)
    expect(siteRows.map(r => [0, 2, 3].map(n => r.querySelectorAll('td')[n].textContent).join(' ')).sort())
      .toEqual(['4.08 AA 35 LF', '4.13 AAS 300 SF', '6.70 AB 1 EA'])
  })
})
