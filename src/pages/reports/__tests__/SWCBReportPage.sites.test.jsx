import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import SWCBReportPage from '../SWCBReportPage'
import * as api from '../../../services/api'
import { descriptionFromSites } from '../../../lib/reportSites'

// ---------------------------------------------------------------------------
// The SWCB report's Imported sites (Slice U2): the picker, the work, Remove, and the description written from them
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
  api.listSitePayItems.mockResolvedValue([])
  api.listProperties.mockResolvedValue([SIDEWALK, RAMP, ELSEWHERE])
  api.listTaskOrders.mockResolvedValue([{ id: 'to-1', task_order_number: 'TO-001' }])
  api.getTaskOrder.mockResolvedValue({ id: 'to-1', properties: [SIDEWALK] })
})

describe('descriptionFromSites', () => {
  it('writes a sentence per site in the templates, joined and closed with a full stop', () => {
    expect(descriptionFromSites([
      site(SIDEWALK),
      site(RAMP),
      site(SIDEWALK, { work_type: 'excavation' }),
      site(RAMP, { work_type: 'pavement_restoration' }),
      site(SIDEWALK, { work_type: 'other', work_type_other: 'Tree pit guard installed' }),
    ])).toBe(
      'Sidewalk concrete was placed at 138-22 227 Street. Ped ramp concrete was placed at NE corner of 38 St/31 Ave. '
      + 'Excavation at 138-22 227 Street. Pavement restoration at NE corner of 38 St/31 Ave. '
      + 'Tree pit guard installed at 138-22 227 Street.',
    )
    expect(descriptionFromSites([])).toBe('')
  })
})

