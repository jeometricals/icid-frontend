import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminResetPasswordModal from '../AdminResetPasswordModal'
import { MAX_PASSWORD_LENGTH } from '../CreateUserModal'
import * as api from '../../services/api'
import { TEST_USER } from '../../test/users'

vi.mock('../../services/api', () => ({ resetUserPassword: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  api.resetUserPassword.mockResolvedValue(TEST_USER)
})

function renderModal() {
  const onClose = vi.fn()
  const onSuccess = vi.fn()
  render(<AdminResetPasswordModal user={TEST_USER} onClose={onClose} onSuccess={onSuccess} />)
  return { onClose, onSuccess }
}

const password = () => screen.getByLabelText('New password')
const saveButton = () => screen.getByRole('button', { name: 'Save' })

describe('AdminResetPasswordModal', () => {
  it('names the user and has one empty field, shown as typed, with its helper text', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Reset Password' })).toBeInTheDocument()
    expect(screen.getByText(TEST_USER.email)).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toEqual([password()])
    expect(password()).toHaveValue('')
    expect(password()).toHaveAttribute('type', 'text')
    expect(password()).toHaveAttribute('maxLength', String(MAX_PASSWORD_LENGTH))
    expect(password()).toHaveAccessibleDescription(
      'At least 6 characters. Password will be visible, share with the user securely.')
  })

  it('keeps Save off until the password has six characters', async () => {
    renderModal()
    expect(saveButton()).toBeDisabled()
    await userEvent.type(password(), '12345')
    expect(saveButton()).toBeDisabled()
    await userEvent.type(password(), '6')
    expect(saveButton()).toBeEnabled()
  })

  it('sends the password as typed for that user, then reports the reset and closes', async () => {
    const { onClose, onSuccess } = renderModal()
    await userEvent.type(password(), ' new pass ')
    await userEvent.click(saveButton())
    expect(api.resetUserPassword).toHaveBeenCalledTimes(1)
    expect(api.resetUserPassword).toHaveBeenCalledWith(TEST_USER.uuid, { new_password: ' new pass ' })
    expect(onSuccess).toHaveBeenCalledWith(TEST_USER)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows a refusal inline as the backend worded it, stays open and keeps what was typed', async () => {
    api.resetUserPassword.mockRejectedValueOnce(
      Object.assign(new Error('new_password cannot be longer than 72 bytes'), { status: 400 }))
    const { onClose, onSuccess } = renderModal()
    await userEvent.type(password(), 'test1234')
    await userEvent.click(saveButton())
    expect(screen.getByRole('alert')).toHaveTextContent('new_password cannot be longer than 72 bytes')
    expect(password()).toHaveValue('test1234')
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('cancels without resetting', async () => {
    const { onClose } = renderModal()
    await userEvent.type(password(), 'test1234')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(api.resetUserPassword).not.toHaveBeenCalled()
  })
})
