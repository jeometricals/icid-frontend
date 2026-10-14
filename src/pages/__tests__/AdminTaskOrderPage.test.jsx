import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AdminTaskOrderPage, { EMPTY_TEXT, addedMessage } from '../AdminTaskOrderPage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

// ---------------------------------------------------------------------------
// Shared mocks: a tiny in-memory "server" of one task order, its bundle and the project's properties. Like the
// backend, a task order's properties leave out the soft-deleted ones.
// ---------------------------------------------------------------------------

const ADMIN = { ...TEST_USER, role: 'admin', first_name: 'Ada', last_name: 'Admin' }
const TASK_ORDER_ID = 'd0000000-0000-4000-8000-000000000001'
const YEAR = new Date().getFullYear()

const property = (number, bbl, address, property_type = '1_3_family', extra = {}) => ({
  id: `c0000000-0000-4000-8000-00000000000${number}`, project_id: 'HWS0023', bbl, address, property_type,
  notes: null, created_at: `${YEAR}-09-14T12:00:00`, deleted_at: null, ...extra,
})
const MAIN = property(1, '4001230045', '12 Main St', '4_plus_family')
const OAK = property(2, '4001230099', '40 Oak Ave')
const ELM = property(3, '4001110001', '7 Elm Pl', 'expedited')
const GONE = property(4, '4007770007', '1 Gone Ct', '1_3_family', { deleted_at: `${YEAR}-10-01T09:00:00` })

vi.mock('../../services/api', () => ({
  getTaskOrder: vi.fn(), listAdminUsers: vi.fn(), updateTaskOrder: vi.fn(), softDeleteTaskOrder: vi.fn(),
  undeleteTaskOrder: vi.fn(), unbundleProperty: vi.fn(), bundleProperty: vi.fn(), listProperties: vi.fn(),
}))

let record // the task order's own columns
let bundle // ids of the properties in it
let properties // every property of the project

const detail = () => structuredClone({
  ...record,
  properties: properties.filter(row => bundle.includes(row.id) && !row.deleted_at)
    .sort((a, b) => a.address.localeCompare(b.address)),
})

beforeEach(() => {
  vi.clearAllMocks()
  record = { id: TASK_ORDER_ID, project_id: 'HWS0023', task_order_number: 'TO-001', issued_date: `${YEAR}-09-14`,
    estimate_notes: '4" SF 1200\ncurb 300 LF', created_at: `${YEAR}-09-01T12:00:00`, updated_at: `${YEAR}-09-01T12:00:00`,
    created_by: ADMIN.uuid, deleted_at: null, deleted_by: null }
  bundle = [MAIN.id, OAK.id, GONE.id]
  properties = [MAIN, OAK, ELM, GONE]
  api.getTaskOrder.mockImplementation(async () => detail())
  api.listAdminUsers.mockResolvedValue([ADMIN])
  api.listProperties.mockImplementation(async () => structuredClone(properties.filter(row => !row.deleted_at)))
  api.updateTaskOrder.mockImplementation(async (id, values) => {
    record = { ...record, ...values }
    return detail()
  })
  api.softDeleteTaskOrder.mockImplementation(async () => {
    record = { ...record, deleted_at: `${YEAR}-10-02T09:00:00` }
    return detail()
  })
  api.undeleteTaskOrder.mockImplementation(async () => {
    record = { ...record, deleted_at: null }
    return detail()
  })
  api.unbundleProperty.mockImplementation(async (id, propertyId) => {
    bundle = bundle.filter(found => found !== propertyId)
  })
  api.bundleProperty.mockImplementation(async (id, propertyId) => {
    bundle = [...bundle, propertyId]
    return detail()
  })
})

function CurrentUrl() {
  return <div data-testid="url">{useLocation().pathname}</div>
}

