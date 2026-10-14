import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AdminProjectsPage from '../AdminProjectsPage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

// ---------------------------------------------------------------------------
// Shared mocks: a tiny in-memory "server", so the list read after a save shows what the backend wrote
// ---------------------------------------------------------------------------

const ADMIN = { ...TEST_USER, role: 'admin' }
// As the backend lists them: by project id
const LISTED = [
  { project_id: 'HWS0023', project_name: 'S/W Queens 2025', project_description: 'Curbs and sidewalks',
    registration_code: '2024123457', borough: 'Queens', status: 'active' },
  { project_id: 'SE384', project_name: 'Sewer Rehab', project_description: null, registration_code: null,
    borough: 'Brooklyn', status: null },
]

vi.mock('../../services/api', () => ({ listAdminProjects: vi.fn(), createAdminProject: vi.fn() }))

let server

beforeEach(() => {
  vi.clearAllMocks()
  server = structuredClone(LISTED)
  api.listAdminProjects.mockImplementation(async () => structuredClone(server))
  api.createAdminProject.mockImplementation(async ({ registration_code, ...values }) => {
    const created = { ...values, registration_code: registration_code || null, status: null }
    server = [...server, created].sort((a, b) => a.project_id.localeCompare(b.project_id))
    return created
  })
})

function CurrentUrl() {
  return <div data-testid="url">{useLocation().pathname}</div>
}

function renderPage(user = ADMIN) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={['/admin/projects']}>
      <Routes>
        <Route path="/admin/projects" element={<AdminProjectsPage />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

const ready = () => screen.findByRole('table')
const rows = () => screen.getAllByRole('row').slice(1)
const ids = () => rows().map(row => within(row).getAllByRole('cell')[0].textContent)
const cells = (id) => within(rows().find(row => within(row).getAllByRole('cell')[0].textContent === id))
  .getAllByRole('cell').slice(0, 6).map(cell => cell.textContent) // every cell but Actions
const dialog = () => screen.queryByRole('dialog')
const banner = () => screen.queryByRole('status')
const openCreate = () => userEvent.click(screen.getByRole('button', { name: 'Create project' }))
const submit = () => userEvent.click(within(dialog()).getByRole('button', { name: 'Create project' }))

async function fillIn({ id = 'MED001', name = 'Smoke', description = 'Smoke test', borough = 'Manhattan' } = {}) {
  await userEvent.type(within(dialog()).getByLabelText('Project ID'), id)
  await userEvent.type(within(dialog()).getByLabelText('Project name'), name)
  await userEvent.type(within(dialog()).getByLabelText('Description'), description)
  await userEvent.type(within(dialog()).getByLabelText('Borough'), borough)
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

describe('AdminProjectsPage — the table', () => {
  it('reads the projects once and lists them in the backend\'s order', async () => {
    renderPage()
    await ready()
    expect(api.listAdminProjects).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: 'All Projects (Admin)' })).toBeInTheDocument()
    expect(ids()).toEqual(['HWS0023', 'SE384'])
  })

  it('has the columns', async () => {
    renderPage()
    await ready()
    expect(screen.getAllByRole('columnheader').map(th => th.textContent))
      .toEqual(['Project ID', 'Name', 'Description', 'Borough', 'Registration Code', 'Status', 'Actions'])
  })

  it('shows each project\'s details, with a dash for what it lacks', async () => {
    renderPage()
    await ready()
    expect(cells('HWS0023')).toEqual(['HWS0023', 'S/W Queens 2025', 'Curbs and sidewalks', 'Queens', '2024123457', 'active'])
    expect(cells('SE384')).toEqual(['SE384', 'Sewer Rehab', '—', 'Brooklyn', '—', '—'])
  })

  it('has Pay items, Properties, Task orders and Manage roles on each row', async () => {
    renderPage()
    await ready()
    for (const row of rows()) {
      expect(within(row).getAllByRole('button').map(button => button.textContent)).toEqual(['Pay items', 'Properties', 'Task orders', 'Manage roles'])
    }
  })

  it.each([
    ['Pay items', '/admin/projects/SE384/pay-items'],
    ['Properties', '/admin/projects/SE384/properties'],
    ['Task orders', '/project/SE384/task-orders'],
    ['Manage roles', '/admin/projects/SE384/roles'],
  ])('%s opens that project\'s page', async (name, path) => {
    renderPage()
    await ready()
    await userEvent.click(within(rows()[1]).getByRole('button', { name }))
    expect(screen.getByTestId('url')).toHaveTextContent(path)
  })

  it('shows a spinner while loading, then says when there are none', async () => {
    let finish
    api.listAdminProjects.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
    await act(async () => finish([]))
    expect(screen.getByText('No projects to show.')).toBeInTheDocument()
  })

  it('shows a failed load with a Retry that reads again', async () => {
    api.listAdminProjects.mockRejectedValueOnce(new Error('Failed to fetch projects'))
    renderPage()
    expect(await screen.findByText("Couldn't load the projects: Failed to fetch projects")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await ready()
    expect(api.listAdminProjects).toHaveBeenCalledTimes(2)
  })

  it('goes back to the projects', async () => {
    renderPage()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Projects' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/projects')
  })
})

