import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SitePayItemsEditor, { auditLine } from '../SitePayItemsEditor'
import * as api from '../../../services/api'

// One site's pay items for an IDR as one table (Slice X): its flags' and segments' (auto, read-only), then those entered
// by hand on it (Slice V1), on the site's own page (W3)

vi.mock('../../../services/api', () => ({
  listSitePayItems: vi.fn(), addSitePayItem: vi.fn(), updateSitePayItem: vi.fn(), removeSitePayItem: vi.fn(),
}))

const SITE = { id: 's-p-1', property_id: 'p-1', display_address: '138-22 227 Street' }
const CONTRACT_ITEM = { contract_item_id: 'ci-1', item_no: '6.70 AB', budget_code: 'HW-200(S)',
  description: 'Maintenance and protection of traffic', pay_unit: 'LS' }
const PAY_ITEM = { id: 'sp-1', report_site_id: 's-p-1', contract_item_id: 'ci-1', quantity: 12.5, note: 'MTP',
  pay_item_ref: '6.70 AB', budget_code: 'HW-200(S)', description: 'Maintenance and protection of traffic', unit: 'LS' }

beforeEach(() => {
  vi.clearAllMocks()
  api.listSitePayItems.mockResolvedValue({ rows: [], audit: [] })
})

function renderEditor(props = {}) {
  const onChanged = vi.fn()
  render(<SitePayItemsEditor idrId="idr-1" reportId="rep-1" site={SITE} contractItems={[CONTRACT_ITEM]}
    isReadOnly={false} onChanged={onChanged} {...props} />)
  return onChanged
}

const AUTO_ROWS = [
  { key: '4.08 AA|HW-200(S)', pay_item_id: 'ci-curb', pay_item_ref: '4.08 AA', budget_code: 'HW-200(S)', description: 'Concrete curb', unit: 'LF',
    amount: 20, flags: 0, segments: 1 },
  { key: '4.13 AAS|HW-200(S)', pay_item_id: 'ci-sw', pay_item_ref: '4.13 AAS', budget_code: 'HW-200(S)', description: '4in sidewalk', unit: 'SF',
    amount: 180, flags: 8, segments: 1 },
]

