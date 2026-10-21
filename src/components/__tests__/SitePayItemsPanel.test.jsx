import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SitePayItemsPanel from '../SitePayItemsPanel'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

vi.mock('../../services/api', () => ({
  getIdr: vi.fn(), listReportSites: vi.fn(), getContractItems: vi.fn(), getIdrFlags: vi.fn(), getIdrSegments: vi.fn(),
  listSitePayItems: vi.fn(), addSitePayItem: vi.fn(), updateSitePayItem: vi.fn(), removeSitePayItem: vi.fn(),
}))

const PROPERTY_ID = 'prop-1'
const CONTEXT = '?returnTo=%2Fproject%2FHWS0023%2Fidr%2Fidr-1%2Fswcb%2Frep-1&idrId=idr-1&reportId=rep-1'
const SITE = { id: 'site-1', property_id: PROPERTY_ID, display_address: '12 Main St', kind: 'sidewalk' }
const CONTRACT_ITEM = { contract_item_id: 'ci-1', item_no: '4.13 AAS', budget_code: 'HW-200(S)', description: '4in sidewalk' }

const idr = (extra = {}) => ({
  idr_id: 'idr-1', project_id: 'HWS0023', status: 'draft', idr_number: 'IDR-005', reporter_uuid: TEST_USER.uuid,
  deleted_at: null, ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: TEST_USER })
  api.getIdr.mockResolvedValue(idr())
  api.listReportSites.mockResolvedValue([{ ...SITE, id: 'site-0', property_id: 'prop-0' }, SITE])
  api.getContractItems.mockResolvedValue([CONTRACT_ITEM])
  api.getIdrFlags.mockResolvedValue({ flags: [
    { property_id: PROPERTY_ID, state: 'attributed', pay_item_ref: '4.13 AAS', budget_code: 'HW-200(S)',
      pay_item_description: '4in sidewalk', unit: 'SF', amount: 40 },
    { property_id: 'prop-0', state: 'attributed', pay_item_ref: '4.13 AAS', budget_code: 'HW-200(S)',
      pay_item_description: '4in sidewalk', unit: 'SF', amount: 99 },
  ] })
  api.getIdrSegments.mockResolvedValue({ segments: [] })
  api.listSitePayItems.mockResolvedValue({ rows: [], audit: [] })
  api.addSitePayItem.mockImplementation(async (_i, _r, _s, body) => ({
    id: 'spi-1', quantity: Number(body.quantity), note: body.note, pay_item_ref: '4.13 AAS', budget_code: 'HW-200(S)',
    description: '4in sidewalk', unit: 'SF',
  }))
})

function renderPanel(search = CONTEXT, props = {}) {
  return render(
    <MemoryRouter initialEntries={[`/project/HWS0023/properties/${PROPERTY_ID}/pir${search}`]}>
      <SitePayItemsPanel projectId="HWS0023" propertyId={PROPERTY_ID} {...props} />
    </MemoryRouter>
  )
}

const panel = () => screen.findByRole('region', { name: 'Pay items for this site' })

