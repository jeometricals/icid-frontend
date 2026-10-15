import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import TaskOrderPage, { DEMO_NOTE, EMPTY_TEXT, addedMessage } from '../TaskOrderPage'
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

const property = (number, [block, lot], address, property_type = '1_3_family', extra = {}) => ({
  id: `c0000000-0000-4000-8000-00000000000${number}`, project_id: 'HWS0023', kind: 'sidewalk', boro: 'Queens', block, lot, address,
  display_address: address, property_type,
  notes: null, created_at: `${YEAR}-09-14T12:00:00`, deleted_at: null, ...extra,
})
const MAIN = property(1, ['123', '45'], '12 Main St', '4_plus_family')
const OAK = property(2, ['123', '99'], '40 Oak Ave')
const ELM = property(3, ['111', '1'], '7 Elm Pl', 'expedited')
const GONE = property(4, '4007770007', '1 Gone Ct', '1_3_family', { deleted_at: `${YEAR}-10-01T09:00:00` })

vi.mock('../../services/api', () => ({
  getTaskOrder: vi.fn(), listAdminUsers: vi.fn(), listUsers: vi.fn(), updateTaskOrder: vi.fn(), softDeleteTaskOrder: vi.fn(),
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
  api.listUsers.mockResolvedValue([{ user_id: ADMIN.uuid, email: ADMIN.email, first_name: 'Ada', last_name: 'Admin' }])
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
    <MemoryRouter initialEntries={[`/project/HWS0023/task-orders/${TASK_ORDER_ID}`]}>
      <Routes>
        <Route path="/project/:projectId/task-orders/:taskOrderId" element={<TaskOrderPage />} />
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
const bundled = () => screen.getByRole('region', { name: 'Bundled sites' })
const rowOf = (site) => within(bundled()).getByText(site).closest('tr')
const queryRowOf = (site) => within(bundled()).queryByText(site)?.closest('tr') ?? null
const dialog = () => screen.getByRole('dialog')

describe('TaskOrderPage — who can do what', () => {
  it("lets a project member who isn't an admin edit, bundle and unbundle, but not delete", async () => {
    await renderLoaded(TEST_USER)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    // The member's name list is GET /v1/users/, not the admin's
    await waitFor(() => expect(within(details()).getByText('Created').nextSibling).toHaveTextContent('by Ada Admin'))
    expect(api.listUsers).toHaveBeenCalled()
    expect(api.listAdminUsers).not.toHaveBeenCalled()
    // The property page is open to anyone on the project, so a member's sites link to it too
    expect(within(rowOf('Block 123 Lot 45')).getByRole('link', { name: 'Block 123 Lot 45' }))
      .toHaveAttribute('href', `/project/HWS0023/properties/${MAIN.id}`)

    await userEvent.click(within(rowOf('Block 123 Lot 45')).getByRole('button', { name: 'Unbundle' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unbundle' }))
    await waitFor(() => expect(queryRowOf('Block 123 Lot 45')).toBeNull())
    expect(api.unbundleProperty).toHaveBeenCalledWith(TASK_ORDER_ID, MAIN.id)

    await userEvent.click(screen.getByRole('button', { name: 'Add sites' }))
    await userEvent.click(await screen.findByRole('checkbox', { name: /Block 111 Lot 1/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 site' }))
    await waitFor(() => expect(queryRowOf('Block 111 Lot 1')).not.toBeNull())
    expect(api.bundleProperty).toHaveBeenCalledWith(TASK_ORDER_ID, ELM.id)

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.clear(screen.getByLabelText('Number'))
    await userEvent.type(screen.getByLabelText('Number'), 'TO-001B')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { name: 'Task order TO-001B' })).toBeInTheDocument()
  })

  it('gives an admin Delete, and sites that link to the property page', async () => {
    await renderLoaded()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(within(rowOf('Block 123 Lot 45')).getByRole('link', { name: 'Block 123 Lot 45' }))
      .toHaveAttribute('href', `/project/HWS0023/properties/${MAIN.id}`)
  })

  it('shows a member a deleted task order with nothing to change and no Un-delete', async () => {
    record = { ...record, deleted_at: `${YEAR}-10-02T09:00:00` }
    await renderLoaded(TEST_USER)
    expect(screen.getByRole('heading', { name: /Task order TO-001/ })).toHaveTextContent('Deleted')
    for (const name of ['Edit', 'Delete', 'Un-delete', 'Add sites', 'Unbundle']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  it('keeps a demo user to reading, with a note saying why, and reads no names', async () => {
    await renderLoaded(DEMO_USER)
    for (const name of ['Edit', 'Delete', 'Add sites', 'Unbundle']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    expect(screen.getByText(DEMO_NOTE)).toBeInTheDocument()
    expect(rowOf('Block 123 Lot 45')).toBeInTheDocument()
    expect(api.listUsers).not.toHaveBeenCalled()
    expect(api.listAdminUsers).not.toHaveBeenCalled()
  })

  it("shows the backend's refusal of someone not on the project as the load error", async () => {
    api.getTaskOrder.mockRejectedValueOnce(Object.assign(new Error('Not a member of this project'), { status: 403 }))
    renderPage(TEST_USER)
    expect(await screen.findByText("Couldn't load the task order: Not a member of this project")).toBeInTheDocument()
  })

  it("won't show a task order of another project under this one's URL", async () => {
    record = { ...record, project_id: 'SE384' }
    renderPage()
    expect(await screen.findByText("Couldn't load the task order: Task order not found in project HWS0023")).toBeInTheDocument()
  })
})

describe('TaskOrderPage — the task order', () => {
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

  it("goes back to the project's task orders", async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Task Orders' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023/task-orders')
  })

  it('has Go to Project Page beside Back', async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Go to Project Page' }))
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/project\/HWS0023$/)
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
    expect(screen.queryByRole('button', { name: 'Add sites' })).not.toBeInTheDocument()
    expect(within(bundled()).queryByRole('button', { name: 'Unbundle' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Un-delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    expect(await screen.findByRole('button', { name: 'Add sites' })).toBeInTheDocument()
    expect(api.undeleteTaskOrder).toHaveBeenCalledWith(TASK_ORDER_ID)
  })
})

describe('TaskOrderPage — bundled properties', () => {
  it('lists the bundled properties with a count, and hides a soft-deleted one', async () => {
    await renderLoaded()
    expect(within(bundled()).getByText('2 sites bundled')).toBeInTheDocument()
    expect(within(bundled()).getAllByRole('columnheader').map(th => th.textContent))
      .toEqual(['Site', 'Address', 'Type', 'Added', 'Actions'])
    expect(within(rowOf('Block 123 Lot 45')).getAllByRole('cell').map(td => td.textContent))
      .toEqual(['Block 123 Lot 45', '12 Main St', '4+ family / commercial', 'Sep 14', 'Unbundle'])
    expect(rowOf('Block 123 Lot 99')).toBeInTheDocument()
    expect(queryRowOf('4007770007')).toBeNull()
  })

  it('shows the empty state when nothing is bundled', async () => {
    bundle = []
    await renderLoaded()
    expect(within(bundled()).getByText(EMPTY_TEXT)).toBeInTheDocument()
  })

  it('unbundles a property once confirmed, and its row goes', async () => {
    await renderLoaded()
    await userEvent.click(within(rowOf('Block 123 Lot 45')).getByRole('button', { name: 'Unbundle' }))
    expect(dialog()).toHaveAccessibleName('Unbundle site Block 123 Lot 45?')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unbundle' }))

    await waitFor(() => expect(queryRowOf('Block 123 Lot 45')).toBeNull())
    expect(api.unbundleProperty).toHaveBeenCalledWith(TASK_ORDER_ID, MAIN.id)
    expect(within(bundled()).getByText('1 site bundled')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Site Block 123 Lot 45 unbundled.')
  })

  it('shows a refused unbundle in its dialog', async () => {
    api.unbundleProperty.mockRejectedValueOnce(new Error('Property is not in this task order'))
    await renderLoaded()
    await userEvent.click(within(rowOf('Block 123 Lot 45')).getByRole('button', { name: 'Unbundle' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Unbundle' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Property is not in this task order')
  })

  it('opens the picker on Add sites, and what it adds shows in the table', async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Add sites' }))
    expect(dialog()).toHaveAccessibleName('Add sites')
    await userEvent.click(await screen.findByRole('checkbox', { name: /Block 111 Lot 1/ }))
    expect(screen.queryByRole('checkbox', { name: /Block 123 Lot 45/ })).not.toBeInTheDocument() // already bundled
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 site' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rowOf('Block 111 Lot 1')).toHaveTextContent('Expedited')
    expect(screen.getByRole('status')).toHaveTextContent('Added 1 site.')
  })
})

describe('addedMessage', () => {
  it('counts what went in', () => {
    expect(addedMessage({ added: 3, failed: null })).toBe('Added 3 sites.')
  })

  it('names the refusal that stopped the batch', () => {
    expect(addedMessage({ added: 1, failed: { property: MAIN, message: 'Cannot bundle a deleted property.' } }))
      .toBe("Added 1 site. Couldn't add Block 123 Lot 45: Cannot bundle a deleted property. The rest weren't tried.")
    expect(addedMessage({ added: 0, failed: { property: MAIN, message: 'Nope.' } }))
      .toBe("No sites were added. Couldn't add Block 123 Lot 45: Nope. The rest weren't tried.")
  })
})
