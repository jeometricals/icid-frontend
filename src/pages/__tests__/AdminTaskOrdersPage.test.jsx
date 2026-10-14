import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AdminTaskOrdersPage, { EMPTY_TEXT } from '../AdminTaskOrdersPage'
import { NUMBER_TAKEN } from '../../components/TaskOrderFormModal'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

// ---------------------------------------------------------------------------
// Shared mocks: a tiny in-memory "server", so the list read after a change shows what the backend wrote
// ---------------------------------------------------------------------------

const ADMIN = { ...TEST_USER, role: 'admin' }
const PROJECTS = [{ project_id: 'HWS0023', project_name: 'S/W Queens 2025' }]
const YEAR = new Date().getFullYear()

const taskOrder = (number, task_order_number, issued_date, property_count, extra = {}) => ({
  id: `d0000000-0000-4000-8000-00000000000${number}`, project_id: 'HWS0023', task_order_number, issued_date,
  estimate_notes: null, created_at: `${YEAR}-09-01T12:00:00`, updated_at: `${YEAR}-09-01T12:00:00`,
  created_by: ADMIN.uuid, deleted_at: null, deleted_by: null, property_count, ...extra,
})
const LISTED = [
  taskOrder(1, 'TO-001', `${YEAR}-09-14`, 24),
  taskOrder(2, 'TO-002', null, 1),
]
const byNumber = (a, b) => a.task_order_number.localeCompare(b.task_order_number)

vi.mock('../../services/api', () => ({
  listTaskOrders: vi.fn(), listAdminProjects: vi.fn(), createTaskOrder: vi.fn(), updateTaskOrder: vi.fn(),
  softDeleteTaskOrder: vi.fn(), undeleteTaskOrder: vi.fn(),
}))

const conflict = () => Object.assign(new Error('A task order with this number already exists in this project'), {
  status: 409, body: { existing_task_order_id: 'x' },
})
const live = (row) => !row.deleted_at

let server

beforeEach(() => {
  vi.clearAllMocks()
  server = structuredClone(LISTED)
  api.listAdminProjects.mockResolvedValue(PROJECTS)
  api.listTaskOrders.mockImplementation(async (projectId, { includeDeleted = false } = {}) => (
    structuredClone(server.filter(row => includeDeleted || live(row)))
  ))
  api.createTaskOrder.mockImplementation(async (projectId, values) => {
    if (server.some(row => live(row) && row.task_order_number === values.task_order_number)) throw conflict()
    const created = taskOrder(9, values.task_order_number, values.issued_date, 0, { estimate_notes: values.estimate_notes })
    server = [...server, created].sort(byNumber)
    return { ...created, properties: [] }
  })
  api.updateTaskOrder.mockImplementation(async (id, values) => {
    server = server.map(row => (row.id === id ? { ...row, ...values } : row)).sort(byNumber)
    return server.find(row => row.id === id)
  })
  api.softDeleteTaskOrder.mockImplementation(async (id) => {
    server = server.map(row => (row.id === id ? { ...row, deleted_at: `${YEAR}-10-01T09:00:00` } : row))
    return server.find(row => row.id === id)
  })
  api.undeleteTaskOrder.mockImplementation(async (id) => {
    server = server.map(row => (row.id === id ? { ...row, deleted_at: null } : row))
    return server.find(row => row.id === id)
  })
})

function CurrentUrl() {
  return <div data-testid="url">{useLocation().pathname}</div>
}

