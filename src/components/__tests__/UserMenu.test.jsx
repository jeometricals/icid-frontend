import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserMenu from '../UserMenu'
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

function renderMenu(user) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user, logout })
  return render(
    <div>
      <UserMenu />
      <button>elsewhere on the page</button>
    </div>
  )
}

const trigger = () => screen.getByRole('button', { name: /^User menu:/ })
const menu = () => screen.queryByRole('menu')
const item = name => screen.getByRole('menuitem', { name })
const itemNames = () => screen.getAllByRole('menuitem').map(el => el.textContent)
const confirmDialog = () => screen.queryByRole('dialog', { name: 'Sign out of demo mode?' })
const signatureDialog = name => screen.queryByRole('dialog', { name })
const open = () => userEvent.click(trigger())

beforeEach(() => {
  vi.restoreAllMocks()
  logout = vi.fn().mockResolvedValue(undefined)
})

describe('UserMenu — the trigger', () => {
  it('shows the user\'s first name and starts closed', () => {
    renderMenu(TEST_USER)
    expect(trigger()).toHaveTextContent('Genghis')
    expect(trigger()).not.toHaveTextContent('Khan')
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(menu()).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign Out' })).not.toBeInTheDocument() // it lives in the menu now
  })

  it('falls back to the email when the user has no first name', () => {
    renderMenu({ ...TEST_USER, first_name: null })
    expect(trigger()).toHaveTextContent('KhanG@magnoleng.pc')
  })

  it('shows the Demo Mode badge only for a demo user', () => {
    const { unmount } = renderMenu(TEST_USER)
    expect(screen.queryByText('Demo Mode')).not.toBeInTheDocument()
    unmount()
    renderMenu(DEMO_USER)
    expect(trigger()).toHaveTextContent('Demo')
    expect(screen.getByText('Demo Mode')).toBeInTheDocument()
  })

  it('renders nothing when nobody is signed in', () => {
    const { container } = renderMenu(null)
    expect(container.querySelector('[aria-haspopup]')).toBeNull()
  })
})

describe('UserMenu — opening and closing', () => {
  it('opens on a click, under the name, with focus on the first item', async () => {
    renderMenu(TEST_USER)
    await open()
    expect(menu()).toBeInTheDocument()
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(menu().className).toContain('right-0')
    expect(item('Update signature')).toHaveFocus()
  })

  it('closes on a second click of the name', async () => {
    renderMenu(TEST_USER)
    await open()
    await open()
    expect(menu()).not.toBeInTheDocument()
  })

  it('closes on a click elsewhere', async () => {
    renderMenu(TEST_USER)
    await open()
    await userEvent.click(screen.getByRole('button', { name: 'elsewhere on the page' }))
    expect(menu()).not.toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
  })

  it('closes on Escape and gives focus back to the name', async () => {
    renderMenu(TEST_USER)
    await open()
    await userEvent.keyboard('{Escape}')
    expect(menu()).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
  })

  it('closes when an item is picked', async () => {
    renderMenu(TEST_USER)
    await open()
    await userEvent.click(item('Update signature'))
    expect(menu()).not.toBeInTheDocument()
  })

  it('closes when focus tabs away', async () => {
    renderMenu(TEST_USER)
    await open()
    await userEvent.tab()
    expect(menu()).not.toBeInTheDocument()
  })
})