function renderPage(user = ADMIN) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={[`/admin/task-orders/${TASK_ORDER_ID}`]}>
      <Routes>
        <Route path="/admin/task-orders/:taskOrderId" element={<AdminTaskOrderPage />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

async function renderLoaded(user) {
  renderPage(user)
  await screen.findByRole('heading', { name: /Task order TO-001/ })
}

const details = () => screen.getByRole('region', { name: 'Task order details' })
const bundled = () => screen.getByRole('region', { name: 'Bundled properties' })
const rowOf = (bbl) => within(bundled()).getByText(bbl).closest('tr')
const queryRowOf = (bbl) => within(bundled()).queryByText(bbl)?.closest('tr') ?? null
const dialog = () => screen.getByRole('dialog')

describe('AdminTaskOrderPage — who sees it', () => {
  it.each([['a regular user', TEST_USER], ['a demo user', DEMO_USER]])('tells %s it is for admins and asks nothing', (_, user) => {
    renderPage(user)
    expect(screen.getByText('Only an admin can manage task orders.')).toBeInTheDocument()
    expect(api.getTaskOrder).not.toHaveBeenCalled()
  })
})

describe('AdminTaskOrderPage — the task order', () => {
  it('shows the number, the issued date, the estimate notes and who created it when', async () => {
    await renderLoaded()
    expect(api.getTaskOrder).toHaveBeenCalledWith(TASK_ORDER_ID)
    expect(within(details()).getByText('Issued').nextSibling).toHaveTextContent('Sep 14')
    expect(within(details()).getByText('Estimate notes').nextSibling).toHaveTextContent('4" SF 1200 curb 300 LF')
    await waitFor(() => expect(within(details()).getByText('Created').nextSibling)
      .toHaveTextContent(`Sep 1, ${YEAR} by Ada Admin`))
  })

  it('gives the creation date alone when the user list can\'t be read', async () => {
    api.listAdminUsers.mockRejectedValue(new Error('Failed to fetch users'))
    await renderLoaded()
    await waitFor(() => expect(api.listAdminUsers).toHaveBeenCalled())
    expect(within(details()).getByText('Created').nextSibling).toHaveTextContent(`Sep 1, ${YEAR}`)
    expect(within(details()).getByText('Created').nextSibling).not.toHaveTextContent('by')
  })

  it('shows a dash for an issued date and notes it doesn\'t have', async () => {
    record = { ...record, issued_date: null, estimate_notes: null }
    await renderLoaded()
    expect(within(details()).getByText('Issued').nextSibling).toHaveTextContent('—')
    expect(within(details()).getByText('Estimate notes').nextSibling).toHaveTextContent('—')
  })

  it('goes back to the project\'s task orders', async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Task orders — HWS0023' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/admin/projects/HWS0023/task-orders')
  })

  it('shows a load failure with Retry', async () => {
    api.getTaskOrder.mockRejectedValueOnce(new Error('Task order not found'))
    renderPage()
    expect(await screen.findByText("Couldn't load the task order: Task order not found")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: /Task order TO-001/ })).toBeInTheDocument()
  })

  it('edits it from the pre-filled dialog', async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(dialog()).toHaveAccessibleName('Edit task order')
    await userEvent.clear(screen.getByLabelText('Number'))
    await userEvent.type(screen.getByLabelText('Number'), 'TO-001A')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.updateTaskOrder).toHaveBeenCalledWith(TASK_ORDER_ID, { task_order_number: 'TO-001A' })
    expect(screen.getByRole('heading', { name: 'Task order TO-001A' })).toBeInTheDocument()
  })

  it('deletes it once confirmed, then offers only Un-delete', async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(dialog()).toHaveAccessibleName('Delete task order TO-001?')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Task order TO-001 deleted.')).toBeInTheDocument()
    expect(api.softDeleteTaskOrder).toHaveBeenCalledWith(TASK_ORDER_ID)
    expect(screen.getByRole('heading', { name: /Task order TO-001/ })).toHaveTextContent('Deleted')
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add properties' })).not.toBeInTheDocument()
    expect(within(bundled()).queryByRole('button', { name: 'Unbundle' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Un-delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    expect(await screen.findByRole('button', { name: 'Add properties' })).toBeInTheDocument()
    expect(api.undeleteTaskOrder).toHaveBeenCalledWith(TASK_ORDER_ID)
  })
})

describe('AdminTaskOrderPage — bundled properties', () => {
  it('lists the bundled properties with a count, and hides a soft-deleted one', async () => {
    await renderLoaded()
    expect(within(bundled()).getByText('2 properties bundled')).toBeInTheDocument()
    expect(within(bundled()).getAllByRole('columnheader').map(th => th.textContent))
      .toEqual(['BBL', 'Address', 'Type', 'Added', 'Actions'])
    expect(within(rowOf('4001230045')).getAllByRole('cell').map(td => td.textContent))
      .toEqual(['4001230045', '12 Main St', '4+ family / commercial', 'Sep 14', 'Unbundle'])
    expect(rowOf('4001230099')).toBeInTheDocument()
    expect(queryRowOf('4007770007')).toBeNull()
  })

  it('shows the empty state when nothing is bundled', async () => {
    bundle = []
    await renderLoaded()
    expect(within(bundled()).getByText(EMPTY_TEXT)).toBeInTheDocument()
  })

  it('unbundles a property once confirmed, and its row goes', async () => {
    await renderLoaded()
    await userEvent.click(within(rowOf('4001230045')).getByRole('button', { name: 'Unbundle' }))
    expect(dialog()).toHaveAccessibleName('Unbundle property 4001230045?')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unbundle' }))

    await waitFor(() => expect(queryRowOf('4001230045')).toBeNull())
    expect(api.unbundleProperty).toHaveBeenCalledWith(TASK_ORDER_ID, MAIN.id)
    expect(within(bundled()).getByText('1 property bundled')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Property 4001230045 unbundled.')
  })

  it('shows a refused unbundle in its dialog', async () => {
    api.unbundleProperty.mockRejectedValueOnce(new Error('Property is not in this task order'))
    await renderLoaded()
    await userEvent.click(within(rowOf('4001230045')).getByRole('button', { name: 'Unbundle' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unbundle' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Property is not in this task order')
  })

  it('opens the picker on Add properties, and what it adds shows in the table', async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Add properties' }))
    expect(dialog()).toHaveAccessibleName('Add properties')
    await userEvent.click(await screen.findByRole('checkbox', { name: /4001110001/ }))
    expect(screen.queryByRole('checkbox', { name: /4001230045/ })).not.toBeInTheDocument() // already bundled
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 property' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rowOf('4001110001')).toHaveTextContent('Expedited')
    expect(screen.getByRole('status')).toHaveTextContent('Added 1 property.')
  })
})

describe('addedMessage', () => {
  it('counts what went in', () => {
    expect(addedMessage({ added: 3, failed: null })).toBe('Added 3 properties.')
  })

  it('names the refusal that stopped the batch', () => {
    expect(addedMessage({ added: 1, failed: { property: MAIN, message: 'Cannot bundle a deleted property.' } }))
      .toBe("Added 1 property. Couldn't add 4001230045: Cannot bundle a deleted property. The rest weren't tried.")
    expect(addedMessage({ added: 0, failed: { property: MAIN, message: 'Nope.' } }))
      .toBe("No properties were added. Couldn't add 4001230045: Nope. The rest weren't tried.")
  })
})