describe('Imported sites', () => {
  it("lists the sites with their kind and work, each linking to its pay items for this IDR: a sidewalk's PIR, a ramp's page", async () => {
    api.listReportSites.mockResolvedValue([site(SIDEWALK), site(RAMP, { work_type: 'excavation' })])
    renderPage()
    const link = await screen.findByRole('link', { name: '138-22 227 Street' })
    const context = `returnTo=${encodeURIComponent(REPORT_URL)}&idrId=${IDR_ID}&reportId=${REPORT_ID}`
    expect(link).toHaveAttribute('href', `/project/HWS0023/properties/p-1/pir?${context}`)
    expect(screen.getByRole('link', { name: RAMP.display_address }))
      .toHaveAttribute('href', `/project/HWS0023/properties/p-2?${context}`)
    expect(screen.getByText('SW')).toBeInTheDocument()
    expect(screen.getByText('PR')).toBeInTheDocument()
    expect(screen.getByLabelText(`Work at ${RAMP.display_address}`)).toHaveValue('excavation')
    expect(api.listReportSites).toHaveBeenCalledWith(IDR_ID, REPORT_ID)
  })

  it('imports into an empty description and writes it; a site already in another report is disabled', async () => {
    api.listReportSites.mockImplementation((idrId, reportId) =>
      Promise.resolve(reportId === GEN_ID ? [{ ...site(ELSEWHERE), report_id: GEN_ID }] : []))
    api.importReportSite.mockResolvedValue(site(RAMP))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Import sites' }))
    const dialog = await screen.findByRole('dialog')
    const taken = await within(dialog).findByText('1 Main Street')
    expect(taken.closest('li')).toHaveAttribute('title', 'Already in General (page 1) on this IDR.')
    expect(within(taken.closest('li')).getByRole('checkbox')).toBeDisabled()
    await user.click(within(within(dialog).getByText(RAMP.display_address).closest('li')).getByRole('checkbox'))
    await user.click(within(dialog).getByRole('button', { name: 'Import 1 site' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.importReportSite).toHaveBeenCalledWith(IDR_ID, REPORT_ID,
      { property_id: 'p-2', work_type: 'concrete', work_type_other: null })
    expect(description()).toHaveValue('Ped ramp concrete was placed at NE corner of 38 St/31 Ave.')
    // The new site's flags and curb segments count in its Pay items summary (Slice X)
    await waitFor(() => expect(api.getIdrFlags).toHaveBeenCalledTimes(2))
    expect(api.getIdrSegments).toHaveBeenCalledTimes(2)
  })

  it("keeps a description already written, and Regenerate replaces it", async () => {
    api.getIdr.mockResolvedValue(parentIdr({ description: 'My own words' }))
    api.importReportSite.mockResolvedValue(site(SIDEWALK))
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByRole('button', { name: 'Regenerate from sites' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Import sites' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(await within(dialog).findByText('138-22 227 Street').then(el => el.closest('li'))).getByRole('checkbox'))
    await user.click(within(dialog).getByRole('button', { name: 'Import 1 site' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(description()).toHaveValue('My own words')
    await user.click(screen.getByRole('button', { name: 'Regenerate from sites' }))
    expect(description()).toHaveValue('Sidewalk concrete was placed at 138-22 227 Street.')
  })

  it("the IDR's task order filters the picker to start", async () => {
    api.getIdr.mockResolvedValue({ ...parentIdr(), task_order_id: 'to-1' })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Import sites' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('138-22 227 Street')
    await waitFor(() => expect(within(dialog).queryByText(RAMP.display_address)).not.toBeInTheDocument())
    await user.selectOptions(within(dialog).getByLabelText('Task order'), '')
    expect(await within(dialog).findByText(RAMP.display_address)).toBeInTheDocument()
  })

  it('Other asks to specify before it is saved', async () => {
    api.listReportSites.mockResolvedValue([site(SIDEWALK)])
    api.updateReportSite.mockResolvedValue(site(SIDEWALK, { work_type: 'other', work_type_other: 'Grinding' }))
    const user = userEvent.setup()
    renderPage()
    await user.selectOptions(await screen.findByLabelText('Work at 138-22 227 Street'), 'other')
    expect(api.updateReportSite).not.toHaveBeenCalled()
    const specify = screen.getByLabelText('Specify the work at 138-22 227 Street')
    await user.type(specify, 'Grinding')
    await user.tab()
    await waitFor(() => expect(api.updateReportSite).toHaveBeenCalledWith(IDR_ID, REPORT_ID, 's-p-1',
      { work_type: 'other', work_type_other: 'Grinding' }))
  })

  it('removes a site after confirming', async () => {
    api.listReportSites.mockResolvedValue([site(SIDEWALK)])
    api.removeReportSite.mockResolvedValue()
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Remove' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(screen.getByText('No sites imported yet.')).toBeInTheDocument())
    expect(api.removeReportSite).toHaveBeenCalledWith(IDR_ID, REPORT_ID, 's-p-1')
    await waitFor(() => expect(api.getIdrFlags).toHaveBeenCalledTimes(2))
  })

  it('shows who last changed each site and when, else who added it', async () => {
    api.listReportSites.mockResolvedValue([
      site(SIDEWALK, { added_at: '2026-10-19T14:05:00', added_by_name: 'Genghis Khan', updated_at: '2026-10-20T09:30:00',
        updated_by_name: 'Jane Doe' }),
      site(RAMP, { added_at: '2026-10-19T14:05:00', added_by_name: 'Genghis Khan', updated_at: null, updated_by_name: null }),
    ])
    renderPage()
    expect(await screen.findByText('Jane Doe · 10/20/26 9:30 AM')).toBeInTheDocument()
    expect(screen.getByText('Genghis Khan · 10/19/26 2:05 PM')).toBeInTheDocument()
  })

  it('a submitted IDR shows the sites read-only', async () => {
    api.getIdr.mockResolvedValue(parentIdr({ status: 'submitted' }))
    api.listReportSites.mockResolvedValue([site(SIDEWALK)])
    renderPage()
    expect(await screen.findByText('Concrete')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Import sites' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Regenerate from sites' })).not.toBeInTheDocument()
  })
})