// ---------------------------------------------------------------------------
// Creating a project
// ---------------------------------------------------------------------------

describe('AdminProjectsPage — creating a project', () => {
  it('has a Create project button that opens the dialog', async () => {
    renderPage()
    await ready()
    expect(dialog()).not.toBeInTheDocument()
    await openCreate()
    expect(screen.getByRole('dialog', { name: 'Create Project' })).toBeInTheDocument()
    for (const label of ['Project ID', 'Project name', 'Description', 'Borough', 'Registration code (optional)']) {
      expect(within(dialog()).getByLabelText(label)).toHaveValue('')
    }
  })

  it('creates the project, closes the dialog, reads the list again and announces it once', async () => {
    renderPage()
    await ready()
    await openCreate()
    await fillIn()
    await submit()
    expect(api.createAdminProject).toHaveBeenCalledTimes(1)
    expect(api.createAdminProject).toHaveBeenCalledWith({ project_id: 'MED001', project_name: 'Smoke',
      project_description: 'Smoke test', borough: 'Manhattan', registration_code: '' })
    expect(dialog()).not.toBeInTheDocument()
    expect(api.listAdminProjects).toHaveBeenCalledTimes(2)
    expect(ids()).toEqual(['HWS0023', 'MED001', 'SE384'])
    expect(cells('MED001')).toEqual(['MED001', 'Smoke', 'Smoke test', 'Manhattan', '—', '—'])
    expect(banner()).toHaveTextContent('Created project MED001.')
  })

  it('passes on a registration code', async () => {
    renderPage()
    await ready()
    await openCreate()
    await fillIn()
    await userEvent.type(within(dialog()).getByLabelText('Registration code (optional)'), '2025000001')
    await submit()
    expect(api.createAdminProject.mock.calls[0][0].registration_code).toBe('2025000001')
    expect(cells('MED001')[4]).toBe('2025000001')
  })

  it('drops the banner when it is dismissed', async () => {
    renderPage()
    await ready()
    await openCreate()
    await fillIn()
    await submit()
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(banner()).not.toBeInTheDocument()
  })

  it('drops the banner when the dialog is opened again', async () => {
    renderPage()
    await ready()
    await openCreate()
    await fillIn()
    await submit()
    expect(banner()).toBeInTheDocument()
    await openCreate()
    expect(banner()).not.toBeInTheDocument()
  })

  it('shows a taken project ID inline, keeps what was typed and announces nothing', async () => {
    const taken = Object.assign(new Error('A project with this project_id already exists'),
      { status: 409, body: { existing_project_id: 'HWS0023' } })
    api.createAdminProject.mockRejectedValueOnce(taken)
    renderPage()
    await ready()
    await openCreate()
    await fillIn({ id: 'HWS0023' })
    await submit()
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('A project with this project_id already exists')
    expect(within(dialog()).getByLabelText('Project ID')).toHaveValue('HWS0023')
    expect(within(dialog()).getByLabelText('Borough')).toHaveValue('Manhattan')
    expect(api.listAdminProjects).toHaveBeenCalledTimes(1)
    expect(banner()).not.toBeInTheDocument()
  })

  it('shows any other refusal as the backend worded it', async () => {
    api.createAdminProject.mockRejectedValueOnce(Object.assign(
      new Error('project_id can only contain letters, digits, hyphens and underscores'), { status: 400 }))
    renderPage()
    await ready()
    await openCreate()
    await fillIn({ id: 'MED 001' })
    await submit()
    expect(within(dialog()).getByRole('alert'))
      .toHaveTextContent('project_id can only contain letters, digits, hyphens and underscores')
    expect(dialog()).toBeInTheDocument()
  })

  it('forgets a refusal when the dialog is opened again', async () => {
    api.createAdminProject.mockRejectedValueOnce(new Error('A project with this project_id already exists'))
    renderPage()
    await ready()
    await openCreate()
    await fillIn()
    await submit()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    await openCreate()
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(dialog()).getByLabelText('Project ID')).toHaveValue('')
  })

  it('still announces the project when the list could not be read again', async () => {
    renderPage()
    await ready()
    api.listAdminProjects.mockRejectedValueOnce(new Error('Network error'))
    await openCreate()
    await fillIn()
    await submit()
    expect(dialog()).not.toBeInTheDocument()
    expect(banner()).toHaveTextContent('Created project MED001.')
    expect(screen.getByRole('alert'))
      .toHaveTextContent("The project was created, but the list couldn't be refreshed: Network error")
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await ready()
    expect(ids()).toContain('MED001')
  })

  it('cancels without creating', async () => {
    renderPage()
    await ready()
    await openCreate()
    await fillIn()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(dialog()).not.toBeInTheDocument()
    expect(api.createAdminProject).not.toHaveBeenCalled()
    expect(banner()).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Admins only
// ---------------------------------------------------------------------------

describe('AdminProjectsPage — admins only', () => {
  it.each([
    ['an inspector', TEST_USER],
    ['a demo user', DEMO_USER],
  ])('tells %s the page is for admins and reads nothing', async (_, user) => {
    renderPage(user)
    expect(screen.getByText('Only an admin can manage projects.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create project' })).not.toBeInTheDocument()
    expect(api.listAdminProjects).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Projects' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/projects')
  })
})
