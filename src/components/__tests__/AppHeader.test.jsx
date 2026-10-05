import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AppHeader from '../AppHeader'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER, UNSIGNED_USER } from '../../test/users'

// The real modal needs a canvas and the signature service; here it is a stand-in that can succeed or be cancelled
vi.mock('../SignatureSetupModal', () => ({
  default: ({ isOpen, onClose, onSuccess, title }) => (isOpen ? (
    <div role="dialog" aria-label={title ?? 'Set Up Your Signature'}>
      <button onClick={() => { onSuccess?.(); onClose() }}>finish signature</button>
      <button onClick={onClose}>cancel signature</button>
    </div>
  ) : null),
}))

let logout

function CurrentUrl() {
  return <div data-testid="url">{useLocation().pathname}</div>
}

function renderHeader(user, path = '/project/HWS0023/idr/idr-1') {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user, logout })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppHeader />
      <Routes>
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

const logoLink = () => screen.getByRole('link', { name: /ICID Co\./ })

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

describe('AppHeader logo', () => {
  it('is a link to the project list, wrapping the logo and the title', () => {
    renderHeader(TEST_USER)
    expect(logoLink()).toHaveAttribute('href', '/projects')
    expect(within(logoLink()).getByText('ICID Co.')).toBeInTheDocument()
    expect(within(logoLink()).getByText('Integrated Construction Information Database')).toBeInTheDocument()
    expect(logoLink().className).toContain('cursor-pointer')
    expect(logoLink().className).toContain('hover:')
  })

  it('goes to /projects when clicked from a deep page', async () => {
    renderHeader(TEST_USER, '/project/HWS0023/idr/idr-1/general/rep-1')
    await userEvent.click(logoLink())
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/projects$/)
  })

  it('stays put when clicked on the project list itself', async () => {
    renderHeader(TEST_USER, '/projects')
    await userEvent.click(logoLink())
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/projects$/)
  })

  it('works for a demo user too, without asking anything', async () => {
    renderHeader(DEMO_USER)
    await userEvent.click(logoLink())
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/projects$/)
    expect(confirmDialog()).not.toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
  })
})

describe('AppHeader signature button', () => {
  const signatureDialog = name => screen.queryByRole('dialog', { name })

  it('offers "Set up signature" to a user without one, opening the setup dialog', async () => {
    renderHeader(UNSIGNED_USER)
    const button = screen.getByRole('button', { name: 'Set up signature' })
    expect(button).toHaveAttribute('title', 'No signature on file yet')
    expect(screen.queryByRole('button', { name: 'Update signature' })).not.toBeInTheDocument()
    await userEvent.click(button)
    expect(signatureDialog('Set Up Your Signature')).toBeInTheDocument()
  })

  it('offers "Update signature" to a user with one, saying when it was set', async () => {
    renderHeader(TEST_USER)
    const button = screen.getByRole('button', { name: 'Update signature' })
    expect(button).toHaveAttribute('title', 'Signature on file, set Oct 1, 2026')
    expect(screen.queryByRole('button', { name: 'Set up signature' })).not.toBeInTheDocument()
    await userEvent.click(button)
    expect(signatureDialog('Update Your Signature')).toBeInTheDocument()
  })

  it('closes the dialog when it is finished or cancelled, without signing out or leaving the page', async () => {
    renderHeader(UNSIGNED_USER, '/project/HWS0023')
    await userEvent.click(screen.getByRole('button', { name: 'Set up signature' }))
    await userEvent.click(screen.getByRole('button', { name: 'cancel signature' }))
    expect(signatureDialog('Set Up Your Signature')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Set up signature' }))
    await userEvent.click(screen.getByRole('button', { name: 'finish signature' }))
    expect(signatureDialog('Set Up Your Signature')).not.toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
    expect(screen.getByTestId('url')).toHaveTextContent('/project/HWS0023')
  })

  it('shows neither to a demo user, who cannot submit', () => {
    renderHeader(DEMO_USER)
    expect(screen.queryByRole('button', { name: /signature/i })).not.toBeInTheDocument()
    expect(signOutButton()).toBeInTheDocument()
  })

  it('keeps Sign Out beside it', () => {
    renderHeader(TEST_USER)
    expect(screen.getByRole('button', { name: 'Update signature' }).nextElementSibling).toBe(signOutButton())
  })
})
