import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, renderHook, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth, CANT_REACH_SERVER, INVALID_CREDENTIALS, SESSION_EXPIRED } from '../AuthContext'
import * as api from '../../services/api'
import { TOKEN_KEY, UNAUTHORIZED_EVENT } from '../../services/session'
import { DEMO_USER, TEST_USER, sessionFor } from '../../test/users'

vi.mock('../../services/api', () => ({
  signIn: vi.fn(),
  startDemo: vi.fn(),
  fetchCurrentUser: vi.fn(),
  signOutOnServer: vi.fn(),
}))

const httpError = (status, message) => Object.assign(new Error(message), { status })

// Shows AuthContext's values in the DOM, with a button per method
function AuthConsumer() {
  const { user, isLoading, error, login, loginDemo, logout } = useAuth()
  const location = useLocation()
  return (
    <div>
      <div data-testid="user">{user ? user.email : 'null'}</div>
      <div data-testid="demo">{String(Boolean(user?.is_demo))}</div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="error">{error ?? 'null'}</div>
      <div data-testid="url">{location.pathname}</div>
      <button onClick={() => login('KhanG@magnoleng.pc', 'secret-pw')}>login</button>
      <button onClick={() => loginDemo()}>demo</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  )
}

function renderAuth(path = '/projects') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    </MemoryRouter>
  )
}

const shown = id => screen.getByTestId(id).textContent
const click = name => userEvent.click(screen.getByText(name))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  api.signOutOnServer.mockResolvedValue(null)
})

// ---------------------------------------------------------------------------
// Session restore on mount
// ---------------------------------------------------------------------------

describe('session restore', () => {
  it('with no stored token starts signed out, not loading, and asks the backend nothing', () => {
    renderAuth()
    expect(shown('user')).toBe('null')
    expect(shown('loading')).toBe('false')
    expect(shown('error')).toBe('null')
    expect(api.fetchCurrentUser).not.toHaveBeenCalled()
  })

  it('with a valid token is loading until /me answers, then has the user', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-token')
    let answer
    api.fetchCurrentUser.mockReturnValue(new Promise(resolve => { answer = resolve }))
    renderAuth()
    expect(shown('loading')).toBe('true')
    expect(shown('user')).toBe('null')
    await act(async () => answer(TEST_USER))
    expect(shown('loading')).toBe('false')
    expect(shown('user')).toBe(TEST_USER.email)
    expect(localStorage.getItem(TOKEN_KEY)).toBe('stored-token')
  })

  it('with a rejected token clears it and ends up signed out, without an error', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale-token')
    api.fetchCurrentUser.mockRejectedValue(httpError(401, 'Token expired'))
    renderAuth()
    await waitFor(() => expect(shown('loading')).toBe('false'))
    expect(shown('user')).toBe('null')
    expect(shown('error')).toBe('null')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('keeps the token when the server could not be reached, and says so', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-token')
    api.fetchCurrentUser.mockRejectedValue(new Error('Failed to fetch'))
    renderAuth()
    await waitFor(() => expect(shown('loading')).toBe('false'))
    expect(shown('user')).toBe('null')
    expect(shown('error')).toBe(CANT_REACH_SERVER)
    expect(localStorage.getItem(TOKEN_KEY)).toBe('stored-token') // a reload can try again
  })

  it('restores a demo session too', async () => {
    localStorage.setItem(TOKEN_KEY, 'demo-token')
    api.fetchCurrentUser.mockResolvedValue(DEMO_USER)
    renderAuth()
    await waitFor(() => expect(shown('demo')).toBe('true'))
  })
})

// ---------------------------------------------------------------------------
// login / loginDemo
// ---------------------------------------------------------------------------

