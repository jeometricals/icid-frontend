import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateUserModal, { MAX_EMAIL_LENGTH, MAX_PASSWORD_LENGTH } from '../CreateUserModal'
import { MAX_NAME_LENGTH } from '../EditUserModal'

function renderModal(props = {}) {
  const onCreate = vi.fn()
  const onCancel = vi.fn()
  render(<CreateUserModal onCreate={onCreate} onCancel={onCancel} {...props} />)
  return { onCreate, onCancel }
}

const email = () => screen.getByLabelText('Email')
const first = () => screen.getByLabelText('First name')
const last = () => screen.getByLabelText('Last name (optional)')
const password = () => screen.getByLabelText('Password')
const admin = () => screen.getByLabelText('Grant admin role')
const createButton = () => screen.getByRole('button', { name: 'Create user' })

async function fill({ emailText = 'test1@icid.local', firstText = 'Test', passwordText = 'test1234' } = {}) {
  if (emailText) await userEvent.type(email(), emailText)
  if (firstText) await userEvent.type(first(), firstText)
  if (passwordText) await userEvent.type(password(), passwordText)
}

describe('CreateUserModal', () => {
  it('opens empty, with every field and the admin box unticked', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Create User' })).toBeInTheDocument()
    for (const input of [email(), first(), last(), password()]) expect(input).toHaveValue('')
    expect(admin()).not.toBeChecked()
    expect(createButton()).toBeDisabled()
  })

  it('shows the password as typed and says so', () => {
    renderModal()
    expect(password()).toHaveAttribute('type', 'text')
    expect(password()).toHaveAccessibleDescription(
      'At least 6 characters. Password will be visible, give it to the user securely.')
  })

  it('caps each field at what the backend takes', () => {
    renderModal()
    expect(email()).toHaveAttribute('maxLength', String(MAX_EMAIL_LENGTH))
    expect(first()).toHaveAttribute('maxLength', String(MAX_NAME_LENGTH))
    expect(last()).toHaveAttribute('maxLength', String(MAX_NAME_LENGTH))
    expect(password()).toHaveAttribute('maxLength', String(MAX_PASSWORD_LENGTH))
  })

  it.each([
    ['the email', { emailText: '' }],
    ['the first name', { firstText: '' }],
    ['the password', { passwordText: '' }],
    ['a password of six characters', { passwordText: '12345' }],
    ['an email that isn\'t only spaces', { emailText: '   ' }],
    ['a first name that isn\'t only spaces', { firstText: '  ' }],
  ])('keeps Save off without %s', async (_, values) => {
    renderModal()
    await fill(values)
    expect(createButton()).toBeDisabled()
  })

  it('turns Save on once the email, first name and a six-character password are in', async () => {
    renderModal()
    await fill({ passwordText: '123456' })
    expect(createButton()).toBeEnabled()
  })

  it('passes on the minimum: no last name, not an admin', async () => {
    const { onCreate } = renderModal()
    await fill()
    await userEvent.click(createButton())
    expect(onCreate).toHaveBeenCalledWith(
      { email: 'test1@icid.local', first_name: 'Test', last_name: '', password: 'test1234', is_admin: false })
  })

  it('passes on everything, the email and names trimmed and the password as typed', async () => {
    const { onCreate } = renderModal()
    await fill({ emailText: ' Test1@icid.local ', firstText: ' Test ', passwordText: ' pass w ' })
    await userEvent.type(last(), ' One ')
    await userEvent.click(admin())
    await userEvent.click(createButton())
    expect(onCreate).toHaveBeenCalledWith(
      { email: 'Test1@icid.local', first_name: 'Test', last_name: 'One', password: ' pass w ', is_admin: true })
  })

  it('cancels without creating', async () => {
    const { onCreate, onCancel } = renderModal()
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('locks itself while the save runs', () => {
    renderModal({ busy: true })
    for (const input of [email(), first(), last(), password(), admin()]) expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('shows why a save failed', () => {
    renderModal({ error: 'A user with this email already exists' })
    expect(screen.getByRole('alert')).toHaveTextContent('A user with this email already exists')
  })
})
