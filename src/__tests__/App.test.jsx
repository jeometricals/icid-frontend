import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import * as api from '../services/api'
import { MOCK_CONTRACT_ITEMS } from '../test/contractItems'
import { TOKEN_KEY } from '../services/session'
import { TEST_USER, sessionFor } from '../test/users'

vi.mock('../services/api', () => ({
  getContractItems: vi.fn(),
  getProjectsForUser: vi.fn(),
  getProjectById: vi.fn(),
  getIdr: vi.fn(),
  listIdrs: vi.fn(),
  signIn: vi.fn(),
  startDemo: vi.fn(),
  fetchCurrentUser: vi.fn(),
  signOutOnServer: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  api.signIn.mockResolvedValue(sessionFor(TEST_USER))
  api.getProjectsForUser.mockResolvedValue([])
  api.getProjectById.mockResolvedValue({ project_id: 'HWS0023', project_name: 'S/W Queens 2025' })
  api.getContractItems.mockResolvedValue(MOCK_CONTRACT_ITEMS)
  api.listIdrs.mockResolvedValue([])
  api.getIdr.mockReturnValue(new Promise(() => {})) // stay loading; only the URL matters here
})

async function signIn() {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText(/email/i), 'KhanG@magnoleng.pc')
  await user.type(screen.getByPlaceholderText(/password/i), 'secret-pw')
  await user.click(screen.getByRole('button', { name: /sign in/i }))
}

// ---------------------------------------------------------------------------
// Legacy report URLs
// ---------------------------------------------------------------------------

describe('legacy /report/ URLs', () => {
  it('redirect to the General page for the same project, IDR and report', async () => {
    window.history.pushState({}, '', '/project/HWS0023/idr/idr-1/report/rep-xyz')
    render(<App />)
    await signIn()

    await vi.waitFor(() => expect(window.location.pathname).toBe('/project/HWS0023/idr/idr-1/general/rep-xyz'))
  })
})

// ---------------------------------------------------------------------------
// Redirect back after login (refresh on a protected page lands on /login first)
// ---------------------------------------------------------------------------

describe('redirect back after login', () => {
  it('returns to the original page, query string included', async () => {
    window.history.pushState({}, '', '/project/HWS0023/idr/idr-1/general/rep-1?tab=pay')
    render(<App />)
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()

    await signIn()

    await vi.waitFor(() =>
      expect(window.location.pathname + window.location.search)
        .toBe('/project/HWS0023/idr/idr-1/general/rep-1?tab=pay')
    )
  })

  it('goes to the project list when login was opened directly', async () => {
    window.history.pushState({}, '', '/login')
    render(<App />)

    await signIn()

    await vi.waitFor(() => expect(window.location.pathname).toBe('/projects'))
  })
})

// ---------------------------------------------------------------------------
// Signed out, signed in, and a session restored from a stored token
// ---------------------------------------------------------------------------

describe('protected routes', () => {
  it.each(['/', '/projects', '/project/HWS0023', '/project/HWS0023/drafts', '/project/HWS0023/idr/idr-1', '/nowhere'])(
    'sends a signed-out visitor from %s to the login page',
    async (path) => {
      window.history.pushState({}, '', path)
      render(<App />)
      expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
      expect(window.location.pathname).toBe('/login')
      expect(api.getProjectsForUser).not.toHaveBeenCalled()
    })

  it('restores the session from a stored token and stays on the page that was asked for', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-token')
    api.fetchCurrentUser.mockResolvedValue(TEST_USER)
    window.history.pushState({}, '', '/projects')
    render(<App />)
    expect(await screen.findByText('Pick A Project')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/projects')
    expect(api.signIn).not.toHaveBeenCalled()
  })

  it('sends an already signed-in user away from /login', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-token')
    api.fetchCurrentUser.mockResolvedValue(TEST_USER)
    window.history.pushState({}, '', '/login')
    render(<App />)
    await vi.waitFor(() => expect(window.location.pathname).toBe('/projects'))
  })

  it('shows the login page when the stored token is no longer valid, and forgets it', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale-token')
    api.fetchCurrentUser.mockRejectedValue(Object.assign(new Error('Token expired'), { status: 401 }))
    window.history.pushState({}, '', '/projects')
    render(<App />)
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// The app header
// ---------------------------------------------------------------------------

describe('app header', () => {
  const logoLink = () => screen.findByRole('link', { name: /ICID Co\./ })

  beforeEach(() => {
    localStorage.setItem(TOKEN_KEY, 'stored-token')
    api.fetchCurrentUser.mockResolvedValue(TEST_USER)
  })

  it.each([
    ['the project list', '/projects'],
    ['the project page', '/project/HWS0023'],
    ['Drafts', '/project/HWS0023/drafts'],
    ['the Archive', '/project/HWS0023/archive'],
    ['an IDR', '/project/HWS0023/idr/idr-1'],
    ['a General report', '/project/HWS0023/idr/idr-1/general/rep-1'],
    ['an SWCB report', '/project/HWS0023/idr/idr-1/swcb/rep-1'],
    ['an AC report', '/project/HWS0023/idr/idr-1/ac/rep-1'],
  ])('is on %s, with the user menu', async (_, path) => {
    api.listUsers = vi.fn().mockResolvedValue([])
    window.history.pushState({}, '', path)
    render(<App />)
    expect(await logoLink()).toHaveAttribute('href', '/projects')
    expect(screen.getByRole('button', { name: 'User menu: Genghis' })).toBeInTheDocument()
    expect(screen.getAllByRole('banner').length).toBeGreaterThanOrEqual(1)
    expect(window.location.pathname).toBe(path)
  })

  it('takes the user from a deep page to the project list when the logo is clicked', async () => {
    window.history.pushState({}, '', '/project/HWS0023/drafts')
    render(<App />)
    await userEvent.click(await logoLink())
    await vi.waitFor(() => expect(window.location.pathname).toBe('/projects'))
    expect(await screen.findByText('Pick A Project')).toBeInTheDocument()
  })

  it('is not on the login page', async () => {
    localStorage.clear()
    window.history.pushState({}, '', '/login')
    render(<App />)
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /ICID Co\./ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^User menu:/ })).not.toBeInTheDocument()
  })
})

describe('signing out from the user menu', () => {
  it('returns to the login page and forgets the session', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-token')
    api.fetchCurrentUser.mockResolvedValue(TEST_USER)
    window.history.pushState({}, '', '/project/HWS0023')
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'User menu: Genghis' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign Out' }))
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
