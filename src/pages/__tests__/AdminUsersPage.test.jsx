import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AdminUsersPage, { roleLabel } from '../AdminUsersPage'
import * as api from '../../services/api'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

// ---------------------------------------------------------------------------
// Shared mocks: a tiny in-memory "server", so the list read after a save shows what the backend wrote
// ---------------------------------------------------------------------------

const ADMIN = { ...TEST_USER, uuid: 'a0000000-0000-4000-8000-000000000001', email: 'reza@icid.local', first_name: 'Reza',
  last_name: null, role: 'admin' }
// As the backend lists them: by last name, first name and email
const LISTED = [{ ...TEST_USER, has_signature: false, signature_set_at: null }, DEMO_USER, ADMIN]

vi.mock('../../services/api', () => ({
  listAdminUsers: vi.fn(), patchAdminUser: vi.fn(), createAdminUser: vi.fn(), resetUserPassword: vi.fn(),
}))

let server
let refreshUser

beforeEach(() => {
  vi.clearAllMocks()
  refreshUser = vi.fn().mockResolvedValue(ADMIN)
  server = structuredClone(LISTED)
  api.listAdminUsers.mockImplementation(async () => structuredClone(server))
  api.patchAdminUser.mockImplementation(async (userId, names) => {
    server = server.map(row => (row.uuid === userId ? { ...row, ...names } : row))
    return server.find(row => row.uuid === userId)
  })
  api.createAdminUser.mockImplementation(async ({ email, first_name, last_name, is_admin }) => {
    const created = { uuid: 'c0000000-0000-4000-8000-000000000003', email, first_name, last_name: last_name || null,
      role: is_admin ? 'admin' : null, is_demo: false, has_signature: false, signature_set_at: null }
    server = [...server, created]
    return created
  })
  api.resetUserPassword.mockImplementation(async (userId) => server.find(row => row.uuid === userId))
})

function CurrentUrl() {
  return <div data-testid="url">{useLocation().pathname}</div>
}

function renderPage(user = ADMIN) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user, refreshUser })
  return render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <Routes>
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

const ready = () => screen.findByRole('table')
const rows = () => screen.getAllByRole('row').slice(1)
const rowFor = (email) => rows().find(row => within(row).getAllByRole('cell')[0].textContent === email)
const cells = (email) => within(rowFor(email)).getAllByRole('cell').map(cell => cell.textContent)
const dialog = () => screen.queryByRole('dialog')
const editRow = (email) => userEvent.click(within(rowFor(email)).getByRole('button', { name: 'Edit' }))
const saveButton = () => within(dialog()).getByRole('button', { name: 'Save' })

async function retype(label, text) {
  const input = within(dialog()).getByLabelText(label)
  await userEvent.clear(input)
  if (text) await userEvent.type(input, text)
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

describe('AdminUsersPage — the table', () => {
  it('reads the users once and lists them in the backend\'s order', async () => {
    renderPage()
    await ready()
    expect(api.listAdminUsers).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: 'All Users (Admin)' })).toBeInTheDocument()
    expect(rows().map(row => within(row).getAllByRole('cell')[0].textContent))
      .toEqual([TEST_USER.email, DEMO_USER.email, ADMIN.email])
  })

  it('has the columns, with Actions last', async () => {
    renderPage()
    await ready()
    expect(screen.getAllByRole('columnheader').map(th => th.textContent))
      .toEqual(['Email', 'First Name', 'Last Name', 'Role', 'Signature', 'Actions'])
  })

  it('shows each user\'s names and role, with a dash for a missing name', async () => {
    renderPage()
    await ready()
    expect(cells(TEST_USER.email).slice(0, 4)).toEqual([TEST_USER.email, 'Genghis', 'Khan', 'Regular'])
    expect(cells(DEMO_USER.email).slice(0, 4)).toEqual([DEMO_USER.email, 'Demo', '—', 'Demo'])
    expect(cells(ADMIN.email).slice(0, 4)).toEqual([ADMIN.email, 'Reza', '—', 'Admin'])
  })

  it('ticks the users who have a signature', async () => {
    renderPage()
    await ready()
    expect(within(rowFor(ADMIN.email)).getByLabelText('Has a signature')).toBeInTheDocument()
    expect(within(rowFor(TEST_USER.email)).getByLabelText('No signature')).toBeInTheDocument()
    expect(within(rowFor(TEST_USER.email)).queryByLabelText('Has a signature')).not.toBeInTheDocument()
  })

  it('names the role of an admin, a demo user and anyone else', () => {
    expect([ADMIN, DEMO_USER, TEST_USER].map(roleLabel)).toEqual(['Admin', 'Demo', 'Regular'])
  })

  it('shows a spinner while loading, then says when there is nobody', async () => {
    let finish
    api.listAdminUsers.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
    await act(async () => finish([]))
    expect(screen.getByText('No users to show.')).toBeInTheDocument()
  })

  it('shows a failed load with a Retry that reads again', async () => {
    api.listAdminUsers.mockRejectedValueOnce(new Error('Failed to fetch users'))
    renderPage()
    expect(await screen.findByText("Couldn't load the users: Failed to fetch users")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await ready()
    expect(api.listAdminUsers).toHaveBeenCalledTimes(2)
  })

  it('goes back to the projects', async () => {
    renderPage()
    await ready()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Projects' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/projects')
  })
})