describe('UserMenu — keyboard', () => {
  it('opens with the down arrow on the name', async () => {
    renderMenu(TEST_USER)
    trigger().focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(item('Update signature')).toHaveFocus()
  })

  it('moves between items with the arrow keys, wrapping at the ends, and Home and End', async () => {
    renderMenu(TEST_USER)
    await open()
    await userEvent.keyboard('{ArrowDown}')
    expect(item('Sign Out')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(item('Update signature')).toHaveFocus() // wrapped
    await userEvent.keyboard('{ArrowUp}')
    expect(item('Sign Out')).toHaveFocus() // wrapped the other way
    await userEvent.keyboard('{Home}')
    expect(item('Update signature')).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(item('Sign Out')).toHaveFocus()
  })

  it('activates the focused item with Enter', async () => {
    renderMenu(TEST_USER)
    await open()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(logout).toHaveBeenCalledTimes(1)
    expect(menu()).not.toBeInTheDocument()
  })
})

describe('UserMenu — signature item', () => {
  it('reads "Set up signature" for a user without one, and opens the setup dialog', async () => {
    renderMenu(UNSIGNED_USER)
    await open()
    expect(itemNames()).toEqual(['Set up signature', 'Sign Out'])
    expect(item('Set up signature')).not.toHaveAttribute('title')
    await userEvent.click(item('Set up signature'))
    expect(signatureDialog('Set Up Your Signature')).toBeInTheDocument()
  })

  it('reads "Update signature" for a user with one, with a tooltip saying when it was set', async () => {
    renderMenu(TEST_USER)
    await open()
    expect(itemNames()).toEqual(['Update signature', 'Sign Out'])
    expect(item('Update signature')).toHaveAttribute('title', 'Set on Oct 1, 2026')
    await userEvent.click(item('Update signature'))
    expect(signatureDialog('Update Your Signature')).toBeInTheDocument()
  })

  it('closes the dialog when it is finished or cancelled, without signing out', async () => {
    renderMenu(UNSIGNED_USER)
    await open()
    await userEvent.click(item('Set up signature'))
    await userEvent.click(screen.getByRole('button', { name: 'cancel signature' }))
    expect(signatureDialog('Set Up Your Signature')).not.toBeInTheDocument()
    await open()
    await userEvent.click(item('Set up signature'))
    await userEvent.click(screen.getByRole('button', { name: 'finish signature' }))
    expect(signatureDialog('Set Up Your Signature')).not.toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
  })

  it('is hidden for a demo user, who keeps Sign Out', async () => {
    renderMenu(DEMO_USER)
    await open()
    expect(itemNames()).toEqual(['Sign Out'])
    expect(screen.queryByRole('menuitem', { name: /signature/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('separator')).not.toBeInTheDocument() // nothing above Sign Out to divide it from
  })

  it('is divided from Sign Out for everyone else', async () => {
    renderMenu(TEST_USER)
    await open()
    expect(screen.getAllByRole('separator')).toHaveLength(1)
  })
})

describe('UserMenu — Sign Out', () => {
  it('signs a regular user out straight away, with no confirmation', async () => {
    renderMenu(TEST_USER)
    await open()
    await userEvent.click(item('Sign Out'))
    expect(logout).toHaveBeenCalledTimes(1)
    expect(confirmDialog()).not.toBeInTheDocument()
  })

  it('asks a demo user to confirm, warning that their test data will be deleted', async () => {
    renderMenu(DEMO_USER)
    await open()
    await userEvent.click(item('Sign Out'))
    const dialog = confirmDialog()
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('This will delete all your test data. Continue?')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
  })

  it('does nothing when the demo user cancels', async () => {
    renderMenu(DEMO_USER)
    await open()
    await userEvent.click(item('Sign Out'))
    await userEvent.click(within(confirmDialog()).getByRole('button', { name: 'Cancel' }))
    expect(confirmDialog()).not.toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
  })

  it('signs the demo user out on confirmation, showing Working... meanwhile', async () => {
    let finish
    logout.mockReturnValue(new Promise(resolve => { finish = resolve }))
    renderMenu(DEMO_USER)
    await open()
    await userEvent.click(item('Sign Out'))
    await userEvent.click(within(confirmDialog()).getByRole('button', { name: 'Sign out' }))
    expect(logout).toHaveBeenCalledTimes(1)
    expect(within(confirmDialog()).getByRole('button', { name: 'Working...' })).toBeDisabled()
    expect(within(confirmDialog()).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(trigger()).toBeDisabled()
    await act(async () => finish())
  })
})
