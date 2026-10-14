import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FlagsSection, { EMPTY_TEXT, EMPTY_TEXT_READ_ONLY } from '../FlagsSection'
import * as api from '../../services/api'
import { MOCK_CONTRACT_ITEMS } from '../../test/contractItems'

// ---------------------------------------------------------------------------
// Shared mocks: a tiny in-memory "server" of one PIR's flags, by display order
// ---------------------------------------------------------------------------

vi.mock('../../services/api', () => ({
  listFlags: vi.fn(), getContractItems: vi.fn(), createFlag: vi.fn(), updateFlag: vi.fn(), softDeleteFlag: vi.fn(),
  undeleteFlag: vi.fn(),
}))

const PIR = { id: 'e0000000-0000-4000-8000-000000000001', project_id: 'HWS0023' }

const flag = (number, extra = {}) => ({
  id: `f1000000-0000-4000-8000-00000000000${number}`, pir_id: PIR.id, display_order: number, shape: 'rectangle',
  dimensions: { L: 5, W: 5 }, surveyed_mark: 'cross', surveyed_is_assessable: true,
  surveyed_non_assessable_reason: null, surveyed_thickness: '4in', added_in_field: false, pay_item_id: null,
  computed_quantity: 25, reported_quantity: null, quantity: 25, quantity_delta_reason: null, deleted_at: null, ...extra,
})

let server

beforeEach(() => {
  vi.clearAllMocks()
  server = [
    flag(1, { pay_item_id: MOCK_CONTRACT_ITEMS[1].contract_item_id }),
    flag(2, {
      shape: 'triangle', dimensions: { a: 3, b: 4 }, computed_quantity: 6, reported_quantity: 7.5, quantity: 7.5,
      surveyed_is_assessable: false, surveyed_non_assessable_reason: 'hydrant', surveyed_thickness: '7in_as_4in',
      surveyed_mark: 'tick',
    }),
  ]
  api.getContractItems.mockResolvedValue(MOCK_CONTRACT_ITEMS)
  api.listFlags.mockImplementation(async (pirId, { includeDeleted = false } = {}) => (
    structuredClone(server.filter(row => includeDeleted || !row.deleted_at))
  ))
  api.createFlag.mockImplementation(async (pirId, values) => {
    const created = flag(server.length + 1, { ...values, computed_quantity: 42.5, quantity: 42.5 })
    server = [...server, created]
    return created
  })
  api.updateFlag.mockImplementation(async (id, values) => {
    server = server.map(row => (row.id === id ? { ...row, ...values } : row))
    return server.find(row => row.id === id)
  })
  api.softDeleteFlag.mockImplementation(async (id) => {
    server = server.map(row => (row.id === id ? { ...row, deleted_at: '2026-10-03T09:00:00' } : row))
    return server.find(row => row.id === id)
  })
  api.undeleteFlag.mockImplementation(async (id) => {
    server = server.map(row => (row.id === id ? { ...row, deleted_at: null } : row))
    return server.find(row => row.id === id)
  })
})

async function renderSection(props = {}) {
  const onChanged = vi.fn()
  render(<FlagsSection pir={PIR} writer admin={false} onChanged={onChanged} {...props} />)
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  return { onChanged }
}

const table = () => screen.getByRole('table')
const rowOf = (number) => within(table()).getAllByRole('row').find(row => row.cells[0]?.textContent === String(number))
const dialog = () => screen.getByRole('dialog')

