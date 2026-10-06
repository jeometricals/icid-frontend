import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ProjectRolesPage from '../ProjectRolesPage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { ProjectRolesContext } from '../../contexts/ProjectRolesContext'
import { TaskCountContext } from '../../contexts/TaskCountContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

// ---------------------------------------------------------------------------
// Shared mocks: a tiny in-memory "server" so each change answers with the roles as they now stand
// ---------------------------------------------------------------------------

const ADMIN = { ...TEST_USER, uuid: 'a0000000-0000-4000-8000-000000000001', email: 'reza@icid.local', first_name: 'Reza',
  last_name: null, role: 'admin' }
const KHAN = { user_id: TEST_USER.uuid, email: 'KhanG@magnoleng.pc', first_name: 'Genghis', last_name: 'Khan' }
const OLIVE = { user_id: 'f0000000-0000-4000-8000-000000000006', email: 'olive@icid.local', first_name: 'Olive', last_name: 'Engineer' }
const NAMELESS = { user_id: 'f0000000-0000-4000-8000-000000000009', email: 'nobody@icid.local', first_name: null, last_name: null }
const REZA = { user_id: ADMIN.uuid, email: ADMIN.email, first_name: 'Reza', last_name: null }
const USERS = [KHAN, OLIVE, NAMELESS, REZA]

const member = (user, role) => ({
  user_uuid: user.user_id, email: user.email, first_name: user.first_name, last_name: user.last_name, role,
  assigned_at: '2026-10-06T14:00:00Z',
})

vi.mock('../../services/api', () => ({ getProjectRoles: vi.fn(), changeProjectRole: vi.fn(), listUsers: vi.fn() }))

let server
let reloadOwnRoles
let refreshTaskCount

beforeEach(() => {
  vi.clearAllMocks()
  reloadOwnRoles = vi.fn()
  refreshTaskCount = vi.fn()
  server = [member(OLIVE, 'oe'), member(KHAN, 'inspector'), member(KHAN, 're')]
  api.listUsers.mockResolvedValue(USERS)
  api.getProjectRoles.mockImplementation(async () => ({ members: structuredClone(server), message: 'Project roles' }))
  api.changeProjectRole.mockImplementation(async (_, { userUuid, role, action }) => {
    const held = server.some(m => m.user_uuid === userUuid && m.role === role)
    if (action === 'grant' && !held) server = [...server, member(USERS.find(u => u.user_id === userUuid), role)]
    if (action === 'revoke') server = server.filter(m => !(m.user_uuid === userUuid && m.role === role))
    const message = action === 'grant' ? (held ? 'Role already held' : 'Role granted') : (held ? 'Role revoked' : 'Role was not held')
    return { members: structuredClone(server), message }
  })
})

function CurrentUrl() {
  return <div data-testid="url">{useLocation().pathname}</div>
}

function renderPage(user = ADMIN) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(
    <MemoryRouter initialEntries={['/admin/projects/HWS0023/roles']}>
      <ProjectRolesContext.Provider value={{ rolesByProject: {}, error: null, reload: reloadOwnRoles }}>
        <TaskCountContext.Provider value={{ total: 0, refresh: refreshTaskCount }}>
          <Routes>
            <Route path="/admin/projects/:projectId/roles" element={<ProjectRolesPage />} />
            <Route path="*" element={<CurrentUrl />} />
          </Routes>
        </TaskCountContext.Provider>
      </ProjectRolesContext.Provider>
    </MemoryRouter>
  )
}

const ready = () => screen.findByRole('heading', { name: 'Add role' })
const rows = () => screen.getAllByRole('row').slice(1)
const rowTexts = () => rows().map(row => [0, 1].map(i => within(row).getAllByRole('cell')[i].textContent))
const grantButton = () => screen.getByRole('button', { name: /^Grant$|Working/ })

