import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PayItemsReview from '../PayItemsReview'
import { RedlineProvider } from '../../../contexts/RedlineContext'
import { MOCK_CONTRACT_ITEMS } from '../../../test/contractItems'

const REPORT = 'rep-1'
const SIDEWALK = { id: 'item-1', itemNo: '4.13 AAS', budgetCode: '12345', payQuantity: '60.00', unit: 'S.F.', description: 'Sidewalk' }
const CURB = { id: 'item-2', itemNo: '4.08 AA', budgetCode: '12345', payQuantity: '29.00', unit: 'L.F.', description: 'Curb' }

function revision(n, itemId, oldValue, newValue, initials) {
  return {
    edit_id: `rev-${n}`, report_id: REPORT, field_path: `payItems[${itemId}].payQuantity`, edit_type: 'pay_item_revision',
    old_value: oldValue, new_value: newValue, editor_initials: initials, editor_name: `Editor ${initials}`,
  }
}

function addition(item, initials) {
  return {
    edit_id: `add-${item.id}`, report_id: REPORT, field_path: `payItems[${item.id}]`, edit_type: 'pay_item_add',
    old_value: null, new_value: item, editor_initials: initials, editor_name: `Editor ${initials}`,
  }
}

const ME = 'user-me'

function approval(n, itemId, quantity, initials, overrides = {}) {
  return {
    edit_id: `app-${n}`, report_id: REPORT, field_path: `payItems[${itemId}]`, edit_type: 'pay_item_approve',
    old_value: quantity, new_value: quantity, editor_initials: initials, editor_name: `Editor ${initials}`,
    editor_uuid: `user-${initials}`, editor_stage: 'stage1', ...overrides,
  }
}

let revise
let addItem
let approve

// attesting: who is approving pay items here ({userUuid, stage, acceptedAt}); null for someone who may not.
// acceptedAt: when each stage was last accepted, as every reader of the table gets it
function renderTable({
  payItems = [SIDEWALK, CURB], edits = [], canEdit = false, attesting = null, highlightItemId = null, acceptedAt,
} = {}) {
  return render(
    <RedlineProvider
      value={{
        reportId: REPORT, edits, isDraft: false, canEdit, saveField: vi.fn(), revise, addItem, approve, attesting, highlightItemId,
        acceptedAt: acceptedAt ?? attesting?.acceptedAt,
      }}
    >
      <PayItemsReview payItems={payItems} contractItems={MOCK_CONTRACT_ITEMS} />
    </RedlineProvider>
  )
}

// Every body row as [kind, cell texts...], top to bottom
const rows = () => screen.getAllByRole('row').slice(1).map(row => [
  row.dataset.testid, ...within(row).getAllByRole('cell').slice(0, 5).map(cell => cell.textContent),
])
const reviseButton = n => screen.queryByRole('button', { name: `Revise the quantity of pay item ${n}` })

beforeEach(() => {
  revise = vi.fn().mockResolvedValue({ ok: true })
  addItem = vi.fn().mockResolvedValue({ ok: true })
  approve = vi.fn().mockResolvedValue({ ok: true })
})

