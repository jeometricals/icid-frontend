import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AdminUsersPage, { historyMessage, roleLabel } from '../AdminUsersPage'
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

// A user an admin soft-deleted a while ago; in the list only when deleted users are asked for
const GONE = { ...TEST_USER, uuid: 'f0000000-0000-4000-8000-000000000006', email: 'Gone.User@magnoleng.pc',
  first_name: 'Gone', last_name: 'User', has_signature: false, signature_set_at: null,
  deleted_at: '2026-10-01T12:00:00Z', deleted_by: ADMIN.uuid }

vi.mock('../../services/api', () => ({
  listAdminUsers: vi.fn(), patchAdminUser: vi.fn(), createAdminUser: vi.fn(), resetUserPassword: vi.fn(),
  softDeleteUser: vi.fn(), undeleteUser: vi.fn(), permanentDeleteUser: vi.fn(),
}))

let server
let refreshUser

beforeEach(() => {
  vi.clearAllMocks()
  refreshUser = vi.fn().mockResolvedValue(ADMIN)
  server = structuredClone([...LISTED, GONE])
  api.listAdminUsers.mockImplementation(async ({ include_deleted } = {}) => (
    structuredClone(server.filter(row => include_deleted || !row.deleted_at))
  ))
  const mark = (userId, fields) => {
    server = server.map(row => (row.uuid === userId ? { ...row, ...fields } : row))
    return server.find(row => row.uuid === userId)
  }
  api.softDeleteUser.mockImplementation(async (userId) => mark(userId, {
    deleted_at: '2026-10-13T12:00:00Z', deleted_by: ADMIN.uuid,
  }))
  api.undeleteUser.mockImplementation(async (userId) => mark(userId, { deleted_at: null, deleted_by: null }))
  api.permanentDeleteUser.mockImplementation(async (userId) => {
    server = server.filter(row => row.uuid !== userId)
  })
  api.patchAdminUser.mockImplementation(async (userId, { is_admin, ...fields }) => {
    const role = is_admin === undefined ? {} : { role: is_admin ? 'admin' : null }
    server = server.map(row => (row.uuid === userId ? { ...row, ...fields, ...role } : row))
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
    expect(within(dialog()).getByLabelText('Email')).toHaveValue(TEST_USER.email)
    expect(within(dialog()).getByLabelText('Grant admin role')).not.toBeChecked()
    expect(within(dialog()).getByLabelText('Grant admin role')).toBeEnabled()
    expect(within(dialog()).queryByLabelText('Promote to real user')).not.toBeInTheDocument()
  })

  it('changes the email and grants the admin role: confirmed first, then the list is read and the new email announced', async () => {
    renderPage()
    await ready()
    await editRow(TEST_USER.email)
    await retype('Email', 'khan@magnoleng.pc')
    await userEvent.click(within(dialog()).getByLabelText('Grant admin role'))
    await userEvent.click(saveButton())
    expect(dialog()).toHaveAccessibleName('Save changes?')
    expect(within(dialog()).getAllByRole('listitem').map(li => li.textContent)).toEqual([
      'Change email from KhanG@magnoleng.pc to khan@magnoleng.pc? The user will need to sign in with the new email.',
      'Grant admin role to KhanG@magnoleng.pc?',
    ])
    expect(api.patchAdminUser).not.toHaveBeenCalled()

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Save changes' }))
    expect(api.patchAdminUser).toHaveBeenCalledTimes(1)
    expect(api.patchAdminUser).toHaveBeenCalledWith(TEST_USER.uuid, { email: 'khan@magnoleng.pc', is_admin: true })
    expect(dialog()).not.toBeInTheDocument()
    expect(api.listAdminUsers).toHaveBeenCalledTimes(2)
    expect(cells('khan@magnoleng.pc').slice(0, 4)).toEqual(['khan@magnoleng.pc', 'Genghis', 'Khan', 'Admin'])
    expect(screen.getByRole('status')).toHaveTextContent('User khan@magnoleng.pc updated.')
  })

  it('announces a name change under the email the user keeps', async () => {
    renderPage()
    await ready()
    await editRow(TEST_USER.email)
    await retype('Last name', 'Borjigin')
    await userEvent.click(saveButton())
    expect(screen.getByRole('status')).toHaveTextContent(`User ${TEST_USER.email} updated.`)
  })

  it('promotes a demo user to a real one', async () => {
    renderPage()
    await ready()
    await editRow(DEMO_USER.email)
    await userEvent.click(within(dialog()).getByLabelText('Promote to real user'))
    await userEvent.click(saveButton())
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Save changes' }))
    expect(api.patchAdminUser).toHaveBeenCalledWith(DEMO_USER.uuid, { is_demo: false })
    expect(cells(DEMO_USER.email)[3]).toBe('Regular')
    expect(within(rowFor(DEMO_USER.email)).getByRole('button', { name: 'Reset password' })).toBeInTheDocument()
  })

  it('turns the admin box off on the admin\'s own row, and leaves it on for another admin\'s', async () => {
    server = server.map(row => (row.uuid === TEST_USER.uuid ? { ...row, role: 'admin' } : row))
    renderPage()
    await ready()
    await editRow(ADMIN.email)
    const own = within(dialog()).getByLabelText('Grant admin role')
    expect(own).toBeChecked()
    expect(own).toBeDisabled()
    expect(own).toHaveAttribute('title', 'You cannot change your own admin role.')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    await editRow(TEST_USER.email)
    expect(within(dialog()).getByLabelText('Grant admin role')).toBeChecked()
    expect(within(dialog()).getByLabelText('Grant admin role')).toBeEnabled()
  })

  it('shows a taken email inline, keeps what was typed and announces nothing', async () => {
    api.patchAdminUser.mockRejectedValueOnce(Object.assign(
      new Error('A user with this email already exists'), { status: 409, body: { existing_user_uuid: ADMIN.uuid } }))
    renderPage()
    await ready()
    await editRow(TEST_USER.email)
    await retype('Email', 'REZA@icid.local')
    await userEvent.click(saveButton())
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Save changes' }))
    expect(dialog()).toHaveAccessibleName('Edit User')
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Another user already has this email.')
    expect(within(dialog()).getByLabelText('Email')).toHaveValue('REZA@icid.local')
    expect(api.listAdminUsers).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows any other refusal as the backend worded it', async () => {
    api.patchAdminUser.mockRejectedValueOnce(
      Object.assign(new Error('email is not a valid email address'), { status: 400 }))
    renderPage()
    await ready()
    await editRow(TEST_USER.email)
    await retype('Email', 'no-at-sign')
    await userEvent.click(saveButton())
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Save changes' }))
    expect(within(dialog()).getByRole('alert'))
      .toHaveTextContent("Couldn't save the user: email is not a valid email address")
  })

  it('goes back to the form when the confirmation is cancelled, and sends nothing', async () => {
    renderPage()
    await ready()
    await editRow(TEST_USER.email)
    await retype('Email', 'khan@magnoleng.pc')
    await userEvent.click(saveButton())
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))
    expect(dialog()).toHaveAccessibleName('Edit User')
    expect(within(dialog()).getByLabelText('Email')).toHaveValue('khan@magnoleng.pc')
    expect(api.patchAdminUser).not.toHaveBeenCalled()
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
        .toEqual(['Edit', 'Reset password', 'Soft-delete'])
    }
    expect(within(rowFor(DEMO_USER.email)).getAllByRole('button').map(button => button.textContent))
      .toEqual(['Edit', 'Soft-delete'])
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
// Deleted users: the filter, soft-delete, un-delete and delete forever
// ---------------------------------------------------------------------------

describe('AdminUsersPage — deleted users', () => {
  const includeBox = () => screen.getByLabelText('Include deleted')
  const actionsIn = (email) => within(rowFor(email)).getAllByRole('button').map(button => button.textContent)
  const emails = () => rows().map(row => within(row).getAllByRole('cell')[0].textContent)
  const inDialog = (name) => within(dialog()).getByRole('button', { name })
  const toast = (text) => screen.queryByText(text)
  const HISTORY = "User has history and can't be permanently deleted: 3 IDRs, 1 project assignment, 12 audit rows. "
    + 'Keep the user soft-deleted.'

  async function includeDeleted() {
    await userEvent.click(includeBox())
    await waitFor(() => expect(emails()).toContain(GONE.email))
  }

  describe('the filter', () => {
    it('starts unticked, with deleted users left out and not asked for', async () => {
      renderPage()
      await ready()
      expect(includeBox()).not.toBeChecked()
      expect(api.listAdminUsers).toHaveBeenCalledTimes(1)
      expect(api.listAdminUsers).toHaveBeenCalledWith({ include_deleted: false })
      expect(emails()).toEqual([TEST_USER.email, DEMO_USER.email, ADMIN.email])
    })

    it('asks the backend again with deleted users when ticked, and without them when unticked', async () => {
      renderPage()
      await ready()
      await userEvent.click(includeBox())
      await waitFor(() => expect(api.listAdminUsers).toHaveBeenCalledTimes(2))
      expect(api.listAdminUsers).toHaveBeenLastCalledWith({ include_deleted: true })
      await waitFor(() => expect(emails()).toContain(GONE.email))
      await userEvent.click(includeBox())
      await waitFor(() => expect(emails()).not.toContain(GONE.email))
      expect(api.listAdminUsers).toHaveBeenLastCalledWith({ include_deleted: false })
    })

    it('keeps the table on screen while the list is read again', async () => {
      renderPage()
      await ready()
      let finish
      api.listAdminUsers.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
      await userEvent.click(includeBox())
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(rows()).toHaveLength(3)
      await act(async () => finish(structuredClone(server)))
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      expect(rows()).toHaveLength(4)
    })

    it('reads the list with deleted users again after a save made while it is ticked', async () => {
      renderPage()
      await ready()
      await includeDeleted()
      await editRow(TEST_USER.email)
      await retype('Last name', 'Borjigin')
      await userEvent.click(saveButton())
      expect(api.listAdminUsers).toHaveBeenLastCalledWith({ include_deleted: true })
      expect(emails()).toContain(GONE.email)
    })
  })

  describe('how the rows look', () => {
    it('gives a live user Edit, Reset password and Soft-delete', async () => {
      renderPage()
      await ready()
      expect(actionsIn(TEST_USER.email)).toEqual(['Edit', 'Reset password', 'Soft-delete'])
      expect(within(rowFor(TEST_USER.email)).getByRole('button', { name: 'Soft-delete' })).toBeEnabled()
    })

    it('turns Soft-delete off, with a tooltip, on the admin\'s own row', async () => {
      renderPage()
      await ready()
      const own = within(rowFor(ADMIN.email)).getByRole('button', { name: 'Soft-delete' })
      expect(own).toBeDisabled()
      expect(own).toHaveAttribute('title', 'You cannot delete your own account.')
      await userEvent.click(own)
      expect(dialog()).not.toBeInTheDocument()
      expect(within(rowFor(TEST_USER.email)).getByRole('button', { name: 'Soft-delete' })).not.toHaveAttribute('title')
    })

    it('crosses out a deleted user\'s email, reads Deleted for their role and swaps their actions', async () => {
      renderPage()
      await ready()
      await includeDeleted()
      expect(within(rowFor(GONE.email)).getByText(GONE.email)).toHaveClass('line-through')
      expect(cells(GONE.email)[3]).toBe('Deleted')
      expect(within(rowFor(GONE.email)).getByText('Deleted').parentElement).toHaveAttribute('title', 'Deleted Oct 1, 2026')
      expect(actionsIn(GONE.email)).toEqual(['Un-delete', 'Delete forever'])
      // A live user is as before
      expect(within(rowFor(TEST_USER.email)).getByText(TEST_USER.email)).not.toHaveClass('line-through')
      expect(cells(TEST_USER.email)[3]).toBe('Regular')
    })
  })

  describe('soft-delete', () => {
    const clickDelete = (email) => userEvent.click(within(rowFor(email)).getByRole('button', { name: 'Soft-delete' }))

    it('asks first, in the agreed words, and does nothing on Cancel', async () => {
      renderPage()
      await ready()
      await clickDelete(TEST_USER.email)
      expect(dialog()).toHaveAccessibleName(`Soft-delete ${TEST_USER.email}?`)
      expect(dialog()).toHaveTextContent(
        'This removes them from most lists and prevents sign-in. Their IDRs, signatures and history stay intact.')
      expect(inDialog('Soft-delete')).toHaveClass('btn-danger')
      await userEvent.click(inDialog('Cancel'))
      expect(dialog()).not.toBeInTheDocument()
      expect(api.softDeleteUser).not.toHaveBeenCalled()
      expect(emails()).toContain(TEST_USER.email)
    })

    it('deletes the user, reads the list again and says so; the user is gone from it', async () => {
      renderPage()
      await ready()
      await clickDelete(TEST_USER.email)
      await userEvent.click(inDialog('Soft-delete'))
      expect(api.softDeleteUser).toHaveBeenCalledTimes(1)
      expect(api.softDeleteUser).toHaveBeenCalledWith(TEST_USER.uuid)
      expect(dialog()).not.toBeInTheDocument()
      expect(api.listAdminUsers).toHaveBeenCalledTimes(2)
      expect(emails()).not.toContain(TEST_USER.email)
      expect(toast(`User ${TEST_USER.email} deleted.`)).toBeInTheDocument()
    })

    it('with "Include deleted" ticked, the row stays and turns into a deleted one', async () => {
      renderPage()
      await ready()
      await includeDeleted()
      await clickDelete(TEST_USER.email)
      await userEvent.click(inDialog('Soft-delete'))
      expect(cells(TEST_USER.email)[3]).toBe('Deleted')
      expect(actionsIn(TEST_USER.email)).toEqual(['Un-delete', 'Delete forever'])
    })

    it('shows a refusal in the dialog and says nothing in a toast', async () => {
      api.softDeleteUser.mockRejectedValueOnce(Object.assign(new Error('User is already deleted'), { status: 404 }))
      renderPage()
      await ready()
      await clickDelete(TEST_USER.email)
      await userEvent.click(inDialog('Soft-delete'))
      expect(within(dialog()).getByRole('alert')).toHaveTextContent("Couldn't delete the user: User is already deleted")
      expect(toast(/deleted\.$/)).not.toBeInTheDocument()
      expect(api.listAdminUsers).toHaveBeenCalledTimes(1)
    })
  })

  describe('un-delete', () => {
    const clickUndelete = () => userEvent.click(within(rowFor(GONE.email)).getByRole('button', { name: 'Un-delete' }))

    it('asks first, restores the user, reads the list again and says so', async () => {
      renderPage()
      await ready()
      await includeDeleted()
      await clickUndelete()
      expect(dialog()).toHaveAccessibleName(`Un-delete ${GONE.email}?`)
      expect(dialog()).toHaveTextContent('This brings the user back and lets them sign in again.')
      expect(api.undeleteUser).not.toHaveBeenCalled()

      await userEvent.click(inDialog('Un-delete'))
      expect(api.undeleteUser).toHaveBeenCalledTimes(1)
      expect(api.undeleteUser).toHaveBeenCalledWith(GONE.uuid)
      expect(dialog()).not.toBeInTheDocument()
      expect(cells(GONE.email)[3]).toBe('Regular')
      expect(within(rowFor(GONE.email)).getByText(GONE.email)).not.toHaveClass('line-through')
      expect(actionsIn(GONE.email)).toEqual(['Edit', 'Reset password', 'Soft-delete'])
      expect(toast(`User ${GONE.email} restored.`)).toBeInTheDocument()
    })

    it('shows a taken email in the dialog, as the backend worded it, with no toast', async () => {
      api.undeleteUser.mockRejectedValueOnce(Object.assign(
        new Error('Email is now in use by another user'), { status: 409, body: { existing_user_uuid: TEST_USER.uuid } }))
      renderPage()
      await ready()
      await includeDeleted()
      await clickUndelete()
      await userEvent.click(inDialog('Un-delete'))
      expect(within(dialog()).getByRole('alert')).toHaveTextContent(/^Email is now in use by another user$/)
      expect(toast(/restored/)).not.toBeInTheDocument()
      await userEvent.click(inDialog('Cancel'))
      expect(cells(GONE.email)[3]).toBe('Deleted')
    })

    it('does nothing on Cancel', async () => {
      renderPage()
      await ready()
      await includeDeleted()
      await clickUndelete()
      await userEvent.click(inDialog('Cancel'))
      expect(dialog()).not.toBeInTheDocument()
      expect(api.undeleteUser).not.toHaveBeenCalled()
    })
  })

  describe('delete forever', () => {
    const clickForever = () => userEvent.click(within(rowFor(GONE.email)).getByRole('button', { name: 'Delete forever' }))
    const phraseBox = () => within(dialog()).getByRole('textbox')

    it('opens a dialog that warns what goes, with its button off', async () => {
      renderPage()
      await ready()
      await includeDeleted()
      await clickForever()
      expect(dialog()).toHaveAccessibleName('Delete user forever?')
      expect(dialog()).toHaveTextContent(`This permanently removes ${GONE.email} from the system. Only possible for a `
        + "user with no IDRs, project assignments or other history. This can't be undone.")
      expect(within(dialog()).getByLabelText(`Type ${GONE.email} to confirm.`)).toHaveValue('')
      expect(inDialog('Delete forever')).toBeDisabled()
      expect(inDialog('Delete forever')).toHaveClass('btn-danger')
    })

    it('turns the button on once the email is typed, then deletes, drops the row and says so', async () => {
      renderPage()
      await ready()
      await includeDeleted()
      await clickForever()
      await userEvent.type(phraseBox(), GONE.email)
      expect(inDialog('Delete forever')).toBeEnabled()
      await userEvent.click(inDialog('Delete forever'))
      expect(api.permanentDeleteUser).toHaveBeenCalledTimes(1)
      expect(api.permanentDeleteUser).toHaveBeenCalledWith(GONE.uuid)
      expect(dialog()).not.toBeInTheDocument()
      expect(emails()).not.toContain(GONE.email)
      expect(toast(`User ${GONE.email} permanently deleted.`)).toBeInTheDocument()
    })

    it.each([
      ['another user\'s email', TEST_USER.email],
      ['the email in other capitals', GONE.email.toLowerCase()],
      ['the email with a space after it', `${GONE.email} `],
    ])('keeps the button off for %s, and sends nothing', async (_, typed) => {
      renderPage()
      await ready()
      await includeDeleted()
      await clickForever()
      await userEvent.type(phraseBox(), `${typed}{Enter}`)
      expect(inDialog('Delete forever')).toBeDisabled()
      expect(api.permanentDeleteUser).not.toHaveBeenCalled()
    })

    it('shows what still names the user when the backend refuses, keeps the row and says nothing in a toast', async () => {
      api.permanentDeleteUser.mockRejectedValueOnce(Object.assign(
        new Error("User has history and can't be permanently deleted"),
        { status: 409, body: { references: { idrs: 3, project_users: 1, audit: 12, field_edits: 0, attachments: 0 } } }))
      renderPage()
      await ready()
      await includeDeleted()
      await clickForever()
      await userEvent.type(phraseBox(), GONE.email)
      await userEvent.click(inDialog('Delete forever'))
      expect(within(dialog()).getByText(HISTORY)).toBeInTheDocument()
      expect(toast(/permanently deleted\.$/)).not.toBeInTheDocument()
      expect(api.listAdminUsers).toHaveBeenCalledTimes(2) // the first load and the re-list, nothing after the refusal
      await userEvent.click(inDialog('Cancel'))
      expect(emails()).toContain(GONE.email)
    })

    it('words the history from the counts, leaving out what there is none of', () => {
      expect(historyMessage({ idrs: 3, project_users: 1, audit: 12, field_edits: 0, attachments: 0 })).toBe(HISTORY)
      expect(historyMessage({ idrs: 1, project_users: 0, audit: 0, field_edits: 2, attachments: 1 })).toBe(
        "User has history and can't be permanently deleted: 1 IDR, 2 field edits, 1 attachment. Keep the user soft-deleted.")
      expect(historyMessage()).toBe("User has history and can't be permanently deleted. Keep the user soft-deleted.")
    })

    it('shows any other refusal as the backend worded it', async () => {
      api.permanentDeleteUser.mockRejectedValueOnce(
        Object.assign(new Error('User must be soft-deleted first'), { status: 404 }))
      renderPage()
      await ready()
      await includeDeleted()
      await clickForever()
      await userEvent.type(phraseBox(), GONE.email)
      await userEvent.click(inDialog('Delete forever'))
      expect(within(dialog()).getByText("Couldn't delete the user: User must be soft-deleted first")).toBeInTheDocument()
    })

    it('does nothing on Cancel, even with the email typed', async () => {
      renderPage()
      await ready()
      await includeDeleted()
      await clickForever()
      await userEvent.type(phraseBox(), GONE.email)
      await userEvent.click(inDialog('Cancel'))
      expect(dialog()).not.toBeInTheDocument()
      expect(api.permanentDeleteUser).not.toHaveBeenCalled()
      expect(emails()).toContain(GONE.email)
    })
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
