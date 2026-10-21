import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SitePayItemsEditor from '../SitePayItemsEditor'
import * as api from '../../../services/api'

// The pay items entered by hand on one imported site (Slice V1), now shown on the site's own page (W3)

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

describe('SitePayItemsEditor', () => {
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
    await screen.findByText('No pay items entered on this site.')
    await user.selectOptions(screen.getByLabelText('Pay item'), 'ci-1')
    await user.type(screen.getByLabelText('Quantity'), '12.5')
    await user.type(screen.getByLabelText('Note'), ' MTP ')
    await user.click(screen.getByRole('button', { name: 'Add pay item' }))
    await waitFor(() => expect(api.addSitePayItem).toHaveBeenCalledWith('idr-1', 'rep-1', 's-p-1',
      { contract_item_id: 'ci-1', quantity: '12.5', note: 'MTP' }))
    expect(await screen.findByLabelText('Quantity of 6.70 AB')).toBeInTheDocument()
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('refuses a quantity not above 0 without calling the backend', async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByText('No pay items entered on this site.')
    await user.selectOptions(screen.getByLabelText('Pay item'), 'ci-1')
    await user.type(screen.getByLabelText('Quantity'), '0')
    await user.click(screen.getByRole('button', { name: 'Add pay item' }))
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
    await user.click(within(editor).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(api.removeSitePayItem).toHaveBeenCalledWith('idr-1', 'rep-1', 's-p-1', 'sp-1'))
    expect(await screen.findByText('No pay items entered on this site.')).toBeInTheDocument()
  })

  it('read-only, lists them without Add or Remove', async () => {
    api.listSitePayItems.mockResolvedValue([PAY_ITEM])
    renderEditor({ isReadOnly: true })
    const editor = await screen.findByLabelText('Pay items at 138-22 227 Street')
    expect(await within(editor).findByText('12.5 LS')).toBeInTheDocument()
    expect(within(editor).queryByRole('button', { name: 'Add pay item' })).not.toBeInTheDocument()
    expect(within(editor).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })
})