describe('FlagsSection — the list', () => {
  it('lists the flags with shape, thickness, area, pay item and marks', async () => {
    await renderSection()
    expect(api.listFlags).toHaveBeenCalledWith(PIR.id, { includeDeleted: false })
    expect(api.getContractItems).toHaveBeenCalledWith('HWS0023')
    expect(within(table()).getAllByRole('columnheader').map(th => th.textContent))
      .toEqual(['#', 'Shape', 'Thickness', 'Area', 'Pay item', 'Marks', 'Actions'])
    const first = [...rowOf(1).cells].map(cell => cell.textContent)
    expect(first.slice(0, 6)).toEqual([
      '1', 'Rectangle', '4"', '25.00 SF', `${MOCK_CONTRACT_ITEMS[1].item_no} — ${MOCK_CONTRACT_ITEMS[1].description}`,
      'Cross (X)assessable',
    ])
  })

  it('shows a reported quantity that differs beside the computed one, and a non-assessable reason', async () => {
    await renderSection()
    const second = rowOf(2)
    expect(second.cells[1]).toHaveTextContent('Right triangle')
    expect(second.cells[2]).toHaveTextContent('7" as 4"')
    expect(second.cells[3]).toHaveTextContent('6.00 SF7.50 SF (reported)')
    expect(second.cells[4]).toHaveTextContent('—')
    expect(second.cells[5]).toHaveTextContent('Tick')
    expect(second.cells[5]).toHaveTextContent('non-assessable (Hydrant)')
  })

  it('reads the empty state for a writer, and a plainer one for anyone who can\'t add', async () => {
    server = []
    await renderSection()
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument()
  })

  it('reads "No flags." for a demo user', async () => {
    server = []
    await renderSection({ writer: false })
    expect(screen.getByText(EMPTY_TEXT_READ_ONLY)).toBeInTheDocument()
  })

  it('shows a load failure with Retry', async () => {
    api.listFlags.mockRejectedValueOnce(new Error('PIR not found'))
    await renderSection()
    expect(screen.getByText("Couldn't load the flags: PIR not found")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})

describe('FlagsSection — who can do what', () => {
  it('gives a member Add flag and Edit, but no Delete or Show deleted', async () => {
    await renderSection()
    expect(screen.getByRole('button', { name: 'Add flag' })).toBeInTheDocument()
    expect(within(rowOf(1)).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(within(table()).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Show deleted' })).not.toBeInTheDocument()
  })

  it('gives an admin Delete and Show deleted too', async () => {
    await renderSection({ admin: true })
    expect(within(rowOf(1)).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Show deleted' })).toBeInTheDocument()
  })

  it('gives a demo user no Add flag and no Actions column', async () => {
    await renderSection({ writer: false })
    expect(screen.queryByRole('button', { name: 'Add flag' })).not.toBeInTheDocument()
    expect(within(table()).getAllByRole('columnheader').map(th => th.textContent)).not.toContain('Actions')
  })

  it.each([
    ['the PIR', { pirIsDeleted: true }],
    ['the property', { propertyIsDeleted: true }],
  ])('turns off writes while %s is deleted, leaving an admin Delete', async (_, deleted) => {
    await renderSection({ admin: true, ...deleted })
    expect(screen.queryByRole('button', { name: 'Add flag' })).not.toBeInTheDocument()
    expect(within(table()).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(within(rowOf(1)).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})

describe('FlagsSection — changes', () => {
  it('adds a flag at the next display order, and the list read again shows it', async () => {
    const { onChanged } = await renderSection()
    await userEvent.click(screen.getByRole('button', { name: 'Add flag' }))
    expect(screen.getByLabelText('Display order')).toHaveValue(3)
    await userEvent.selectOptions(screen.getByLabelText('Shape'), 'rectangle')
    await userEvent.type(screen.getByLabelText('Length (ft)'), '8.5')
    await userEvent.type(screen.getByLabelText('Width (ft)'), '5')
    await userEvent.selectOptions(screen.getByLabelText('Surveyed mark'), 'number_only')
    await userEvent.selectOptions(screen.getByLabelText('Thickness'), '7in')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.createFlag).toHaveBeenCalledWith(PIR.id, expect.objectContaining({ display_order: 3, shape: 'rectangle' }))
    expect(rowOf(3).cells[3]).toHaveTextContent('42.50 SF')
    expect(onChanged).toHaveBeenCalled()
  })

  it('edits a flag from its pre-filled dialog', async () => {
    await renderSection()
    await userEvent.click(within(rowOf(1)).getByRole('button', { name: 'Edit' }))
    expect(dialog()).toHaveAccessibleName('Edit flag')
    await userEvent.selectOptions(screen.getByLabelText('Thickness'), '7in')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.updateFlag).toHaveBeenCalledWith(server[0].id, { surveyed_thickness: '7in' })
    expect(rowOf(1).cells[2]).toHaveTextContent('7"')
  })

  it('shows a refused save in the dialog, which keeps what was typed', async () => {
    api.updateFlag.mockRejectedValueOnce(Object.assign(new Error('Pay item belongs to a different project'), { status: 400 }))
    await renderSection()
    await userEvent.click(within(rowOf(1)).getByRole('button', { name: 'Edit' }))
    await userEvent.selectOptions(screen.getByLabelText('Thickness'), '7in')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Pay item belongs to a different project')
    expect(screen.getByLabelText('Thickness')).toHaveValue('7in')
  })

  it('lets an admin delete a flag once confirmed, then find it under Show deleted, muted, and un-delete it', async () => {
    await renderSection({ admin: true })
    await userEvent.click(within(rowOf(1)).getByRole('button', { name: 'Delete' }))
    expect(dialog()).toHaveAccessibleName('Delete flag #1?')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(rowOf(1)).toBeUndefined())
    expect(screen.getByText('Flag #1 deleted.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Show deleted' }))
    await waitFor(() => expect(rowOf(1)).toBeDefined())
    expect(api.listFlags).toHaveBeenLastCalledWith(PIR.id, { includeDeleted: true })
    expect(rowOf(1)).toHaveAttribute('data-deleted', 'true')
    expect(rowOf(1)).toHaveClass('text-gray-400')
    expect(within(rowOf(1).cells[0]).getByText('1')).toHaveClass('line-through')
    expect(within(rowOf(1)).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()

    await userEvent.click(within(rowOf(1)).getByRole('button', { name: 'Un-delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    await waitFor(() => expect(rowOf(1)).not.toHaveAttribute('data-deleted'))
    expect(api.undeleteFlag).toHaveBeenCalledWith(server[0].id)
  })
})
