import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import LoginPage from '../LoginPage'
import { AuthProvider } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { TOKEN_KEY } from '../../services/session'
import { DEMO_USER, TEST_USER, sessionFor } from '../../test/users'

// The page runs against the real AuthProvider, so these tests cover the form and the context together
vi.mock('../../services/api', () => ({
  signIn: vi.fn(),
  startDemo: vi.fn(),
  fetchCurrentUser: vi.fn(),
  signOutOnServer: vi.fn(),
}))

const httpError = (status, message) => Object.assign(new Error(message), { status })

function CurrentUrl() {
  const location = useLocation()
  return <div data-testid="url">{location.pathname + location.search}</div>
}

function renderLogin(entry = '/login') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<CurrentUrl />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

const emailInput = () => screen.getByLabelText('Email')
const passwordInput = () => screen.getByLabelText('Password')
const signInButton = () => screen.getByRole('button', { name: /sign in|signing in/i })
const demoButton = () => screen.getByRole('button', { name: /try demo mode|starting demo/i })

async function fillAndSubmit(user, email = 'KhanG@magnoleng.pc', password = 'secret-pw') {
  await user.type(emailInput(), email)
  await user.type(passwordInput(), password)
  await user.click(signInButton())
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('LoginPage — form', () => {
  it('renders the logo, an email and a password field, Sign in and Try Demo Mode', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: 'ICID Co.' })).toBeInTheDocument()
    expect(emailInput()).toHaveAttribute('type', 'email')
    expect(passwordInput()).toHaveAttribute('type', 'password')
    expect(signInButton()).toHaveTextContent('Sign in')
    expect(signInButton()).toHaveAttribute('type', 'submit')
    expect(demoButton()).toHaveTextContent('Try Demo Mode')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('submits the typed email and password', async () => {
    api.signIn.mockResolvedValue(sessionFor(TEST_USER))
    const user = userEvent.setup()
    renderLogin()
    await fillAndSubmit(user, 'reza@icid.local', 'my-password')
    expect(api.signIn).toHaveBeenCalledWith('reza@icid.local', 'my-password')
    expect(api.startDemo).not.toHaveBeenCalled()
  })

  it('accepts an @icid.local address (the browser\'s email check must not block it)', async () => {
    renderLogin()
    await userEvent.type(emailInput(), 'reza@icid.local')
    expect(emailInput().validity.valid).toBe(true)
  })

  it('does not submit while a field is empty', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(signInButton())
    await user.type(emailInput(), 'reza@icid.local')
    await user.click(signInButton())
    expect(api.signIn).not.toHaveBeenCalled()
  })
})