describe('login', () => {
  it('signs in with the credentials, stores the token and sets the user', async () => {
    api.signIn.mockResolvedValue(sessionFor(TEST_USER, 'fresh-token'))
    renderAuth('/login')
    await click('login')
    expect(api.signIn).toHaveBeenCalledWith('KhanG@magnoleng.pc', 'secret-pw')
    expect(shown('user')).toBe(TEST_USER.email)
    expect(shown('demo')).toBe('false')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('fresh-token')
    expect(shown('error')).toBe('null')
  })

  it('resolves to true on success and false on failure', async () => {
    api.signIn.mockResolvedValueOnce(sessionFor(TEST_USER)).mockRejectedValueOnce(httpError(401, 'nope'))
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <MemoryRouter><AuthProvider>{children}</AuthProvider></MemoryRouter>,
    })
    await act(async () => expect(await result.current.login('a@b.c', 'secret-pw')).toBe(true))
    await act(async () => expect(await result.current.login('a@b.c', 'wrong-pw')).toBe(false))
  })

  it('says "Invalid email or password" on a 401 and stays signed out with no token', async () => {
    api.signIn.mockRejectedValue(httpError(401, 'Invalid email or password'))
    renderAuth('/login')
    await click('login')
    expect(shown('error')).toBe(INVALID_CREDENTIALS)
    expect(shown('user')).toBe('null')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('says the server can\'t be reached on a network failure', async () => {
    api.signIn.mockRejectedValue(new Error('Failed to fetch'))
    renderAuth('/login')
    await click('login')
    expect(shown('error')).toBe(CANT_REACH_SERVER)
  })

  it('passes any other failure\'s message through', async () => {
    api.signIn.mockRejectedValue(httpError(422, 'String should have at least 6 characters'))
    renderAuth('/login')
    await click('login')
    expect(shown('error')).toBe('String should have at least 6 characters')
  })

  it('clears the previous error when a new attempt starts', async () => {
    api.signIn.mockRejectedValueOnce(httpError(401, 'nope')).mockResolvedValueOnce(sessionFor(TEST_USER))
    renderAuth('/login')
    await click('login')
    expect(shown('error')).toBe(INVALID_CREDENTIALS)
    await click('login')
    expect(shown('error')).toBe('null')
    expect(shown('user')).toBe(TEST_USER.email)
  })
})

describe('loginDemo', () => {
  it('starts a demo, stores its token and sets the demo user', async () => {
    api.startDemo.mockResolvedValue(sessionFor(DEMO_USER, 'demo-token'))
    renderAuth('/login')
    await click('demo')
    expect(api.startDemo).toHaveBeenCalledTimes(1)
    expect(shown('user')).toBe(DEMO_USER.email)
    expect(shown('demo')).toBe('true')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('demo-token')
  })

  it('shows the backend\'s reason when demo mode is unavailable', async () => {
    api.startDemo.mockRejectedValue(httpError(503, 'Demo mode is busy, try again later'))
    renderAuth('/login')
    await click('demo')
    expect(shown('error')).toBe('Demo mode is busy, try again later')
    expect(shown('user')).toBe('null')
  })
})

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

describe('logout', () => {
  it('for a regular user clears the session locally, without calling the backend, and goes to /login', async () => {
    api.signIn.mockResolvedValue(sessionFor(TEST_USER))
    renderAuth('/projects')
    await click('login')
    await click('logout')
    expect(api.signOutOnServer).not.toHaveBeenCalled()
    expect(shown('user')).toBe('null')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(shown('url')).toBe('/login')
  })

  it('for a demo user tells the backend first (with the token still stored), then clears and goes to /login', async () => {
    api.startDemo.mockResolvedValue(sessionFor(DEMO_USER, 'demo-token'))
    let tokenDuringCall
    api.signOutOnServer.mockImplementation(async () => { tokenDuringCall = localStorage.getItem(TOKEN_KEY); return null })
    renderAuth('/projects')
    await click('demo')
    await click('logout')
    expect(api.signOutOnServer).toHaveBeenCalledTimes(1)
    expect(tokenDuringCall).toBe('demo-token') // the backend needs it to know whom to delete
    expect(shown('user')).toBe('null')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(shown('url')).toBe('/login')
  })

  it('still signs a demo user out when the backend call fails', async () => {
    api.startDemo.mockResolvedValue(sessionFor(DEMO_USER))
    api.signOutOnServer.mockRejectedValue(new Error('Failed to fetch'))
    renderAuth('/projects')
    await click('demo')
    await click('logout')
    expect(shown('user')).toBe('null')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(shown('url')).toBe('/login')
    expect(shown('error')).toBe('null')
  })
})

// ---------------------------------------------------------------------------
// A 401 anywhere ends the session
// ---------------------------------------------------------------------------

describe('a 401 from any request', () => {
  it('signs the user out, goes to /login and says the session expired', async () => {
    api.signIn.mockResolvedValue(sessionFor(TEST_USER))
    renderAuth('/project/HWS0023')
    await click('login')
    expect(shown('user')).toBe(TEST_USER.email)

    act(() => { window.dispatchEvent(new Event(UNAUTHORIZED_EVENT)) })

    expect(shown('user')).toBe('null')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(shown('url')).toBe('/login')
    expect(shown('error')).toBe(SESSION_EXPIRED)
    expect(api.signOutOnServer).not.toHaveBeenCalled()
  })

  it('stops listening once the provider is gone', () => {
    const { unmount } = renderAuth()
    unmount()
    expect(() => window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// useAuth outside provider
// ---------------------------------------------------------------------------

describe('useAuth outside provider', () => {
  it('throws if used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within an AuthProvider')
    spy.mockRestore()
  })
})
