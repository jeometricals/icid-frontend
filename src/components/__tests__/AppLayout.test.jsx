import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AppLayout from '../AppLayout'
import * as AuthContext from '../../contexts/AuthContext'
import { useLeaveGuard } from '../../contexts/LeaveGuardContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

let logout
let guard

// A page with unsaved edits: its guard decides whether (and when) a navigation away may run
function GuardedPage() {
  useLeaveGuard(guard)
  return <div>a report form</div>
}

function CurrentUrl() {
  return <div data-testid="url">{useLocation().pathname}</div>
}

function renderLayout(path = '/form', user = TEST_USER) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user, logout })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/form" element={<GuardedPage />} />
          <Route path="/plain" element={<div>a plain page</div>} />
          <Route path="/projects" element={<div>the project list</div>} />
        </Route>
      </Routes>
      <CurrentUrl />
    </MemoryRouter>
  )
}

const logoLink = () => screen.getByRole('link', { name: /ICID Co\./ })
const userMenu = () => screen.getByRole('button', { name: /^User menu:/ })
// Opens the user menu and picks Sign Out
async function chooseSignOut() {
  await userEvent.click(userMenu())
  await userEvent.click(screen.getByRole('menuitem', { name: 'Sign Out' }))
}
const url = () => screen.getByTestId('url').textContent

beforeEach(() => {
  vi.restoreAllMocks()
  logout = vi.fn().mockResolvedValue(undefined)
  guard = vi.fn(action => action())
})

describe('AppLayout', () => {
  it('renders the app header above the routed page', () => {
    renderLayout('/plain')
    const header = screen.getByRole('banner')
    const page = screen.getByText('a plain page')
    expect(header).toContainElement(logoLink())
    expect(header).toContainElement(userMenu())
    expect(header.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the header when the routed page changes', async () => {
    renderLayout('/plain')
    await userEvent.click(logoLink())
    expect(screen.getByText('the project list')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })
})

describe('AppLayout — leaving a page that guards its unsaved edits', () => {
  it('runs the logo\'s navigation through the page\'s guard', async () => {
    renderLayout()
    await userEvent.click(logoLink())
    expect(guard).toHaveBeenCalledTimes(1)
    expect(url()).toBe('/projects')
  })

  it('stays on the page when the guard doesn\'t let the navigation run (the save failed)', async () => {
    guard = vi.fn() // never runs the action
    renderLayout()
    await userEvent.click(logoLink())
    expect(guard).toHaveBeenCalledTimes(1)
    expect(url()).toBe('/form')
    expect(screen.getByText('a report form')).toBeInTheDocument()
  })

  it('waits for the guard before navigating (the save is in flight)', async () => {
    let finishSave
    guard = vi.fn(action => new Promise(resolve => { finishSave = () => resolve(action()) }))
    renderLayout()
    await userEvent.click(logoLink())
    expect(url()).toBe('/form')
    await act(async () => finishSave())
    expect(url()).toBe('/projects')
  })

  it('runs Sign Out through the guard for a regular user', async () => {
    renderLayout()
    await chooseSignOut()
    expect(guard).toHaveBeenCalledTimes(1)
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('does not sign out when the guard refuses', async () => {
    guard = vi.fn()
    renderLayout()
    await chooseSignOut()
    expect(logout).not.toHaveBeenCalled()
  })

  it('skips the guard for a demo user signing out: their data is deleted anyway', async () => {
    renderLayout('/form', DEMO_USER)
    await chooseSignOut()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(logout).toHaveBeenCalledTimes(1)
    expect(guard).not.toHaveBeenCalled()
  })

  it('forgets a page\'s guard once that page is gone', async () => {
    renderLayout()
    await userEvent.click(logoLink()) // now on /projects, which has no guard
    guard.mockClear()
    await userEvent.click(logoLink())
    expect(guard).not.toHaveBeenCalled()
  })

  it('navigates straight away from a page without a guard', async () => {
    renderLayout('/plain')
    await userEvent.click(logoLink())
    expect(guard).not.toHaveBeenCalled()
    expect(url()).toBe('/projects')
  })
})