// ---------------------------------------------------------------------------
// Editing a user
// ---------------------------------------------------------------------------

describe('AdminUsersPage — editing a user', () => {
  it('opens the dialog with that user\'s names filled in', async () => {
    renderPage()
    await ready()
    await editRow(TEST_USER.email)
    expect(screen.getByRole('dialog', { name: 'Edit User' })).toBeInTheDocument()
    expect(within(dialog()).getByLabelText('First name')).toHaveValue('Genghis')
    expect(within(dialog()).getByLabelText('Last name')).toHaveValue('Khan')
    expect(within(dialog()).getByText(TEST_USER.email)).toBeInTheDocument()
  })

  it('saves the changed name, closes the dialog and reads the list again', async () => {
    renderPage()
    await ready()
    await editRow(TEST_USER.email)
    await retype('Last name', 'Borjigin')
    await userEvent.click(saveButton())
    expect(api.patchAdminUser).toHaveBeenCalledTimes(1)
    expect(api.patchAdminUser).toHaveBeenCalledWith(TEST_USER.uuid, { last_name: 'Borjigin' })
    expect(dialog()).not.toBeInTheDocument()
    expect(api.listAdminUsers).toHaveBeenCalledTimes(2)
    expect(cells(TEST_USER.email).slice(1, 3)).toEqual(['Genghis', 'Borjigin'])
    expect(refreshUser).not.toHaveBeenCalled()
  })

  it('sends both names when both changed', async () => {
    renderPage()
    await ready()
    await editRow(DEMO_USER.email)
    await retype('First name', 'Dana')
    await retype('Last name', 'Tester')
    await userEvent.click(saveButton())
    expect(api.patchAdminUser).toHaveBeenCalledWith(DEMO_USER.uuid, { first_name: 'Dana', last_name: 'Tester' })
    expect(cells(DEMO_USER.email).slice(1, 3)).toEqual(['Dana', 'Tester'])
  })

  it('refuses an emptied name inline and sends nothing', async () => {
    renderPage()
    await ready()
    await editRow(TEST_USER.email)
    await retype('Last name', '')
    await userEvent.click(saveButton())
    expect(within(dialog()).getByRole('alert')).toHaveTextContent("Last name can't be blank.")
    expect(api.patchAdminUser).not.toHaveBeenCalled()
    expect(api.listAdminUsers).toHaveBeenCalledTimes(1)
  })

  it('re-reads the signed-in user when the admin renames themselves', async () => {
    renderPage()
    await ready()
    await editRow(ADMIN.email)
    await retype('Last name', 'Mousavian')
    await userEvent.click(saveButton())
    expect(api.patchAdminUser).toHaveBeenCalledWith(ADMIN.uuid, { last_name: 'Mousavian' })
    expect(refreshUser).toHaveBeenCalledTimes(1)
    expect(cells(ADMIN.email)[2]).toBe('Mousavian')
  })

  it('keeps the dialog open with the reason when the save is refused', async () => {
    api.patchAdminUser.mockRejectedValueOnce(new Error('User not found'))
    renderPage()
    await ready()
    await editRow(TEST_USER.email)
    await retype('Last name', 'Borjigin')
    await userEvent.click(saveButton())
    expect(within(dialog()).getByRole('alert')).toHaveTextContent("Couldn't save the user: User not found")
    expect(api.listAdminUsers).toHaveBeenCalledTimes(1)
    expect(within(dialog()).getByLabelText('Last name')).toHaveValue('Borjigin')
  })

  it('forgets a failed save\'s error when the dialog is opened again', async () => {
    api.patchAdminUser.mockRejectedValueOnce(new Error('User not found'))
    renderPage()
    await ready()
    await editRow(TEST_USER.email)
    await retype('Last name', 'Borjigin')
    await userEvent.click(saveButton())
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    await editRow(TEST_USER.email)
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(dialog()).getByLabelText('Last name')).toHaveValue('Khan')
  })

  it('says so when the save worked but the list could not be read again', async () => {
    renderPage()
    await ready()
    api.listAdminUsers.mockRejectedValueOnce(new Error('Network error'))
    await editRow(TEST_USER.email)
    await retype('Last name', 'Borjigin')
    await userEvent.click(saveButton())
    expect(dialog()).not.toBeInTheDocument()
    expect(screen.getByRole('alert'))
      .toHaveTextContent("The change was saved, but the list couldn't be refreshed: Network error")
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await ready()
    expect(cells(TEST_USER.email)[2]).toBe('Borjigin')
  })

  it('cancels without saving', async () => {
    renderPage()
    await ready()
    await editRow(TEST_USER.email)
    await retype('Last name', 'Borjigin')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(dialog()).not.toBeInTheDocument()
    expect(api.patchAdminUser).not.toHaveBeenCalled()
    expect(cells(TEST_USER.email)[2]).toBe('Khan')
  })
})