describe('SitePayItemsEditor', () => {
  it('lists the auto rows first, each a box with Auto Calculate, then the entered ones, each with its source', async () => {
    api.listSitePayItems.mockResolvedValue({ rows: [PAY_ITEM], audit: [] })
    renderEditor({ autoRows: AUTO_ROWS })
    const table = await screen.findByRole('table', { name: 'Pay items for this site' })
    await within(table).findByLabelText('Quantity of 6.70 AB')
    const rows = within(table).getAllByRole('row')
    expect(rows[0].textContent).toBe('ItemDescriptionQuantityUnitSourceActions')
    expect(rows[1].textContent).toBe('4.08 AA (HW-200(S))Concrete curbLFauto (1 segment)Auto Calculate')
    expect(rows[2].textContent).toBe('4.13 AAS (HW-200(S))4in sidewalkSFauto (8 flags, 1 segment)Auto Calculate')
    expect(within(rows[1]).getByLabelText('Auto quantity of 4.08 AA')).toHaveValue(20)
    expect(within(rows[2]).getByLabelText('Auto quantity of 4.13 AAS')).toHaveValue(180)
    expect(within(rows[3]).getByText('entered')).toBeInTheDocument()
    expect(within(rows[3]).queryByRole('button', { name: 'Auto Calculate' })).not.toBeInTheDocument()
  })

  it('read-only, shows the auto rows without a box or Auto Calculate', async () => {
    renderEditor({ autoRows: AUTO_ROWS, isReadOnly: true })
    const table = await screen.findByRole('table', { name: 'Pay items for this site' })
    const rows = within(table).getAllByRole('row')
    expect(rows[1].textContent).toBe('4.08 AA (HW-200(S))Concrete curb20LFauto (1 segment)from the sketch')
    expect(within(table).queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(within(table).queryByRole('button')).not.toBeInTheDocument()
  })

  it("shows the picked pay item's unit in the add row", async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByText('No pay items for this site yet.')
    await user.selectOptions(screen.getByLabelText('Pay item'), 'ci-1')
    expect(screen.getAllByRole('row').at(-1)).toHaveTextContent('LS')
  })


  it("lists the site's pay items with their quantity and note", async () => {
    api.listSitePayItems.mockResolvedValue({ rows: [PAY_ITEM], audit: [] })
    renderEditor()
    expect(await screen.findByLabelText('Quantity of 6.70 AB')).toHaveValue(12.5)
    expect(screen.getByLabelText('Note on 6.70 AB')).toHaveValue('MTP')
    expect(api.listSitePayItems).toHaveBeenCalledWith('idr-1', 'rep-1', 's-p-1')
  })

  it('adds a pay item with the picker, quantity and note, then says so', async () => {
    api.addSitePayItem.mockResolvedValue(PAY_ITEM)
    const user = userEvent.setup()
    const onChanged = renderEditor()
    await screen.findByText('No pay items for this site yet.')
    await user.selectOptions(screen.getByLabelText('Pay item'), 'ci-1')
    await user.type(screen.getByLabelText('Quantity'), '12.5')
    await user.type(screen.getByLabelText('Note'), ' MTP ')
    await user.click(screen.getByRole('button', { name: '+ Add pay item' }))
    await waitFor(() => expect(api.addSitePayItem).toHaveBeenCalledWith('idr-1', 'rep-1', 's-p-1',
      { contract_item_id: 'ci-1', quantity: '12.5', note: 'MTP' }))
    expect(await screen.findByLabelText('Quantity of 6.70 AB')).toBeInTheDocument()
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('refuses a quantity not above 0 without calling the backend', async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByText('No pay items for this site yet.')
    await user.selectOptions(screen.getByLabelText('Pay item'), 'ci-1')
    await user.type(screen.getByLabelText('Quantity'), '0')
    await user.click(screen.getByRole('button', { name: '+ Add pay item' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a quantity above 0')
    expect(api.addSitePayItem).not.toHaveBeenCalled()
  })

  it('changes a quantity on blur and removes a pay item', async () => {
    api.listSitePayItems.mockResolvedValue({ rows: [PAY_ITEM], audit: [] })
    api.updateSitePayItem.mockResolvedValue({ ...PAY_ITEM, quantity: 4 })
    api.removeSitePayItem.mockResolvedValue()
    const user = userEvent.setup()
    renderEditor()
    const quantity = await screen.findByLabelText('Quantity of 6.70 AB')
    await user.clear(quantity)
    await user.type(quantity, '4')
    await user.tab()
    await waitFor(() => expect(api.updateSitePayItem).toHaveBeenCalledWith('idr-1', 'rep-1', 's-p-1', 'sp-1', { quantity: '4' }))
    const editor = screen.getByLabelText('Pay items at 138-22 227 Street')
    await user.click(within(editor).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(api.removeSitePayItem).toHaveBeenCalledWith('idr-1', 'rep-1', 's-p-1', 'sp-1'))
    expect(await screen.findByText('No pay items for this site yet.')).toBeInTheDocument()
  })

  it('read-only, lists them without Add, Delete or inputs, the note under the description', async () => {
    api.listSitePayItems.mockResolvedValue({ rows: [PAY_ITEM], audit: [] })
    renderEditor({ isReadOnly: true })
    const editor = await screen.findByLabelText('Pay items at 138-22 227 Street')
    const [, row] = await within(editor).findAllByRole('row')
    expect(row.textContent).toBe('6.70 AB (HW-200(S))Maintenance and protection of trafficMTP12.5LSentered')
    expect(within(editor).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(editor).queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(within(editor).queryByRole('button', { name: '+ Add pay item' })).not.toBeInTheDocument()
    expect(within(editor).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })
})

// Overriding what the sketch gives (Slice X.1): a site's override replaces its auto amount for that pay item
describe('SitePayItemsEditor overrides', () => {
  const SIDEWALK = AUTO_ROWS[1]
  const override = (quantity, extra = {}) => ({ id: 'ov-1', report_site_id: 's-p-1', contract_item_id: 'ci-sw', quantity,
    note: null, overrides_auto: true, pay_item_ref: '4.13 AAS', budget_code: 'HW-200(S)', description: '4in sidewalk',
    unit: 'SF', ...extra })
  const SET = { contract_item_id: 'ci-sw', action: 'site_override_set', text: 'overrode auto 180 SF → 185 SF',
    at: '2026-10-21T18:05:00', actor_name: 'Jane Doe' }

  // The backend's rows: what the last write left
  let rows
  let audit
  beforeEach(() => {
    rows = []
    audit = []
    api.listSitePayItems.mockImplementation(async () => ({ rows: structuredClone(rows), audit: structuredClone(audit) }))
    api.addSitePayItem.mockImplementation(async (_i, _r, _s, body) => {
      rows = [override(Number(body.quantity))]
      audit = [{ ...SET, text: `overrode auto 180 SF → ${body.quantity} SF` }]
      return rows[0]
    })
    api.updateSitePayItem.mockImplementation(async (_i, _r, _s, _id, body) => {
      rows = [override(Number(body.quantity))]
      audit = [{ ...SET, action: 'site_override_change', text: `changed override → ${body.quantity} SF` }]
      return rows[0]
    })
    api.removeSitePayItem.mockImplementation(async () => {
      rows = []
      audit = [{ ...SET, action: 'site_override_reset', text: 'reset to auto (180 SF)' }]
    })
  })

  const box = () => screen.findByLabelText('Auto quantity of 4.13 AAS')
  const typeInto = async (user, input, value) => {
    await user.clear(input)
    if (value) await user.type(input, value)
    await user.tab()
  }

  it('POSTs an override when an auto row goes 180 → 185, then PATCHes it on the next change', async () => {
    const user = userEvent.setup()
    const onChanged = renderEditor({ autoRows: [SIDEWALK] })
    await typeInto(user, await box(), '185')
    await waitFor(() => expect(api.addSitePayItem).toHaveBeenCalledWith('idr-1', 'rep-1', 's-p-1',
      { contract_item_id: 'ci-sw', quantity: '185', note: null, overrides_auto: true }))
    await waitFor(async () => expect(await box()).toHaveValue(185))
    expect(onChanged).toHaveBeenCalledTimes(1)

    await typeInto(user, await box(), '190')
    await waitFor(() => expect(api.updateSitePayItem).toHaveBeenCalledWith('idr-1', 'rep-1', 's-p-1', 'ov-1',
      { quantity: '190' }))
    expect(api.addSitePayItem).toHaveBeenCalledTimes(1)
    await waitFor(async () => expect(await box()).toHaveValue(190))
  })

  it('takes a lower value, 180 → 160, and 0', async () => {
    const user = userEvent.setup()
    renderEditor({ autoRows: [SIDEWALK] })
    await typeInto(user, await box(), '160')
    await waitFor(() => expect(api.addSitePayItem).toHaveBeenCalledWith('idr-1', 'rep-1', 's-p-1',
      { contract_item_id: 'ci-sw', quantity: '160', note: null, overrides_auto: true }))
    await waitFor(async () => expect(await box()).toHaveValue(160))
    await typeInto(user, await box(), '0')
    await waitFor(() => expect(api.updateSitePayItem).toHaveBeenCalledWith('idr-1', 'rep-1', 's-p-1', 'ov-1',
      { quantity: '0' }))
  })

  it('refuses a negative or a blank without calling the backend, and an unchanged value does nothing', async () => {
    const user = userEvent.setup()
    renderEditor({ autoRows: [SIDEWALK] })
    await typeInto(user, await box(), '-5')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a quantity of 0 or more')
    await typeInto(user, await box(), '')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a quantity of 0 or more')
    await typeInto(user, await box(), '180')
    expect(api.addSitePayItem).not.toHaveBeenCalled()
    expect(api.updateSitePayItem).not.toHaveBeenCalled()
  })

  it('shows an overridden row as edited, with the auto amount and the latest entry', async () => {
    rows = [override(185)]
    audit = [SET]
    renderEditor({ autoRows: [SIDEWALK] })
    expect(await box()).toHaveValue(185)
    const row = (await box()).closest('tr')
    expect(within(row).getByText('auto (8 flags, 1 segment) · edited')).toBeInTheDocument()
    expect(within(row).getByText('originally 180 SF')).toBeInTheDocument()
    expect(screen.getByTestId('override-audit-4.13 AAS|HW-200(S)'))
      .toHaveTextContent('overrode auto 180 SF → 185 SF · Jane Doe · 10/21/26 6:05 PM')
    // The override lives in its auto row, not as an entered one
    expect(screen.queryByText('entered')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('read-only, shows the override as text', async () => {
    rows = [override(185)]
    audit = [SET]
    renderEditor({ autoRows: [SIDEWALK], isReadOnly: true })
    expect(await screen.findByText('originally 180 SF')).toBeInTheDocument()
    expect(screen.getByText('185')).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Auto Calculate' })).not.toBeInTheDocument()
  })

  it('Auto Calculate DELETEs the override, re-reads the sketch and shows its value', async () => {
    rows = [override(185)]
    audit = [SET]
    const onReloadAuto = vi.fn().mockResolvedValue()
    const onChanged = renderEditor({ autoRows: [SIDEWALK], onReloadAuto })
    expect(await box()).toHaveValue(185)
    fireEvent.click(screen.getByRole('button', { name: 'Auto Calculate' }))
    await waitFor(() => expect(api.removeSitePayItem).toHaveBeenCalledWith('idr-1', 'rep-1', 's-p-1', 'ov-1'))
    await waitFor(async () => expect(await box()).toHaveValue(180))
    expect(onReloadAuto).toHaveBeenCalledTimes(1)
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/· edited/)).not.toBeInTheDocument()
    expect(screen.getByTestId('override-audit-4.13 AAS|HW-200(S)')).toHaveTextContent('reset to auto (180 SF)')
  })

  it('Auto Calculate without an override only re-reads the sketch, and resets the box', async () => {
    const user = userEvent.setup()
    const onReloadAuto = vi.fn().mockResolvedValue()
    renderEditor({ autoRows: [SIDEWALK], onReloadAuto })
    const input = await box()
    await user.clear(input)
    await user.type(input, '-1')
    fireEvent.click(screen.getByRole('button', { name: 'Auto Calculate' }))
    await waitFor(() => expect(onReloadAuto).toHaveBeenCalledTimes(1))
    expect(api.removeSitePayItem).not.toHaveBeenCalled()
    await waitFor(async () => expect(await box()).toHaveValue(180))
  })

  it('lists an override whose pay item has no auto row left as such, with Delete', async () => {
    rows = [override(185)]
    renderEditor({ autoRows: [AUTO_ROWS[0]] })
    const quantity = await screen.findByLabelText('Quantity of 4.13 AAS')
    expect(quantity).toHaveValue(185)
    const row = quantity.closest('tr')
    expect(within(row).getByText('override (no flags left)')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('auditLine joins the text, who and when', () => {
    expect(auditLine(SET)).toBe('overrode auto 180 SF → 185 SF · Jane Doe · 10/21/26 6:05 PM')
    expect(auditLine({ text: 'reset to auto (180 SF)', actor_name: null, at: null })).toBe('reset to auto (180 SF)')
  })
})