async function grant(user, userLabel, roleLabel) {
  await user.selectOptions(screen.getByLabelText('User'), userLabel)
  await user.selectOptions(screen.getByLabelText('Role'), roleLabel)
  await user.click(grantButton())
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

describe('ProjectRolesPage — the table', () => {
  it("loads the project's roles and the user list", async () => {
    renderPage()
    await ready()
    expect(api.getProjectRoles).toHaveBeenCalledWith('HWS0023')
    expect(api.listUsers).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: 'Project Roles — HWS0023' })).toBeInTheDocument()
  })

  it('has User, Role and Action columns, one row per user and role', async () => {
    renderPage()
    await ready()
    expect(screen.getAllByRole('columnheader').map(th => th.textContent)).toEqual(['User', 'Role', 'Action'])
    expect(rowTexts()).toEqual([
      ['Olive Engineerolive@icid.local', 'OE'],
      ['Genghis KhanKhanG@magnoleng.pc', 'Inspector'],
      ['Genghis KhanKhanG@magnoleng.pc', 'RE'],
    ])
    for (const row of rows()) expect(within(row).getByRole('button', { name: /^Revoke/ })).toBeEnabled()
  })

  it('shows a user without a name by their email, once', async () => {
    server = [member(NAMELESS, 'inspector')]
    renderPage()
    await ready()
    expect(rowTexts()).toEqual([['nobody@icid.local', 'Inspector']])
  })

  it('says so when nobody is on the project, and still offers Add role', async () => {
    server = []
    renderPage()
    await ready()
    expect(screen.getByText(/Nobody holds a role on this project yet/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(grantButton()).toBeInTheDocument()
  })

  it('goes back to the project page', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(screen.getByRole('button', { name: /Back to Project Page/ }))
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023')
  })
})

// ---------------------------------------------------------------------------
// Granting
// ---------------------------------------------------------------------------

