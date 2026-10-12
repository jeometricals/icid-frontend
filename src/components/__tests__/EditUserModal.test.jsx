import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditUserModal, { MAX_NAME_LENGTH } from '../EditUserModal'
import { TEST_USER } from '../../test/users'

function renderModal(props = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(<EditUserModal user={TEST_USER} onSave={onSave} onCancel={onCancel} {...props} />)
  return { onSave, onCancel }
}

const first = () => screen.getByLabelText('First name')
const last = () => screen.getByLabelText('Last name')
const saveButton = () => screen.getByRole('button', { name: 'Save' })

async function retype(input, text) {
  await userEvent.clear(input)
  if (text) await userEvent.type(input, text)
}

describe('EditUserModal', () => {
  it('opens with both names filled in, the email shown, and Save off', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Edit User' })).toBeInTheDocument()
    expect(first()).toHaveValue('Genghis')
    expect(last()).toHaveValue('Khan')
    expect(screen.getByText(TEST_USER.email)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it('shows empty fields for a user with no names', () => {
    renderModal({ user: { ...TEST_USER, first_name: null, last_name: null } })
    expect(first()).toHaveValue('')
    expect(last()).toHaveValue('')
  })

  it('caps each name at the length the backend takes', () => {
    renderModal()
    expect(first()).toHaveAttribute('maxLength', String(MAX_NAME_LENGTH))
    expect(last()).toHaveAttribute('maxLength', String(MAX_NAME_LENGTH))
  })

  it('passes on only the name that changed, trimmed', async () => {
    const { onSave } = renderModal()
    await retype(last(), '  Borjigin ')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ last_name: 'Borjigin' })
  })

  it('passes on both names when both changed', async () => {
    const { onSave } = renderModal()
    await retype(first(), 'Temujin')
    await retype(last(), 'Borjigin')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ first_name: 'Temujin', last_name: 'Borjigin' })
  })

  it('treats a name typed back as it was, or only padded, as unchanged', async () => {
    renderModal()
    await retype(last(), ' Khan ')
    expect(saveButton()).toBeDisabled()
  })

  it('refuses an emptied name inline and saves nothing', async () => {
    const { onSave } = renderModal()
    await retype(last(), '   ')
    await userEvent.click(saveButton())
    expect(screen.getByRole('alert')).toHaveTextContent("Last name can't be blank.")
    expect(last()).toHaveAttribute('aria-invalid', 'true')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('clears the inline error once the name is typed again', async () => {
    const { onSave } = renderModal()
    await retype(first(), '')
    await userEvent.click(saveButton())
    expect(screen.getByRole('alert')).toHaveTextContent("First name can't be blank.")
    await userEvent.type(first(), 'Temujin')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ first_name: 'Temujin' })
  })

  it('lets a name that was never set stay empty', async () => {
    const { onSave } = renderModal({ user: { ...TEST_USER, last_name: null } })
    await retype(first(), 'Temujin')
    await userEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledWith({ first_name: 'Temujin' })
  })

  it('cancels without saving', async () => {
    const { onSave, onCancel } = renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('locks itself while the save runs', () => {
    renderModal({ busy: true })
    expect(first()).toBeDisabled()
    expect(last()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('shows why a save failed', () => {
    renderModal({ error: "Couldn't save the user: User not found" })
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save the user: User not found")
  })
})