describe('SitePayItemsPanel', () => {
  it('renders nothing and reads nothing without an IDR context', () => {
    const { container } = renderPanel('?returnTo=%2Fproject%2FHWS0023%2Fidr%2Fidr-1')
    expect(container).toBeEmptyDOMElement()
    expect(api.getIdr).not.toHaveBeenCalled()
  })

  it("names the IDR and lists this site's flag quantities, then its own pay items, in one table", async () => {
    api.listSitePayItems.mockResolvedValue({ rows: [{ id: 'spi-1', quantity: 1, note: null, pay_item_ref: '6.70 AB',
      budget_code: 'HW-200(S)', description: 'MTP', unit: 'EA', overrides_auto: false }], audit: [] })
    renderPanel()
    const section = await panel()
    expect(within(section).getByText('This IDR: IDR-005')).toBeInTheDocument()
    const table = await within(section).findByRole('table', { name: 'Pay items for this site' })
    await within(table).findByLabelText('Quantity of 6.70 AB')
    const rows = within(table).getAllByRole('row').slice(1, 3)
    expect(rows[0].textContent).toBe('4.13 AAS (HW-200(S))4in sidewalkSFauto (1 flag)Auto Calculate')
    expect(within(rows[0]).getByLabelText('Auto quantity of 4.13 AAS')).toHaveValue(40)
    expect(within(rows[1]).getByText('entered')).toBeInTheDocument()
    expect(api.listSitePayItems).toHaveBeenCalledWith('idr-1', 'rep-1', 'site-1')
    expect(api.listReportSites).toHaveBeenCalledWith('idr-1', 'rep-1')
    expect(api.getContractItems).toHaveBeenCalledWith('HWS0023')
  })

  it('calls an IDR without a number a Draft', async () => {
    api.getIdr.mockResolvedValue(idr({ idr_number: null }))
    renderPanel()
    expect(await within(await panel()).findByText('This IDR: Draft')).toBeInTheDocument()
  })

  it('says, above the table, what another IDR already billed here', async () => {
    const billed = { property_id: PROPERTY_ID, state: 'claimed_elsewhere', claimed_by_idr_id: 'idr-0',
      claimed_by_idr_number: 'IDR-001', constructed_on: '2026-10-16', amount: 10, unit: 'SF' }
    api.getIdrFlags.mockResolvedValue({ flags: [...Array(8)].map(() => billed) })
    api.getIdrSegments.mockResolvedValue({ segments: [billed, { ...billed, property_id: 'prop-0' }] })
    renderPanel()
    const section = await panel()
    expect(await within(section).findByText('8 flags and 1 curb segment here were billed by IDR-001 (10/16/26).'))
      .toBeInTheDocument()
    expect(await within(section).findByText('No pay items for this site yet.')).toBeInTheDocument()
  })

  it("lets the draft's inspector add a pay item, and says so to the page", async () => {
    const onChanged = vi.fn()
    const user = userEvent.setup()
    renderPanel(CONTEXT, { onChanged })
    const section = await panel()
    await user.selectOptions(await within(section).findByLabelText('Pay item'), 'ci-1')
    await user.type(within(section).getByLabelText('Quantity'), '12')
    await user.click(within(section).getByRole('button', { name: '+ Add pay item' }))
    await waitFor(() => expect(api.addSitePayItem).toHaveBeenCalledWith('idr-1', 'rep-1', 'site-1',
      { contract_item_id: 'ci-1', quantity: '12', note: null }))
    expect(onChanged).toHaveBeenCalled()
  })

  it.each([
    ['an approved IDR', idr({ status: 'approved' }), TEST_USER],
    ['a submitted IDR not yet accepted', idr({ status: 'submitted' }), TEST_USER],
    ["another inspector's draft", idr({ reporter_uuid: 'someone-else' }), TEST_USER],
    ['a demo user', idr({ reporter_uuid: DEMO_USER.uuid }), DEMO_USER],
  ])('is read-only on %s', async (_, theIdr, theUser) => {
    api.getIdr.mockResolvedValue(theIdr)
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: theUser })
    renderPanel()
    const section = await panel()
    expect(await within(section).findByText('4.13 AAS')).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: '+ Add pay item' })).not.toBeInTheDocument()
    expect(within(section).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(section).queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: 'Auto Calculate' })).not.toBeInTheDocument()
  })

  it('lets an admin edit an IDR in review', async () => {
    api.getIdr.mockResolvedValue(idr({ status: 'stage1_review', reporter_uuid: 'someone-else' }))
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: { ...TEST_USER, role: 'admin' } })
    renderPanel()
    const section = await panel()
    expect(await within(section).findByRole('button', { name: '+ Add pay item' })).toBeInTheDocument()
  })

  it('Auto Calculate drops the override and re-reads the flags (Slice X.1)', async () => {
    const override = { id: 'spi-9', contract_item_id: 'ci-1', quantity: 45, note: null, overrides_auto: true,
      pay_item_ref: '4.13 AAS', budget_code: 'HW-200(S)', description: '4in sidewalk', unit: 'SF' }
    api.listSitePayItems.mockResolvedValueOnce({ rows: [override], audit: [] })
    api.removeSitePayItem.mockResolvedValue()
    renderPanel()
    const section = await panel()
    expect(await within(section).findByLabelText('Auto quantity of 4.13 AAS')).toHaveValue(45)
    // The sketch changed meanwhile: its flag is 42 SF now
    api.getIdrFlags.mockResolvedValue({ flags: [{ property_id: PROPERTY_ID, state: 'attributed', pay_item_id: 'ci-1',
      pay_item_ref: '4.13 AAS', budget_code: 'HW-200(S)', pay_item_description: '4in sidewalk', unit: 'SF', amount: 42 }] })
    fireEvent.click(within(section).getByRole('button', { name: 'Auto Calculate' }))
    await waitFor(() => expect(within(section).getByLabelText('Auto quantity of 4.13 AAS')).toHaveValue(42))
    expect(api.getIdrFlags).toHaveBeenCalledTimes(2)
    expect(within(section).queryByText(/· edited/)).not.toBeInTheDocument()
  })

  it("says so when the site isn't in that report", async () => {
    api.listReportSites.mockResolvedValue([])
    renderPanel()
    const section = await panel()
    expect(await within(section).findByText("This site isn't imported into that report.")).toBeInTheDocument()
    expect(api.listSitePayItems).not.toHaveBeenCalled()
  })

  it("keeps the editor when the flags can't be read", async () => {
    api.getIdrSegments.mockRejectedValue(new Error('Network down'))
    renderPanel()
    const section = await panel()
    expect(await within(section).findByText("Couldn't load its flags and curb segments: Network down")).toBeInTheDocument()
    expect(await within(section).findByRole('button', { name: '+ Add pay item' })).toBeInTheDocument()
  })

  it("shows the load error when the IDR can't be read", async () => {
    api.getIdr.mockRejectedValue(new Error('IDR not found'))
    renderPanel()
    expect(await screen.findByText("Couldn't load this IDR's pay items: IDR not found")).toBeInTheDocument()
  })
})