describe('ProjectRolesPage — Add role', () => {
  it('lists every user to pick from, by name and email, and the three roles', async () => {
    renderPage()
    await ready()
    expect(within(screen.getByLabelText('User')).getAllByRole('option').map(o => o.textContent)).toEqual([
      'Choose a user…', 'Genghis Khan (KhanG@magnoleng.pc)', 'Olive Engineer (olive@icid.local)',
      'nobody@icid.local', 'Reza (reza@icid.local)',
    ])
    expect(within(screen.getByLabelText('Role')).getAllByRole('option').map(o => o.textContent)).toEqual([
      'Inspector', 'OE', 'RE',
    ])
  })

  it('keeps Grant disabled until a user is picked', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    expect(grantButton()).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('User'), 'Olive Engineer (olive@icid.local)')
    expect(grantButton()).toBeEnabled()
  })

  it('grants the role, shows the new row and what happened, and clears the picker', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await grant(user, 'Olive Engineer (olive@icid.local)', 'RE')
    expect(await screen.findByText('Role granted')).toBeInTheDocument()
    expect(api.changeProjectRole).toHaveBeenCalledWith('HWS0023', { userUuid: OLIVE.user_id, role: 're', action: 'grant' })
    expect(rowTexts()).toContainEqual(['Olive Engineerolive@icid.local', 'RE'])
    expect(rows()).toHaveLength(4)
    expect(screen.getByLabelText('User')).toHaveValue('')
  })

  it('adds someone new to the project', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await grant(user, 'nobody@icid.local', 'Inspector')
    await screen.findByText('Role granted')
    expect(rowTexts()).toContainEqual(['nobody@icid.local', 'Inspector'])
  })

  it('treats a role already held as a success that changes nothing', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await grant(user, 'Olive Engineer (olive@icid.local)', 'OE')
    expect(await screen.findByText('Role already held')).toBeInTheDocument()
    expect(rows()).toHaveLength(3)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a failed grant inline and leaves the table and the picker as they were', async () => {
    api.changeProjectRole.mockRejectedValueOnce(new Error('User not found'))
    const user = userEvent.setup()
    renderPage()
    await ready()
    await grant(user, 'Olive Engineer (olive@icid.local)', 'RE')
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't grant the role: User not found")
    expect(rows()).toHaveLength(3)
    expect(screen.getByLabelText('User')).toHaveValue(OLIVE.user_id) // still picked, to try again
    expect(screen.getByRole('heading', { name: 'Add role' })).toBeInTheDocument() // the page is still there
  })

  it('clears the error on the next successful change', async () => {
    api.changeProjectRole.mockRejectedValueOnce(new Error('Network error'))
    const user = userEvent.setup()
    renderPage()
    await ready()
    await grant(user, 'Olive Engineer (olive@icid.local)', 'RE')
    await screen.findByRole('alert')
    await user.click(grantButton())
    expect(await screen.findByText('Role granted')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Revoking
// ---------------------------------------------------------------------------

describe('ProjectRolesPage — Revoke', () => {
  it('asks first, then removes only that role', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(screen.getByRole('button', { name: 'Revoke RE from Genghis Khan' }))
    const dialog = screen.getByRole('dialog', { name: 'Revoke role' })
    expect(dialog).toHaveTextContent('Revoke RE from Genghis Khan on HWS0023?')
    expect(dialog).not.toHaveTextContent('only role') // he keeps Inspector
    expect(api.changeProjectRole).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))
    expect(await screen.findByText('Role revoked')).toBeInTheDocument()
    expect(api.changeProjectRole).toHaveBeenCalledWith('HWS0023', { userUuid: KHAN.user_id, role: 're', action: 'revoke' })
    expect(rowTexts()).toEqual([
      ['Olive Engineerolive@icid.local', 'OE'],
      ['Genghis KhanKhanG@magnoleng.pc', 'Inspector'],
    ])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it("warns that revoking a user's only role takes them off the project", async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(screen.getByRole('button', { name: 'Revoke OE from Olive Engineer' }))
    expect(screen.getByRole('dialog', { name: 'Revoke role' })).toHaveTextContent(
      'This is their only role here, so they will no longer see this project.')
  })

  it('does nothing when cancelled', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(screen.getByRole('button', { name: 'Revoke OE from Olive Engineer' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(api.changeProjectRole).not.toHaveBeenCalled()
    expect(rows()).toHaveLength(3)
  })

  it('shows a failed revoke inline and keeps the row', async () => {
    api.changeProjectRole.mockRejectedValueOnce(new Error('Failed to change the project role'))
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(screen.getByRole('button', { name: 'Revoke OE from Olive Engineer' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Revoke' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't revoke the role: Failed to change the project role")
    expect(rows()).toHaveLength(3)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// The admin's own roles
// ---------------------------------------------------------------------------

describe('ProjectRolesPage — changing your own roles', () => {
  it("reloads the signed-in admin's roles and task count, since the menu depends on them", async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await grant(user, 'Reza (reza@icid.local)', 'RE')
    await screen.findByText('Role granted')
    expect(reloadOwnRoles).toHaveBeenCalledTimes(1)
    expect(refreshTaskCount).toHaveBeenCalledTimes(1)
  })

  it("leaves them alone when it is someone else's role", async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await grant(user, 'Olive Engineer (olive@icid.local)', 'RE')
    await screen.findByText('Role granted')
    expect(reloadOwnRoles).not.toHaveBeenCalled()
    expect(refreshTaskCount).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Loading, errors and who may see it
// ---------------------------------------------------------------------------

describe('ProjectRolesPage — loading and errors', () => {
  it('shows a spinner while loading', () => {
    api.getProjectRoles.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it.each([
    ['the roles', () => api.getProjectRoles.mockRejectedValueOnce(new Error('Project not found'))],
    ['the user list', () => api.listUsers.mockRejectedValueOnce(new Error('Project not found'))],
  ])('shows the error when %s can\'t be loaded, and retries', async (_, fail) => {
    fail()
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText("Couldn't load project roles: Project not found")).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Add role' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await ready()).toBeInTheDocument()
    expect(rows()).toHaveLength(3)
  })
})

describe('ProjectRolesPage — admins only', () => {
  it.each([
    ['an inspector', TEST_USER],
    ['a demo user', DEMO_USER],
  ])('tells %s it is for admins, and asks the backend for nothing', async (_, user) => {
    renderPage(user)
    expect(screen.getByText('Only an admin can manage project roles.')).toBeInTheDocument()
    expect(api.getProjectRoles).not.toHaveBeenCalled()
    expect(api.listUsers).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Add role' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Back to Project Page/ })).toBeInTheDocument()
  })
})