// ---------------------------------------------------------------------------
// Creating a user
// ---------------------------------------------------------------------------

describe('AdminUsersPage — creating a user', () => {
  const openCreate = () => userEvent.click(screen.getByRole('button', { name: 'Create user' }))
  const submit = () => userEvent.click(within(dialog()).getByRole('button', { name: 'Create user' }))
  const banner = () => screen.queryByRole('status')

  async function fillIn({ email = 'test1@icid.local', firstName = 'Test', password = 'test1234' } = {}) {
    await userEvent.type(within(dialog()).getByLabelText('Email'), email)
    await userEvent.type(within(dialog()).getByLabelText('First name'), firstName)
    await userEvent.type(within(dialog()).getByLabelText('Password'), password)
  }

  it('has a Create user button that opens the dialog', async () => {
    renderPage()
    await ready()
    expect(dialog()).not.toBeInTheDocument()
    await openCreate()
    expect(screen.getByRole('dialog', { name: 'Create User' })).toBeInTheDocument()
    expect(within(dialog()).getByLabelText('Email')).toHaveValue('')
  })

  it('creates the user, closes the dialog, reads the list again and announces them once', async () => {
    renderPage()
    await ready()
    await openCreate()
    await fillIn()
    await submit()
    expect(api.createAdminUser).toHaveBeenCalledTimes(1)
    expect(api.createAdminUser).toHaveBeenCalledWith(
      { email: 'test1@icid.local', first_name: 'Test', last_name: '', password: 'test1234', is_admin: false })
    expect(dialog()).not.toBeInTheDocument()
    expect(api.listAdminUsers).toHaveBeenCalledTimes(2)
    expect(cells('test1@icid.local').slice(0, 4)).toEqual(['test1@icid.local', 'Test', '—', 'Regular'])
    expect(banner()).toHaveTextContent(
      "Created user test1@icid.local. Share the password with them securely — it won't be shown again.")
    expect(banner()).not.toHaveTextContent('test1234')
  })

  it('creates an admin when the box is ticked', async () => {
    renderPage()
    await ready()
    await openCreate()
    await fillIn()
    await userEvent.click(within(dialog()).getByLabelText('Grant admin role'))
    await submit()
    expect(api.createAdminUser.mock.calls[0][0].is_admin).toBe(true)
    expect(cells('test1@icid.local')[3]).toBe('Admin')
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

  it.each([
    ['the Create User dialog', () => userEvent.click(screen.getByRole('button', { name: 'Create user' }))],
    ['an Edit User dialog', () => editRow(TEST_USER.email)],
    ['a Reset Password dialog', () => userEvent.click(
      within(rowFor(TEST_USER.email)).getByRole('button', { name: 'Reset password' }))],
  ])('drops the banner when %s is opened', async (_, open) => {
    renderPage()
    await ready()
    await openCreate()
    await fillIn()
    await submit()
    expect(banner()).toBeInTheDocument()
    await open()
    expect(banner()).not.toBeInTheDocument()
  })

  it('shows a taken email inline, keeps what was typed and announces nothing', async () => {
    const taken = Object.assign(new Error('A user with this email already exists'),
      { status: 409, body: { existing_user_uuid: TEST_USER.uuid } })
    api.createAdminUser.mockRejectedValueOnce(taken)
    renderPage()
    await ready()
    await openCreate()
    await fillIn({ email: 'KHANG@magnoleng.pc' })
    await submit()
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('A user with this email already exists')
    expect(within(dialog()).getByLabelText('Email')).toHaveValue('KHANG@magnoleng.pc')
    expect(within(dialog()).getByLabelText('Password')).toHaveValue('test1234')
    expect(api.listAdminUsers).toHaveBeenCalledTimes(1)
    expect(banner()).not.toBeInTheDocument()
  })

  it('shows any other refusal as the backend worded it', async () => {
    api.createAdminUser.mockRejectedValueOnce(
      Object.assign(new Error('email is not a valid email address'), { status: 400 }))
    renderPage()
    await ready()
    await openCreate()
    await fillIn({ email: 'no-at-sign' })
    await submit()
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('email is not a valid email address')
    expect(dialog()).toBeInTheDocument()
  })

  it('forgets a refusal when the dialog is opened again', async () => {
    api.createAdminUser.mockRejectedValueOnce(new Error('A user with this email already exists'))
    renderPage()
    await ready()
    await openCreate()
    await fillIn()
    await submit()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    await openCreate()
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(dialog()).getByLabelText('Email')).toHaveValue('')
  })

  it('still announces the user when the list could not be read again', async () => {
    renderPage()
    await ready()
    api.listAdminUsers.mockRejectedValueOnce(new Error('Network error'))
    await openCreate()
    await fillIn()
    await submit()
    expect(dialog()).not.toBeInTheDocument()
    expect(banner()).toHaveTextContent('Created user test1@icid.local.')
    expect(screen.getByRole('alert'))
      .toHaveTextContent("The change was saved, but the list couldn't be refreshed: Network error")
  })

  it('cancels without creating', async () => {
    renderPage()
    await ready()
    await openCreate()
    await fillIn()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(dialog()).not.toBeInTheDocument()
    expect(api.createAdminUser).not.toHaveBeenCalled()
    expect(banner()).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Resetting a password
// ---------------------------------------------------------------------------

describe('AdminUsersPage — resetting a password', () => {
  const resetButton = (email) => within(rowFor(email)).queryByRole('button', { name: 'Reset password' })
  const banner = () => screen.queryByRole('status')

  it('has a Reset password button after Edit on each row but a demo user\'s', async () => {
    renderPage()
    await ready()
    for (const email of [TEST_USER.email, ADMIN.email]) {
      expect(within(rowFor(email)).getAllByRole('button').map(button => button.textContent))
        .toEqual(['Edit', 'Reset password'])
    }
    expect(within(rowFor(DEMO_USER.email)).getAllByRole('button').map(button => button.textContent)).toEqual(['Edit'])
  })

  it('opens the dialog for that row\'s user and resets their password', async () => {
    renderPage()
    await ready()
    await userEvent.click(resetButton(TEST_USER.email))
    expect(screen.getByRole('dialog', { name: 'Reset Password' })).toBeInTheDocument()
    expect(within(dialog()).getByText(TEST_USER.email)).toBeInTheDocument()
    await userEvent.type(within(dialog()).getByLabelText('New password'), 'test1234')
    await userEvent.click(saveButton())
    expect(api.resetUserPassword).toHaveBeenCalledTimes(1)
    expect(api.resetUserPassword).toHaveBeenCalledWith(TEST_USER.uuid, { new_password: 'test1234' })
    expect(dialog()).not.toBeInTheDocument()
    expect(banner()).toHaveTextContent(
      `Password reset for ${TEST_USER.email}. Share with them securely — it won't be shown again.`)
    expect(banner()).not.toHaveTextContent('test1234')
    expect(api.listAdminUsers).toHaveBeenCalledTimes(1) // nothing in the list changed
  })

  it('drops the banner when it is dismissed', async () => {
    renderPage()
    await ready()
    await userEvent.click(resetButton(ADMIN.email))
    await userEvent.type(within(dialog()).getByLabelText('New password'), 'test1234')
    await userEvent.click(saveButton())
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(banner()).not.toBeInTheDocument()
  })

  it('keeps the dialog open with the backend\'s reason when the reset is refused, and announces nothing', async () => {
    api.resetUserPassword.mockRejectedValueOnce(Object.assign(new Error('User not found'), { status: 404 }))
    renderPage()
    await ready()
    await userEvent.click(resetButton(TEST_USER.email))
    await userEvent.type(within(dialog()).getByLabelText('New password'), 'test1234')
    await userEvent.click(saveButton())
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('User not found')
    expect(banner()).not.toBeInTheDocument()
  })

  it('cancels without resetting', async () => {
    renderPage()
    await ready()
    await userEvent.click(resetButton(TEST_USER.email))
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(dialog()).not.toBeInTheDocument()
    expect(api.resetUserPassword).not.toHaveBeenCalled()
    expect(banner()).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Admins only
// ---------------------------------------------------------------------------

describe('AdminUsersPage — admins only', () => {
  it.each([
    ['an inspector', TEST_USER],
    ['a demo user', DEMO_USER],
  ])('tells %s the page is for admins and reads nothing', async (_, user) => {
    renderPage(user)
    expect(screen.getByText('Only an admin can manage users.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create user' })).not.toBeInTheDocument()
    expect(api.listAdminUsers).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Back to Projects' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/projects')
  })
})
