import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectRolesProvider, useProjectRoles } from '../ProjectRolesContext'
import * as api from '../../services/api'
import * as AuthContext from '../AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

vi.mock('../../services/api', () => ({ getProjectsForUser: vi.fn() }))

const PROJECTS = [
  { project_id: 'HWS0023', project_name: 'S/W Queens 2025', user_role: 'Inspector', roles: ['inspector', 'oe'] },
  { project_id: 'SE384', project_name: 'Sewer 384', user_role: null, roles: ['re'] },
]

// Shows what the context holds
function Probe() {
  const { rolesByProject, error, reload } = useProjectRoles()
  return (
    <>
      <div data-testid="roles">{rolesByProject === null ? 'loading' : JSON.stringify(rolesByProject)}</div>
      <div data-testid="error">{error}</div>
      <button onClick={reload}>reload</button>
    </>
  )
}

function renderProvider(user) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user })
  return render(<ProjectRolesProvider><Probe /></ProjectRolesProvider>)
}

const roles = () => screen.getByTestId('roles').textContent

beforeEach(() => {
  vi.clearAllMocks()
  api.getProjectsForUser.mockResolvedValue(PROJECTS)
})

describe('ProjectRolesProvider', () => {
  it("reads the signed-in user's roles on each project from the project list", async () => {
    renderProvider(TEST_USER)
    expect(roles()).toBe('loading')
    await vi.waitFor(() => expect(roles()).toBe(JSON.stringify({ HWS0023: ['inspector', 'oe'], SE384: ['re'] })))
    expect(api.getProjectsForUser).toHaveBeenCalledTimes(1)
  })

  it('holds no roles, and asks for nothing, when nobody is signed in', () => {
    renderProvider(null)
    expect(roles()).toBe('{}')
    expect(api.getProjectsForUser).not.toHaveBeenCalled()
  })

  it('treats a project listed without roles as none', async () => {
    api.getProjectsForUser.mockResolvedValue([{ project_id: 'OLD01', project_name: 'From an older backend' }])
    renderProvider(TEST_USER)
    await vi.waitFor(() => expect(roles()).toBe(JSON.stringify({ OLD01: [] })))
  })

  it('reads again when a different user signs in', async () => {
    const { rerender } = renderProvider(TEST_USER)
    await vi.waitFor(() => expect(roles()).not.toBe('loading'))
    api.getProjectsForUser.mockResolvedValue([{ project_id: 'DEMO01', roles: ['inspector'] }])
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: DEMO_USER })
    rerender(<ProjectRolesProvider><Probe /></ProjectRolesProvider>)
    await vi.waitFor(() => expect(roles()).toBe(JSON.stringify({ DEMO01: ['inspector'] })))
    expect(api.getProjectsForUser).toHaveBeenCalledTimes(2)
  })

  it('reports a failed load, holds no roles, and loads again on reload', async () => {
    api.getProjectsForUser.mockRejectedValueOnce(new Error('Failed to fetch projects'))
    renderProvider(TEST_USER)
    await vi.waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch projects'))
    expect(roles()).toBe('{}')

    await userEvent.click(screen.getByRole('button', { name: 'reload' }))
    await vi.waitFor(() => expect(roles()).toContain('HWS0023'))
    expect(screen.getByTestId('error')).toHaveTextContent('')
  })
})

describe('useProjectRoles outside a provider', () => {
  it('gives no roles rather than throwing', () => {
    render(<Probe />)
    expect(roles()).toBe('{}')
  })
})
