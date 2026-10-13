import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PayItemImportModal, { MAX_IMPORT_BYTES, overwriteChanges } from '../PayItemImportModal'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({ previewPayItemImport: vi.fn(), commitPayItemImport: vi.fn() }))

const values = (pay_item_ref, budget_code, description, unit, quantity, unit_price, spec_section = null) => (
  { pay_item_ref, budget_code, description, unit, quantity, unit_price, spec_section }
)
const EXISTING = { pay_item_uuid: 'b0000000-0000-4000-8000-000000000001',
  ...values('6.02', 'EP0007-CONS', 'Steel faced curb', 'LF', 171.5, 42.25) }

// A file every row of which can be imported: two new items and one overwrite
const CLEAN = {
  parsed_rows: 3, new_count: 2, overwrite_count: 1, error_count: 0, ignored_columns: [],
  new: [
    { row: 2, ...values('4.13 AAS', 'HW0001Q-CONS', '4" concrete sidewalk', 'SF', 12500, 9.5) },
    { row: 4, ...values('10.02', 'EP0007-CONS', 'Asphaltic concrete', 'TN', 3.2, 185) },
  ],
  overwrites: [{ row: 3, pay_item_ref: '6.02', budget_code: 'EP0007-CONS', existing: EXISTING,
    incoming: values('6.02', 'EP0007-CONS', 'Steel faced curb', 'LF', 2000, 45, '6.02') }],
  errors: [],
}
// The same file with two rows that can't be
const BROKEN = {
  ...CLEAN, parsed_rows: 5, error_count: 2, ignored_columns: ['Notes', 'Owner'],
  errors: [
    { row: 5, reason: "quantity must be a number: 'lots'", raw: { pay_item_ref: '7.13 B', description: 'Warning units',
      quantity: 'lots', unit: 'SF', unit_price: '12', budget_code: 'HW0001Q-CONS' } },
    { row: 6, reason: 'unit cannot be blank', raw: { pay_item_ref: '8.01', description: '', quantity: '1', unit: '',
      unit_price: '2', budget_code: 'HW0001Q-CONS' } },
  ],
}
const EMPTY = { parsed_rows: 0, new_count: 0, overwrite_count: 0, error_count: 0, ignored_columns: [], new: [],
  overwrites: [], errors: [] }

const FILE = new File(['pay_item_ref,description\n'], 'items.csv', { type: 'text/csv' })

beforeEach(() => {
  vi.clearAllMocks()
  api.previewPayItemImport.mockResolvedValue(CLEAN)
  api.commitPayItemImport.mockResolvedValue({ inserted: 2, updated: 1 })
})

function renderModal() {
  const onClose = vi.fn()
  const onImported = vi.fn()
  render(<PayItemImportModal projectId="HWS0023" onClose={onClose} onImported={onImported} />)
  return { onClose, onImported }
}

const fileInput = () => screen.getByLabelText('CSV file')
const button = (name) => screen.getByRole('button', { name })
const section = (title) => screen.getByText(title).closest('details')
const counts = () => screen.getByLabelText('Preview counts')

async function toPreview(preview = CLEAN) {
  api.previewPayItemImport.mockResolvedValue(preview)
  await userEvent.upload(fileInput(), FILE)
  await userEvent.click(button('Preview'))
}

