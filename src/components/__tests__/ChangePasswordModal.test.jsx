import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChangePasswordModal from '../ChangePasswordModal'
import { MAX_PASSWORD_LENGTH } from '../CreateUserModal'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({ changeOwnPassword: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  api.changeOwnPassword.mockResolvedValue(null)
})

function renderModal() {
  const onClose = vi.fn()
  const onSuccess = vi.fn()
  render(<ChangePasswordModal onClose={onClose} onSuccess={onSuccess} />)
  return { onClose, onSuccess }
}

const current = () => screen.getByLabelText('Current password')
const next = () => screen.getByLabelText('New password')
const confirm = () => screen.getByLabelText('Confirm new password')
const saveButton = () => screen.getByRole('button', { name: 'Save' })

async function fill({ currentText = 'old-pass', nextText = 'new-pass', confirmText = nextText } = {}) {
  if (currentText) await userEvent.type(current(), currentText)
  if (nextText) await userEvent.type(next(), nextText)
  if (confirmText) await userEvent.type(confirm(), confirmText)
}

describe('ChangePasswordModal', () => {
  it('opens with three empty, masked fields and Save off', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Change Password' })).toBeInTheDocument()
    for (const input of [current(), next(), confirm()]) {
      expect(input).toHaveValue('')
      expect(input).toHaveAttribute('type', 'password')
      expect(input).toHaveAttribute('maxLength', String(MAX_PASSWORD_LENGTH))
    }
    expect(saveButton()).toBeDisabled()
  })

  it('shows and hides each field on its own', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'Show new password' }))
    expect(next()).toHaveAttribute('type', 'text')
    expect(current()).toHaveAttribute('type', 'password')
    expect(confirm()).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Hide new password' }))
    expect(next()).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Show current password' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show confirm new password' })).toBeInTheDocument()
  })

  it.each([
    ['the current password', { currentText: '' }],
    ['the new password', { nextText: '', confirmText: '' }],
    ['the confirmation', { confirmText: '' }],
    ['a new password of six characters', { nextText: '12345' }],
    ['a confirmation that matches', { confirmText: 'new-pasz' }],
  ])('keeps Save off without %s', async (_, values) => {
    renderModal()
    await fill(values)
    expect(saveButton()).toBeDisabled()
  })

  it('turns Save on once all three are in, six characters long, matching and different', async () => {
    renderModal()
    await fill({ nextText: '123456' })
    expect(saveButton()).toBeEnabled()
  })

  it('says when the passwords don\'t match', async () => {
    renderModal()
    await fill({ confirmText: 'new-pasz' })
    expect(screen.getByText("The passwords don't match.")).toBeInTheDocument()
  })

  it('keeps Save off, and sends nothing, when the new password is the current one', async () => {
    renderModal()
    await fill({ currentText: 'same-pass', nextText: 'same-pass' })
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText('The new password must differ from the current one.')).toBeInTheDocument()
    await userEvent.type(confirm(), '{Enter}')
    expect(api.changeOwnPassword).not.toHaveBeenCalled()
  })

  it('sends both passwords as typed, then reports the change and closes', async () => {
    const { onClose, onSuccess } = renderModal()
    await fill({ currentText: ' old pass ', nextText: ' new pass ' })
    await userEvent.click(saveButton())
    expect(api.changeOwnPassword).toHaveBeenCalledTimes(1)
    expect(api.changeOwnPassword).toHaveBeenCalledWith({ current_password: ' old pass ', new_password: ' new pass ' })
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows a wrong current password inline, stays open and keeps what was typed', async () => {
    api.changeOwnPassword.mockRejectedValueOnce(
      Object.assign(new Error('Current password is incorrect'), { status: 400 }))
    const { onClose, onSuccess } = renderModal()
    await fill()
    await userEvent.click(saveButton())
    expect(screen.getByRole('alert')).toHaveTextContent('Current password is incorrect')
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(current()).toHaveValue('old-pass')
    expect(next()).toHaveValue('new-pass')
    expect(confirm()).toHaveValue('new-pass')
    expect(saveButton()).toBeEnabled()
  })

  it('locks itself while the change runs', async () => {
    let finish
    api.changeOwnPassword.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderModal()
    await fill()
    await userEvent.click(saveButton())
    for (const input of [current(), next(), confirm()]) expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await act(async () => finish(null))
  })

  it('cancels without changing anything', async () => {
    const { onClose, onSuccess } = renderModal()
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(api.changeOwnPassword).not.toHaveBeenCalled()
  })
})