describe('PayItemsReview — the rows', () => {
  it('shows each item once, as text, when nobody revised anything', () => {
    renderTable()
    expect(rows()).toEqual([
      ['pay-item-row', '4.13 AAS', '12345', '60.00', 'S.F.', 'Sidewalk'],
      ['pay-item-row', '4.08 AA', '12345', '29.00', 'L.F.', 'Curb'],
    ])
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it("keeps the inspector's row with its quantity crossed out and adds a blue row with the revision and initials", () => {
    // the report already holds the revised quantity; the inspector's is the revision's old value
    renderTable({ payItems: [{ ...SIDEWALK, payQuantity: '55.00' }, CURB], edits: [revision(1, 'item-1', '60.00', '55.00', 'OE')] })
    expect(rows()).toEqual([
      ['pay-item-row', '4.13 AAS', '12345', '60.00', 'S.F.', 'Sidewalk'],
      ['pay-item-revision', '4.13 AAS', '12345', '55.00OE', 'S.F.', 'Sidewalk'],
      ['pay-item-row', '4.08 AA', '12345', '29.00', 'L.F.', 'Curb'],
    ])
    const [inspector, revised] = screen.getAllByRole('row').slice(1)
    expect(within(inspector).getByText('60.00')).toHaveClass('line-through')
    expect(inspector).not.toHaveTextContent('OE') // no initials on the inspector's row
    expect(revised).toHaveClass('text-[#0070C0]')
    expect(within(revised).getByText('55.00')).not.toHaveClass('line-through') // the quantity that counts
  })

  it('stacks a second revision under the first, striking the one it replaced', () => {
    renderTable({
      payItems: [{ ...SIDEWALK, payQuantity: '57.25' }],
      edits: [revision(1, 'item-1', '60.00', '55.00', 'OE'), revision(2, 'item-1', '55.00', '57.25', 'RR')],
    })
    expect(rows().map(row => [row[0], row[3]])).toEqual([
      ['pay-item-row', '60.00'], ['pay-item-revision', '55.00OE'], ['pay-item-revision', '57.25RR'],
    ])
    expect(screen.getByText('55.00')).toHaveClass('line-through')
    expect(screen.getByText('57.25')).not.toHaveClass('line-through')
  })

  it('shows an item a reviewer added as a blue row with the adder\'s initials', () => {
    const added = { id: 'item-3', itemNo: '4.05 A', budgetCode: '12345', payQuantity: '12.50', unit: 'C.Y.', description: 'Concrete base' }
    renderTable({ payItems: [SIDEWALK, added], edits: [addition(added, 'OE')] })
    expect(rows()[1]).toEqual(['pay-item-row', '4.05 A', '12345', '12.50OE', 'C.Y.', 'Concrete base'])
    const row = screen.getAllByRole('row')[2]
    expect(within(row).getByText('4.05 A').closest('td')).toHaveClass('text-[#0070C0]')
    expect(within(row).getByText('12.50')).not.toHaveClass('line-through') // nothing of an inspector's to cross out
    expect(screen.getAllByRole('row')[1]).not.toHaveTextContent('OE')
  })

  it('shows a later revision of an added item under it', () => {
    const added = { id: 'item-3', itemNo: '4.05 A', budgetCode: '', payQuantity: '14.00', unit: 'C.Y.', description: 'Base' }
    renderTable({ payItems: [added], edits: [addition({ ...added, payQuantity: '12.50' }, 'OE'), revision(1, 'item-3', '12.50', '14.00', 'RR')] })
    expect(rows().map(row => [row[0], row[3]])).toEqual([['pay-item-row', '12.50OE'], ['pay-item-revision', '14.00RR']])
  })

  it('notes a quantity the inspector changed after the last revision, on a row of its own', () => {
    renderTable({ payItems: [{ ...SIDEWALK, payQuantity: '58.00' }], edits: [revision(1, 'item-1', '60.00', '55.00', 'OE')] })
    expect(rows().map(row => [row[0], row[3]])).toEqual([
      ['pay-item-row', '60.00'], ['pay-item-revision', '55.00OE'],
      ['pay-item-revised-after', '58.00Inspector revised after return'],
    ])
    expect(screen.getByText('55.00')).toHaveClass('line-through') // no longer the quantity that counts
  })

  it('treats 55 and 55.00 as the same quantity', () => {
    renderTable({ payItems: [{ ...SIDEWALK, payQuantity: '55' }], edits: [revision(1, 'item-1', '60.00', '55.00', 'OE')] })
    expect(screen.queryByText('Inspector revised after return')).not.toBeInTheDocument()
  })

  it('draws an edit of another pay-item field as a redline in its cell', () => {
    const edits = [{ edit_id: 'e1', report_id: REPORT, field_path: 'payItems[item-2].budgetCode', edit_type: 'field_change',
      old_value: '12345', new_value: '67890', editor_initials: 'OE', editor_name: 'Olive Engineer' }]
    renderTable({ payItems: [SIDEWALK, { ...CURB, budgetCode: '67890' }], edits })
    expect(rows()[1][2]).toBe('1234567890OE')
  })

  it('says so when the report has no pay items', () => {
    renderTable({ payItems: [] })
    expect(screen.getByText('No pay items.')).toBeInTheDocument()
  })

  it("ignores another report's revisions", () => {
    renderTable({ edits: [{ ...revision(1, 'item-1', '60.00', '55.00', 'OE'), report_id: 'rep-2' }] })
    expect(rows()).toHaveLength(2)
  })
})

describe('PayItemsReview — Revise', () => {
  it('is offered per item in edit mode only', () => {
    const { unmount } = renderTable()
    expect(reviseButton(1)).not.toBeInTheDocument()
    unmount()
    renderTable({ canEdit: true })
    expect(reviseButton(1)).toBeInTheDocument()
    expect(reviseButton(2)).toBeInTheDocument()
  })

  it('is not offered for an item without an id', () => {
    renderTable({ canEdit: true, payItems: [{ ...SIDEWALK, id: undefined }, CURB] })
    expect(reviseButton(1)).not.toBeInTheDocument()
    expect(reviseButton(2)).toBeInTheDocument()
  })

  it('asks for a number and revises by the item\'s id, not its position', async () => {
    const user = userEvent.setup()
    renderTable({ canEdit: true })
    await user.click(reviseButton(2))
    const dialog = screen.getByRole('dialog', { name: 'Revise quantity' })
    expect(dialog).toHaveTextContent('4.08 AA — Curb · now 29.00 L.F.')
    const input = within(dialog).getByLabelText('New quantity')
    expect(input).toHaveAttribute('type', 'number')
    expect(within(dialog).getByRole('button', { name: 'Revise' })).toBeDisabled()
    await user.type(input, '31.5')
    await user.click(within(dialog).getByRole('button', { name: 'Revise' }))
    expect(revise).toHaveBeenCalledWith('item-2', '31.5')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('will not revise to the quantity the item already has', async () => {
    const user = userEvent.setup()
    renderTable({ canEdit: true })
    await user.click(reviseButton(1))
    await user.type(screen.getByLabelText('New quantity'), '60')
    expect(screen.getByRole('button', { name: 'Revise' })).toBeDisabled()
    expect(revise).not.toHaveBeenCalled()
  })

  it('keeps the dialog open with the reason when the revision is refused', async () => {
    revise.mockResolvedValue({ ok: false, message: 'Pay item not found in this IDR' })
    const user = userEvent.setup()
    renderTable({ canEdit: true })
    await user.click(reviseButton(1))
    await user.type(screen.getByLabelText('New quantity'), '55')
    await user.click(screen.getByRole('button', { name: 'Revise' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Pay item not found in this IDR')
    expect(screen.getByRole('dialog', { name: 'Revise quantity' })).toBeInTheDocument()
  })

  it('closes on a conflict: the page has reloaded and said so', async () => {
    revise.mockResolvedValue({ ok: false, conflict: true })
    const user = userEvent.setup()
    renderTable({ canEdit: true })
    await user.click(reviseButton(1))
    await user.type(screen.getByLabelText('New quantity'), '55')
    await user.click(screen.getByRole('button', { name: 'Revise' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does nothing on Cancel', async () => {
    const user = userEvent.setup()
    renderTable({ canEdit: true })
    await user.click(reviseButton(1))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(revise).not.toHaveBeenCalled()
  })
})

describe('PayItemsReview — Add Pay Item', () => {
  const addButton = () => screen.queryByRole('button', { name: 'Add Pay Item' })
  const catalogItem = MOCK_CONTRACT_ITEMS[0]

  it('is offered in edit mode only', () => {
    const { unmount } = renderTable()
    expect(addButton()).not.toBeInTheDocument()
    unmount()
    renderTable({ canEdit: true })
    expect(addButton()).toBeInTheDocument()
  })

  it('fills the item from the catalog pick and adds it with the quantity', async () => {
    const user = userEvent.setup()
    renderTable({ canEdit: true })
    await user.click(addButton())
    const dialog = screen.getByRole('dialog', { name: 'Add Pay Item' })
    expect(within(dialog).getByRole('button', { name: 'Add' })).toBeDisabled()
    await user.selectOptions(within(dialog).getByLabelText('Item'), catalogItem.item_no)
    expect(within(dialog).getByLabelText('Item No.')).toHaveValue(catalogItem.item_no)
    expect(within(dialog).getByLabelText('Description')).toHaveValue(catalogItem.description)
    expect(within(dialog).getByLabelText('Unit')).toHaveValue(catalogItem.pay_unit)
    await user.type(within(dialog).getByLabelText('Quantity'), '12.5')
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
    expect(addItem).toHaveBeenCalledTimes(1)
    expect(addItem.mock.calls[0][0]).toMatchObject({
      itemNo: catalogItem.item_no, quantity: '12.5', unit: catalogItem.pay_unit, description: catalogItem.description,
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('takes an item typed by hand', async () => {
    const user = userEvent.setup()
    renderTable({ canEdit: true })
    await user.click(addButton())
    await user.selectOptions(screen.getByLabelText('Item'), 'Enter manually')
    await user.type(screen.getByLabelText('Description'), ' Extra work ')
    await user.type(screen.getByLabelText('Quantity'), '1')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(addItem).toHaveBeenCalledWith({ itemNo: '', budgetCode: '', quantity: '1', unit: '', description: 'Extra work' })
  })

  it('needs a quantity and either an item number or a description', async () => {
    const user = userEvent.setup()
    renderTable({ canEdit: true })
    await user.click(addButton())
    await user.type(screen.getByLabelText('Quantity'), '1')
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    await user.type(screen.getByLabelText('Item No.'), '9.99')
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled()
    await user.clear(screen.getByLabelText('Quantity'))
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('keeps the form open with the reason when the add is refused', async () => {
    addItem.mockResolvedValue({ ok: false, message: 'This kind of report has no pay items' })
    const user = userEvent.setup()
    renderTable({ canEdit: true })
    await user.click(addButton())
    await user.type(screen.getByLabelText('Item No.'), '9.99')
    await user.type(screen.getByLabelText('Quantity'), '1')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This kind of report has no pay items')
    expect(screen.getByLabelText('Item No.')).toHaveValue('9.99')
  })
})

describe('PayItemsReview — Approve', () => {
  const REVIEWER = { userUuid: ME, stage: 'stage1', acceptedAt: { stage1: null, stage2: null } }
  const mine = (n, itemId, quantity, overrides) => approval(n, itemId, quantity, 'ME', { editor_uuid: ME, ...overrides })
  const approveButton = n => screen.queryByRole('button', { name: `Approve pay item ${n}` })
  const quantityCell = row => within(screen.getAllByRole('row')[row]).getAllByRole('cell')[2]

  it('is offered on every item to the stage\'s reviewer, without edit mode', () => {
    renderTable({ attesting: REVIEWER })
    expect(approveButton(1)).toBeInTheDocument()
    expect(approveButton(2)).toBeInTheDocument()
    expect(reviseButton(1)).not.toBeInTheDocument() // Revise still needs edit mode
  })

  it('is not offered to anyone else', () => {
    renderTable({ canEdit: false, attesting: null })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('is not offered for an item without an id', () => {
    renderTable({ payItems: [{ ...SIDEWALK, id: undefined }], attesting: REVIEWER })
    expect(approveButton(1)).not.toBeInTheDocument()
  })

  it('approves the item by its id', async () => {
    const user = userEvent.setup()
    renderTable({ attesting: REVIEWER })
    await user.click(approveButton(2))
    expect(approve).toHaveBeenCalledWith('item-2')
  })

  it('shows why an approval was refused', async () => {
    approve.mockResolvedValue({ ok: false, message: 'Pay item not found in this IDR' })
    const user = userEvent.setup()
    renderTable({ attesting: REVIEWER })
    await user.click(approveButton(1))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't approve the item: Pay item not found in this IDR")
  })

  it('says nothing more on a conflict: the page has reloaded and said so', async () => {
    approve.mockResolvedValue({ ok: false, conflict: true })
    const user = userEvent.setup()
    renderTable({ attesting: REVIEWER })
    await user.click(approveButton(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['approved it', [mine(1, 'item-1', '60.00')]],
    ['revised it', [{ ...revision(1, 'item-1', '70.00', '60.00', 'ME'), editor_uuid: ME, editor_stage: 'stage1' }]],
    ['added it', [{ ...addition(SIDEWALK, 'ME'), editor_uuid: ME, editor_stage: 'stage1' }]],
  ])('is hidden on an item once the reviewer has %s at this stage', (_, edits) => {
    renderTable({ edits, attesting: REVIEWER })
    expect(approveButton(1)).not.toBeInTheDocument()
    expect(approveButton(2)).toBeInTheDocument()
  })

  it('comes back when the approval was of a quantity the item no longer has', () => {
    renderTable({ payItems: [{ ...SIDEWALK, payQuantity: '55.00' }], edits: [mine(1, 'item-1', '60.00')], attesting: REVIEWER })
    expect(approveButton(1)).toBeInTheDocument()
  })

  it('is still offered when only someone else, or the reviewer at another stage, approved', () => {
    renderTable({
      edits: [approval(1, 'item-1', '60.00', 'OE'), mine(2, 'item-2', '29.00', { editor_stage: 'stage2' })],
      attesting: REVIEWER,
    })
    expect(approveButton(1)).toBeInTheDocument()
    expect(approveButton(2)).toBeInTheDocument()
  })

  it('comes back for an item the reviewer approved in an earlier round, with that approval greyed out', () => {
    const acceptedAt = { stage1: '2026-10-05T14:00:00Z', stage2: null }
    renderTable({
      edits: [mine(1, 'item-1', '60.00', { edited_at: '2026-10-01T09:00:00Z' }), mine(2, 'item-2', '29.00', { edited_at: '2026-10-05T15:00:00Z' })],
      attesting: { ...REVIEWER, acceptedAt },
    })
    expect(approveButton(1)).toBeInTheDocument()
    expect(approveButton(2)).not.toBeInTheDocument()
    const earlier = within(quantityCell(1)).getByText('ME')
    expect(earlier).toHaveAttribute('data-stale', 'true')
    expect(earlier).toHaveAttribute('title', 'Approval superseded — re-approve or revise to attest.')
    expect(within(quantityCell(2)).getByText('ME')).not.toHaveAttribute('data-stale')
  })

  it('greys an earlier round\'s approval for every reader, not only the reviewer', () => {
    renderTable({
      edits: [approval(1, 'item-1', '60.00', 'RR', { editor_stage: 'stage2', edited_at: '2026-10-01T09:00:00Z' })],
      acceptedAt: { stage1: null, stage2: '2026-10-05T14:00:00Z' },
    })
    expect(within(quantityCell(1)).getByText('RR')).toHaveAttribute('data-stale', 'true')
  })

  it('shows each approver\'s initials beside the quantity, side by side', () => {
    renderTable({
      edits: [approval(1, 'item-1', '60.00', 'OE'), approval(2, 'item-1', '60.00', 'RR', { editor_stage: 'stage2' })],
    })
    expect(quantityCell(1)).toHaveTextContent('60.00OERR')
    expect(within(quantityCell(1)).getByText('OE')).toHaveAttribute('title', 'Editor OE')
    expect(quantityCell(2)).toHaveTextContent(/^29.00$/)
  })

  it('puts the initials on the row that holds the current quantity', () => {
    renderTable({
      payItems: [{ ...SIDEWALK, payQuantity: '55.00' }],
      edits: [revision(1, 'item-1', '60.00', '55.00', 'OE'), approval(2, 'item-1', '55.00', 'RR', { editor_stage: 'stage2' })],
    })
    expect(quantityCell(1)).toHaveTextContent(/^60.00$/)
    expect(quantityCell(2)).toHaveTextContent('55.00OERR')
  })

  it('greys out an approval of a quantity the item no longer has, with a tooltip saying so', () => {
    renderTable({
      payItems: [{ ...SIDEWALK, payQuantity: '55.00' }],
      edits: [approval(1, 'item-1', '60.00', 'OE'), revision(2, 'item-1', '60.00', '55.00', 'RR')],
    })
    const stale = within(quantityCell(2)).getByText('OE')
    expect(stale).toHaveAttribute('title', 'Approval superseded — re-approve or revise to attest.')
    expect(stale).toHaveAttribute('data-stale', 'true')
    expect(stale).toHaveClass('line-through')
    expect(within(quantityCell(2)).getByText('RR')).not.toHaveAttribute('data-stale')
  })

  it('shows only a reviewer\'s latest approval at a stage', () => {
    renderTable({
      payItems: [{ ...SIDEWALK, payQuantity: '55.00' }],
      edits: [
        approval(1, 'item-1', '60.00', 'OE'), revision(2, 'item-1', '60.00', '55.00', 'RR'), approval(3, 'item-1', '55.00', 'OE'),
      ],
    })
    const badges = within(quantityCell(2)).getAllByText('OE')
    expect(badges).toHaveLength(1)
    expect(badges[0]).not.toHaveAttribute('data-stale')
  })

  describe('Approve All', () => {
    const approveAll = () => screen.queryByRole('button', { name: /^Approve All$|^Approving\.\.\.$/ })

    it('is offered to the stage\'s reviewer while an item is left, without edit mode', () => {
      renderTable({ attesting: REVIEWER })
      expect(approveAll()).toBeEnabled()
      expect(approveAll()).toHaveTextContent('Approve All')
    })

    it('is not offered to anyone else, edit mode or not', () => {
      renderTable({ canEdit: true, attesting: null })
      expect(approveAll()).not.toBeInTheDocument()
    })

    it('is hidden once the reviewer has attested to every item on the report', () => {
      renderTable({ edits: [mine(1, 'item-1', '60.00'), mine(2, 'item-2', '29.00')], attesting: REVIEWER })
      expect(approveAll()).not.toBeInTheDocument()
    })

    it('is hidden when the only item left has no id', () => {
      renderTable({ payItems: [{ ...SIDEWALK, id: undefined }], attesting: REVIEWER })
      expect(approveAll()).not.toBeInTheDocument()
    })

    it('approves each untouched item by its id, in table order, with no confirmation', async () => {
      const third = { ...CURB, id: 'item-3', itemNo: '4.05 A' }
      const user = userEvent.setup()
      renderTable({ payItems: [SIDEWALK, CURB, third], edits: [mine(1, 'item-2', '29.00')], attesting: REVIEWER })
      await user.click(approveAll())
      expect(approve.mock.calls).toEqual([['item-1'], ['item-3']])
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('sends one call at a time and reads "Approving..." until the last has answered', async () => {
      const answers = []
      approve.mockImplementation(() => new Promise(resolve => answers.push(resolve)))
      const user = userEvent.setup()
      renderTable({ attesting: REVIEWER })
      await user.click(approveAll())
      expect(approveAll()).toHaveTextContent('Approving...')
      expect(approveAll()).toBeDisabled()
      expect(approveButton(2)).toBeDisabled()
      expect(approve).toHaveBeenCalledTimes(1) // the second waits for the first
      answers[0]({ ok: true })
      await waitFor(() => expect(approve).toHaveBeenCalledTimes(2))
      expect(approveAll()).toHaveTextContent('Approving...')
      answers[1]({ ok: true })
      await waitFor(() => expect(approveAll()).toHaveTextContent('Approve All'))
    })

    it('stops at the first refusal and names the item in a toast, without retrying', async () => {
      const third = { ...CURB, id: 'item-3' }
      approve.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, message: 'Pay item not found in this IDR' })
      const user = userEvent.setup()
      renderTable({ payItems: [SIDEWALK, CURB, third], attesting: REVIEWER })
      await user.click(approveAll())
      expect(await screen.findByRole('status')).toHaveTextContent("Couldn't approve 4.08 AA — Curb: Pay item not found in this IDR")
      expect(approve.mock.calls).toEqual([['item-1'], ['item-2']])
      expect(approveAll()).toBeEnabled()
    })

    it('stops on a conflict and says nothing more: the page has reloaded and said so', async () => {
      approve.mockResolvedValue({ ok: false, conflict: true })
      const user = userEvent.setup()
      renderTable({ attesting: REVIEWER })
      await user.click(approveAll())
      await waitFor(() => expect(approveAll()).toBeEnabled())
      expect(approve).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  it('outlines the item the gate sent the reviewer here for and scrolls to it', () => {
    const scrollIntoView = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoView
    try {
      renderTable({ attesting: REVIEWER, highlightItemId: 'item-2' })
      const [first, second] = screen.getAllByTestId('pay-item-row')
      expect(second).toHaveAttribute('data-untouched', 'true')
      expect(first).not.toHaveAttribute('data-untouched')
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  it('drops the outline once that item is approved', () => {
    renderTable({ edits: [mine(1, 'item-2', '29.00')], attesting: REVIEWER, highlightItemId: 'item-2' })
    expect(screen.getAllByTestId('pay-item-row')[1]).not.toHaveAttribute('data-untouched')
  })
})
