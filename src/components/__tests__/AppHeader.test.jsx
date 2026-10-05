import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AppHeader from '../AppHeader'
import * as AuthContext from '../../contexts/AuthContext'
import { DEMO_USER, TEST_USER } from '../../test/users'

// The user menu has its own tests; the header only has to carry it
vi.mock('../SignatureSetupModal', () => ({ default: () => null }))

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
const userMenu = () => screen.getByRole('button', { name: /^User menu:/ })

beforeEach(() => {
  vi.restoreAllMocks()
  logout = vi.fn().mockResolvedValue(undefined)
})

describe('AppHeader', () => {
  it('shows the logo on the left and the user menu on the right', () => {
    renderHeader(TEST_USER)
    const header = screen.getByRole('banner')
    expect(within(header).getByText('ICID Co.')).toBeInTheDocument()
    expect(userMenu()).toHaveTextContent('Genghis')
    expect(logoLink().compareDocumentPosition(userMenu()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps Sign Out and the signature inside the menu, not on the bar', async () => {
    renderHeader(TEST_USER)
    expect(screen.queryByRole('button', { name: 'Sign Out' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /signature/i })).not.toBeInTheDocument()
    await userEvent.click(userMenu())
    expect(screen.getAllByRole('menuitem').map(el => el.textContent)).toEqual(['Update signature', 'Sign Out'])
  })

  it('signs out from the menu', async () => {
    renderHeader(TEST_USER)
    await userEvent.click(userMenu())
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign Out' }))
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('shows a demo user their Demo Mode badge', () => {
    renderHeader(DEMO_USER)
    expect(userMenu()).toHaveTextContent('Demo Mode')
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
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
  })
})