function renderPage(user = ADMIN) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={['/admin/projects/HWS0023/task-orders']}>
      <Routes>
        <Route path="/admin/projects/:projectId/task-orders" element={<AdminTaskOrdersPage />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

const table = () => screen.getByRole('table')
const rowOf = (number) => within(table()).getByText(number).closest('tr')
const queryRowOf = (number) => within(table()).queryByText(number)?.closest('tr') ?? null
const dialog = () => screen.getByRole('dialog')

async function renderListed(user) {
  renderPage(user)
  await screen.findByRole('table')
}

describe('AdminTaskOrdersPage — who sees it', () => {
  it.each([['a regular user', TEST_USER], ['a demo user', DEMO_USER]])('tells %s it is for admins and asks nothing', (_, user) => {
    renderPage(user)
    expect(screen.getByText('Only an admin can manage task orders.')).toBeInTheDocument()
    expect(api.listTaskOrders).not.toHaveBeenCalled()
  })
})

describe('AdminTaskOrdersPage — the list', () => {
  it('heads the page with the project and lists number, issued date and property count', async () => {
    await renderListed()
    expect(screen.getByRole('heading', { name: 'Task orders — HWS0023 S/W Queens 2025' })).toBeInTheDocument()
    expect(api.listTaskOrders).toHaveBeenCalledWith('HWS0023', { includeDeleted: false })
    expect(within(table()).getAllByRole('columnheader').map(th => th.textContent))
      .toEqual(['Number', 'Issued', 'Properties', 'Actions'])
    expect(within(rowOf('TO-001')).getAllByRole('cell').map(td => td.textContent).slice(0, 3))
      .toEqual(['TO-001', 'Sep 14', '24 properties'])
    expect(within(rowOf('TO-002')).getAllByRole('cell').map(td => td.textContent).slice(0, 3))
      .toEqual(['TO-002', '—', '1 property'])
  })

  it('links each number to its task order\'s page', async () => {
    await renderListed()
    await userEvent.click(within(table()).getByRole('link', { name: 'TO-001' }))
    expect(screen.getByTestId('url')).toHaveTextContent(`/admin/task-orders/${LISTED[0].id}`)
  })

  it('shows the empty state when the project has none', async () => {
    server = []
    renderPage()
    expect(await screen.findByText(EMPTY_TEXT)).toBeInTheDocument()
  })

  it('shows a load failure with Retry', async () => {
    api.listTaskOrders.mockRejectedValueOnce(new Error('Project not found'))
    renderPage()
    expect(await screen.findByText("Couldn't load the task orders: Project not found")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})

describe('AdminTaskOrdersPage — adding and editing', () => {
  it('adds a task order, and the list read again shows it', async () => {
    await renderListed()
    await userEvent.click(screen.getByRole('button', { name: 'Add task order' }))
    await userEvent.type(screen.getByLabelText('Number'), 'TO-003')
    await userEvent.type(screen.getByLabelText(/Issued date/), `${YEAR}-10-02`)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.createTaskOrder).toHaveBeenCalledWith('HWS0023', {
      task_order_number: 'TO-003', issued_date: `${YEAR}-10-02`, estimate_notes: null,
    })
    expect(within(rowOf('TO-003')).getAllByRole('cell').map(td => td.textContent).slice(0, 3))
      .toEqual(['TO-003', 'Oct 2', '0 properties'])
  })

  it('shows a duplicate number on the Number field and adds no row', async () => {
    await renderListed()
    await userEvent.click(screen.getByRole('button', { name: 'Add task order' }))
    await userEvent.type(screen.getByLabelText('Number'), 'TO-001')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await within(dialog()).findByText(NUMBER_TAKEN)).toBeInTheDocument()
    expect(screen.getByLabelText('Number')).toHaveAttribute('aria-invalid', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(within(table()).getAllByRole('row')).toHaveLength(3)
  })

  it('edits a row from its pre-filled dialog', async () => {
    await renderListed()
    await userEvent.click(within(rowOf('TO-002')).getByRole('button', { name: 'Edit' }))
    expect(dialog()).toHaveAccessibleName('Edit task order')
    expect(screen.getByLabelText('Number')).toHaveDisplayValue('TO-002')
    await userEvent.type(screen.getByLabelText(/Issued date/), `${YEAR}-09-20`)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.updateTaskOrder).toHaveBeenCalledWith(LISTED[1].id, { issued_date: `${YEAR}-09-20` })
    expect(rowOf('TO-002')).toHaveTextContent('Sep 20')
  })
})

describe('AdminTaskOrdersPage — deleting and un-deleting', () => {
  it('soft-deletes a row once confirmed, and it leaves the list', async () => {
    await renderListed()
    await userEvent.click(within(rowOf('TO-001')).getByRole('button', { name: 'Delete' }))
    expect(dialog()).toHaveAccessibleName('Delete task order TO-001?')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(queryRowOf('TO-001')).toBeNull())
    expect(api.softDeleteTaskOrder).toHaveBeenCalledWith(LISTED[0].id)
    expect(screen.getByRole('status')).toHaveTextContent('Task order TO-001 deleted.')
  })

  it('shows a deleted row muted with Un-delete under Show deleted, and un-deleting returns it', async () => {
    server[0] = { ...server[0], deleted_at: `${YEAR}-10-01T09:00:00` }
    await renderListed()
    expect(queryRowOf('TO-001')).toBeNull()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Show deleted' }))
    await waitFor(() => expect(queryRowOf('TO-001')).not.toBeNull())
    expect(api.listTaskOrders).toHaveBeenLastCalledWith('HWS0023', { includeDeleted: true })
    const deleted = rowOf('TO-001')
    expect(deleted).toHaveAttribute('data-deleted', 'true')
    expect(deleted).toHaveClass('text-gray-400')
    expect(within(deleted).getByRole('link', { name: 'TO-001' })).toHaveClass('line-through')
    expect(within(deleted).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()

    await userEvent.click(within(deleted).getByRole('button', { name: 'Un-delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    await waitFor(() => expect(rowOf('TO-001')).not.toHaveAttribute('data-deleted'))
    expect(api.undeleteTaskOrder).toHaveBeenCalledWith(LISTED[0].id)
    expect(screen.getByRole('status')).toHaveTextContent('Task order TO-001 restored.')
  })

  it('shows a refused un-delete in its dialog', async () => {
    server[0] = { ...server[0], deleted_at: `${YEAR}-10-01T09:00:00` }
    api.undeleteTaskOrder.mockRejectedValueOnce(Object.assign(
      new Error('Another task order in this project now has this number'), { status: 409 },
    ))
    await renderListed()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show deleted' }))
    await userEvent.click(within(await waitFor(() => rowOf('TO-001'))).getByRole('button', { name: 'Un-delete' }))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Un-delete' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Another task order in this project now has this number')
  })
})
