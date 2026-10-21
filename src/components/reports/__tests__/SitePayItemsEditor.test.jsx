import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SitePayItemsEditor from '../SitePayItemsEditor'
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
  api.listSitePayItems.mockResolvedValue([])
})

function renderEditor(props = {}) {
  const onChanged = vi.fn()
  render(<SitePayItemsEditor idrId="idr-1" reportId="rep-1" site={SITE} contractItems={[CONTRACT_ITEM]}
    isReadOnly={false} onChanged={onChanged} {...props} />)
  return onChanged
}

const AUTO_ROWS = [
  { key: '4.08 AA|HW-200(S)', pay_item_ref: '4.08 AA', budget_code: 'HW-200(S)', description: 'Concrete curb', unit: 'LF',
    amount: 20, flags: 0, segments: 1 },
  { key: '4.13 AAS|HW-200(S)', pay_item_ref: '4.13 AAS', budget_code: 'HW-200(S)', description: '4in sidewalk', unit: 'SF',
    amount: 180, flags: 8, segments: 1 },
]

describe('SitePayItemsEditor', () => {
  it('lists the auto rows first, read-only, then the entered ones, each with its source', async () => {
    api.listSitePayItems.mockResolvedValue([PAY_ITEM])
    renderEditor({ autoRows: AUTO_ROWS })
    const table = await screen.findByRole('table', { name: 'Pay items for this site' })
    await within(table).findByLabelText('Quantity of 6.70 AB')
    const rows = within(table).getAllByRole('row')
    expect(rows[0].textContent).toBe('ItemDescriptionQuantityUnitSourceActions')
    expect(rows[1].textContent).toBe('4.08 AA (HW-200(S))Concrete curb20LFauto (1 segment)from the sketch')
    expect(rows[2].textContent).toBe('4.13 AAS (HW-200(S))4in sidewalk180SFauto (8 flags, 1 segment)from the sketch')
    expect(within(rows[3]).getByText('entered')).toBeInTheDocument()
    for (const row of rows.slice(1, 3)) {
      expect(within(row).queryByRole('spinbutton')).not.toBeInTheDocument()
      expect(within(row).queryByRole('button')).not.toBeInTheDocument()
    }
  })

  it("shows the picked pay item's unit in the add row", async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByText('No pay items for this site yet.')
    await user.selectOptions(screen.getByLabelText('Pay item'), 'ci-1')
    expect(screen.getAllByRole('row').at(-1)).toHaveTextContent('LS')
  })


  it("lists the site's pay items with their quantity and note", async () => {
    api.listSitePayItems.mockResolvedValue([PAY_ITEM])
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
    api.listSitePayItems.mockResolvedValue([PAY_ITEM])
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
    api.listSitePayItems.mockResolvedValue([PAY_ITEM])
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
