import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppHeader from '../AppHeader'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

let logout

function renderHeader(user) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user, logout })
  return render(<AppHeader />)
}

const signOutButton = () => screen.getByRole('button', { name: 'Sign Out' })
const confirmDialog = () => screen.queryByRole('dialog', { name: 'Sign out of demo mode?' })

beforeEach(() => {
  vi.restoreAllMocks()
  logout = vi.fn().mockResolvedValue(undefined)
})

describe('AppHeader', () => {
  it('shows the logo and the signed-in user\'s first name', () => {
    renderHeader(TEST_USER)
    expect(screen.getByText('ICID Co.')).toBeInTheDocument()
    expect(screen.getByText('Genghis')).toBeInTheDocument()
    expect(screen.queryByText('Genghis Khan')).not.toBeInTheDocument()
  })

  it('falls back to the email when the user has no first name', () => {
    renderHeader({ ...TEST_USER, first_name: null })
    expect(screen.getByText('KhanG@magnoleng.pc')).toBeInTheDocument()
  })

  it('shows the Demo Mode badge only for a demo user', () => {
    const { unmount } = renderHeader(TEST_USER)
    expect(screen.queryByText('Demo Mode')).not.toBeInTheDocument()
    unmount()
    renderHeader(DEMO_USER)
    expect(screen.getByText('Demo')).toBeInTheDocument()
    expect(screen.getByText('Demo Mode')).toBeInTheDocument()
  })

  it('signs a regular user out straight away, with no confirmation', async () => {
    renderHeader(TEST_USER)
    await userEvent.click(signOutButton())
    expect(logout).toHaveBeenCalledTimes(1)
    expect(confirmDialog()).not.toBeInTheDocument()
  })

  it('asks a demo user to confirm, warning that their test data will be deleted', async () => {
    renderHeader(DEMO_USER)
    await userEvent.click(signOutButton())
    const dialog = confirmDialog()
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('This will delete all your test data. Continue?')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
  })

  it('does nothing when the demo user cancels', async () => {
    renderHeader(DEMO_USER)
    await userEvent.click(signOutButton())
    await userEvent.click(within(confirmDialog()).getByRole('button', { name: 'Cancel' }))
    expect(confirmDialog()).not.toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
  })

  it('signs the demo user out on confirmation, showing Working... meanwhile', async () => {
    let finish
    logout.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderHeader(DEMO_USER)
    await userEvent.click(signOutButton())
    await userEvent.click(within(confirmDialog()).getByRole('button', { name: 'Sign out' }))
    expect(logout).toHaveBeenCalledTimes(1)
    expect(within(confirmDialog()).getByRole('button', { name: 'Working...' })).toBeDisabled()
    expect(within(confirmDialog()).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await act(async () => finish())
  })
})