describe('PayItemImportModal — upload', () => {
  it('opens on a CSV file input with the instructions and Preview off', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Import Pay Items' })).toBeInTheDocument()
    expect(fileInput()).toHaveAttribute('type', 'file')
    expect(fileInput()).toHaveAttribute('accept', '.csv,text/csv')
    expect(fileInput()).toHaveAccessibleDescription('Required columns: pay_item_ref, description, quantity, unit, '
      + 'unit_price, budget_code. Optional: spec_section. First row is headers (case-insensitive). Max 2 MB.')
    expect(button('Preview')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Confirm import' })).not.toBeInTheDocument()
  })

  it('turns Preview on once a file is picked', async () => {
    renderModal()
    await userEvent.upload(fileInput(), FILE)
    expect(button('Preview')).toBeEnabled()
    expect(api.previewPayItemImport).not.toHaveBeenCalled()
  })

  it('refuses a file over 2 MB before asking the backend', async () => {
    renderModal()
    const big = new File([new Uint8Array(MAX_IMPORT_BYTES + 1)], 'big.csv', { type: 'text/csv' })
    await userEvent.upload(fileInput(), big)
    expect(screen.getByRole('alert')).toHaveTextContent('That file is larger than 2 MB.')
    expect(button('Preview')).toBeDisabled()
  })

  it('asks for a preview of the picked file and shows its counts', async () => {
    renderModal()
    await toPreview()
    expect(api.previewPayItemImport).toHaveBeenCalledTimes(1)
    expect(api.previewPayItemImport).toHaveBeenCalledWith('HWS0023', FILE)
    expect(counts()).toHaveTextContent('2 new | 1 overwrite | 0 errors')
    expect(screen.queryByLabelText('CSV file')).not.toBeInTheDocument()
    expect(api.commitPayItemImport).not.toHaveBeenCalled()
  })

  it('shows why a file was refused, inline, and stays for another try', async () => {
    api.previewPayItemImport.mockRejectedValueOnce(
      Object.assign(new Error('The file is missing the required column(s): unit, budget_code'), { status: 400 }))
    renderModal()
    await userEvent.upload(fileInput(), FILE)
    await userEvent.click(button('Preview'))
    expect(screen.getByRole('alert')).toHaveTextContent('The file is missing the required column(s): unit, budget_code')
    expect(fileInput()).toBeInTheDocument()
    expect(screen.queryByLabelText('Preview counts')).not.toBeInTheDocument()

    await userEvent.click(button('Preview'))
    expect(api.previewPayItemImport).toHaveBeenCalledTimes(2)
    expect(counts()).toBeInTheDocument()
    expect(screen.queryByText(/missing the required column/)).not.toBeInTheDocument()
  })

  it('locks itself while the file is read', async () => {
    let finish
    api.previewPayItemImport.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderModal()
    await userEvent.upload(fileInput(), FILE)
    await userEvent.click(button('Preview'))
    expect(button('Reading...')).toBeDisabled()
    expect(button('Cancel')).toBeDisabled()
    await act(async () => finish(CLEAN))
  })

  it('cancels without asking the backend anything', async () => {
    const { onClose, onImported } = renderModal()
    await userEvent.upload(fileInput(), FILE)
    await userEvent.click(button('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onImported).not.toHaveBeenCalled()
    expect(api.previewPayItemImport).not.toHaveBeenCalled()
  })
})

describe('PayItemImportModal — a preview with no errors', () => {
  it('colours the counts, says it is ready and lets the import be confirmed', async () => {
    renderModal()
    await toPreview()
    expect(within(counts()).getByText('2 new')).toHaveClass('text-green-700')
    expect(within(counts()).getByText('1 overwrite')).toHaveClass('text-blue-700')
    expect(within(counts()).getByText('0 errors')).toHaveClass('text-red-700')
    expect(screen.getByRole('status')).toHaveTextContent('Ready to import 3 pay items.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Errors/)).not.toBeInTheDocument()
    expect(button('Confirm import')).toBeEnabled()
  })

  it('lists the new items and the overwrites, both folded away to start', async () => {
    renderModal()
    await toPreview()
    expect(section('New (2)')).not.toHaveAttribute('open')
    expect(section('Overwrites (1)')).not.toHaveAttribute('open')
    expect(within(section('New (2)')).getAllByRole('listitem').map(li => li.textContent)).toEqual([
      '4.13 AAS @ HW0001Q-CONS4" concrete sidewalk — 12,500 SF at $9.50',
      '10.02 @ EP0007-CONSAsphaltic concrete — 3.2 TN at $185.00',
    ])
  })

  it('shows what each overwrite would change, existing → incoming', async () => {
    renderModal()
    await toPreview()
    const overwrite = within(section('Overwrites (1)')).getByRole('listitem')
    expect(within(overwrite).getByText('6.02 @ EP0007-CONS')).toBeInTheDocument()
    expect(within(overwrite).getAllByText(/→/).map(line => line.textContent)).toEqual([
      'Quantity: 171.5 → 2,000',
      'Unit price: $42.25 → $45.00',
      'Spec section: — → 6.02',
    ])
  })

  it('reads an overwrite\'s changes field by field, and none when the row matches', () => {
    const incoming = values('6.02', 'EP0007-CONS', 'Steel-faced curb', 'FT', 171.5, 42.25)
    expect(overwriteChanges({ existing: EXISTING, incoming })).toEqual([
      { label: 'Description', from: 'Steel faced curb', to: 'Steel-faced curb' },
      { label: 'Unit', from: 'LF', to: 'FT' },
    ])
    expect(overwriteChanges({ existing: EXISTING, incoming: values('6.02', 'EP0007-CONS', 'Steel faced curb', 'LF', 171.5, 42.25) }))
      .toEqual([])
  })

  it('sends the same file again to import it, then reports the result and closes', async () => {
    const { onClose, onImported } = renderModal()
    await toPreview()
    await userEvent.click(button('Confirm import'))
    expect(api.commitPayItemImport).toHaveBeenCalledTimes(1)
    expect(api.commitPayItemImport).toHaveBeenCalledWith('HWS0023', FILE)
    expect(onImported).toHaveBeenCalledWith({ inserted: 2, updated: 1 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('goes back to the upload screen when the import is refused because the file changed', async () => {
    api.commitPayItemImport.mockRejectedValueOnce(Object.assign(
      new Error('The file has 1 row(s) with errors; fix them and upload it again'), { status: 400 }))
    const { onClose, onImported } = renderModal()
    await toPreview()
    await userEvent.click(button('Confirm import'))
    expect(screen.getByRole('alert')).toHaveTextContent('The file changed since the preview. Re-upload to try again.')
    expect(fileInput()).toBeInTheDocument()
    expect(button('Preview')).toBeDisabled() // the file has to be picked again
    expect(onImported).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stays on the preview with the reason when the import fails for another cause', async () => {
    api.commitPayItemImport.mockRejectedValueOnce(Object.assign(new Error('Failed to import pay items'), { status: 500 }))
    const { onClose } = renderModal()
    await toPreview()
    await userEvent.click(button('Confirm import'))
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to import pay items')
    expect(counts()).toBeInTheDocument()
    expect(button('Confirm import')).toBeEnabled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('goes Back to an empty upload screen', async () => {
    renderModal()
    await toPreview()
    await userEvent.click(button('Back'))
    expect(fileInput()).toBeInTheDocument()
    expect(button('Preview')).toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('cancels without importing', async () => {
    const { onClose, onImported } = renderModal()
    await toPreview()
    await userEvent.click(button('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onImported).not.toHaveBeenCalled()
    expect(api.commitPayItemImport).not.toHaveBeenCalled()
  })
})

describe('PayItemImportModal — a preview that can\'t be imported', () => {
  it('says the file has errors, keeps Confirm import off and opens the errors', async () => {
    renderModal()
    await toPreview(BROKEN)
    expect(counts()).toHaveTextContent('2 new | 1 overwrite | 2 errors')
    expect(screen.getByRole('alert'))
      .toHaveTextContent("This CSV has 2 errors and can't be imported. Fix them and re-upload.")
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(button('Confirm import')).toBeDisabled()
    expect(section('Errors (2)')).toHaveAttribute('open')
    expect(section('New (2)')).not.toHaveAttribute('open')
  })

  it('lists each error with its row, the reason and the row\'s cells as typed', async () => {
    renderModal()
    await toPreview(BROKEN)
    expect(within(section('Errors (2)')).getAllByRole('listitem').map(li => li.textContent)).toEqual([
      "Row 5: quantity must be a number: 'lots'"
        + 'pay_item_ref: 7.13 B · description: Warning units · quantity: lots · unit: SF · unit_price: 12 · budget_code: HW0001Q-CONS',
      'Row 6: unit cannot be blank'
        + 'pay_item_ref: 8.01 · quantity: 1 · unit_price: 2 · budget_code: HW0001Q-CONS',
    ])
  })

  it('names the columns the backend ignored', async () => {
    renderModal()
    await toPreview(BROKEN)
    expect(screen.getByText('Ignored columns: Notes, Owner.')).toBeInTheDocument()
  })

  it('counts one error as one', async () => {
    renderModal()
    await toPreview({ ...BROKEN, error_count: 1, errors: [BROKEN.errors[0]] })
    expect(screen.getByRole('alert')).toHaveTextContent("This CSV has 1 error and can't be imported.")
  })

  it('keeps Confirm import off for a file with no rows', async () => {
    renderModal()
    await toPreview(EMPTY)
    expect(counts()).toHaveTextContent('0 new | 0 overwrites | 0 errors')
    expect(screen.getByRole('alert')).toHaveTextContent('This CSV has no pay items to import.')
    expect(button('Confirm import')).toBeDisabled()
  })
})