describe('LoginPage — signing in', () => {
  it('goes to the project list on success and stores the token', async () => {
    api.signIn.mockResolvedValue(sessionFor(TEST_USER, 'fresh-token'))
    const user = userEvent.setup()
    renderLogin()
    await fillAndSubmit(user)
    expect(await screen.findByTestId('url')).toHaveTextContent('/projects')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('fresh-token')
  })

  it('goes back to the page the user was sent here from', async () => {
    api.signIn.mockResolvedValue(sessionFor(TEST_USER))
    const user = userEvent.setup()
    renderLogin({ pathname: '/login', state: { from: { pathname: '/project/HWS0023/drafts', search: '?x=1' } } })
    await fillAndSubmit(user)
    expect(await screen.findByTestId('url')).toHaveTextContent('/project/HWS0023/drafts?x=1')
  })

  it('shows "Invalid email or password" under the form on a 401 and stays on the page', async () => {
    api.signIn.mockRejectedValue(httpError(401, 'Invalid email or password'))
    const user = userEvent.setup()
    renderLogin()
    await fillAndSubmit(user, 'KhanG@magnoleng.pc', 'wrong-pw')
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(screen.queryByTestId('url')).not.toBeInTheDocument()
    expect(emailInput()).toHaveValue('KhanG@magnoleng.pc') // nothing typed is lost
    expect(signInButton()).toBeEnabled()
  })

  it('shows a different message when the server can\'t be reached', async () => {
    api.signIn.mockRejectedValue(new Error('Failed to fetch'))
    const user = userEvent.setup()
    renderLogin()
    await fillAndSubmit(user)
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Please try again.")
  })

  it('disables both buttons and the fields, with a spinner on Sign in, while the request is in flight', async () => {
    let answer
    api.signIn.mockReturnValue(new Promise(resolve => { answer = resolve }))
    const user = userEvent.setup()
    renderLogin()
    await fillAndSubmit(user)
    expect(signInButton()).toBeDisabled()
    expect(signInButton()).toHaveTextContent('Signing in...')
    expect(signInButton().querySelector('[role="status"]')).toBeInTheDocument()
    expect(demoButton()).toBeDisabled()
    expect(demoButton().querySelector('[role="status"]')).not.toBeInTheDocument()
    expect(emailInput()).toBeDisabled()
    await act(async () => answer(sessionFor(TEST_USER)))
    expect(await screen.findByTestId('url')).toBeInTheDocument()
  })

  it('clears the error when the next attempt succeeds', async () => {
    api.signIn.mockRejectedValueOnce(httpError(401, 'nope')).mockResolvedValueOnce(sessionFor(TEST_USER))
    const user = userEvent.setup()
    renderLogin()
    await fillAndSubmit(user)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(signInButton())
    expect(await screen.findByTestId('url')).toHaveTextContent('/projects')
  })
})

describe('LoginPage — demo mode', () => {
  it('starts a demo without credentials and goes to the project list', async () => {
    api.startDemo.mockResolvedValue(sessionFor(DEMO_USER, 'demo-token'))
    renderLogin()
    await userEvent.click(demoButton())
    expect(api.startDemo).toHaveBeenCalledTimes(1)
    expect(api.signIn).not.toHaveBeenCalled()
    expect(await screen.findByTestId('url')).toHaveTextContent('/projects')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('demo-token')
  })

  it('puts the spinner on the demo button, and disables both, while the demo starts', async () => {
    let answer
    api.startDemo.mockReturnValue(new Promise(resolve => { answer = resolve }))
    renderLogin()
    await userEvent.click(demoButton())
    expect(demoButton()).toBeDisabled()
    expect(demoButton()).toHaveTextContent('Starting demo...')
    expect(demoButton().querySelector('[role="status"]')).toBeInTheDocument()
    expect(signInButton()).toBeDisabled()
    expect(signInButton().querySelector('[role="status"]')).not.toBeInTheDocument()
    await act(async () => answer(sessionFor(DEMO_USER)))
  })

  it('shows the backend\'s reason when demo mode is unavailable', async () => {
    api.startDemo.mockRejectedValue(httpError(503, 'Demo mode is busy, try again later'))
    renderLogin()
    await userEvent.click(demoButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Demo mode is busy, try again later')
    expect(demoButton()).toBeEnabled()
  })

  it('shows the can\'t-reach message when the demo request never gets an answer', async () => {
    api.startDemo.mockRejectedValue(new Error('Failed to fetch'))
    renderLogin()
    await userEvent.click(demoButton())
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Please try again.")
  })
})

describe('LoginPage — already signed in', () => {
  it('shows a spinner while a stored session is restored, then leaves for the project list', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-token')
    let answer
    api.fetchCurrentUser.mockReturnValue(new Promise(resolve => { answer = resolve }))
    renderLogin()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    await act(async () => answer(TEST_USER))
    expect(await screen.findByTestId('url')).toHaveTextContent('/projects')
  })

  it('shows the form when the stored token turns out to be stale', async () => {
    localStorage.setItem(TOKEN_KEY, 'stale-token')
    api.fetchCurrentUser.mockRejectedValue(httpError(401, 'Token expired'))
    renderLogin()
    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
