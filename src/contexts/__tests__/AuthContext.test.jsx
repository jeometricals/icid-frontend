import { describe, it, expect } from 'vitest'
import { render, screen, act, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../AuthContext'
import { GENGHIS_UUID } from '../../constants/devUser'

// ---------------------------------------------------------------------------
// Helper — renders a component that exposes AuthContext values via the DOM
// ---------------------------------------------------------------------------

function AuthConsumer() {
  const { user, loading, isDemoMode, signIn, signOut, enterDemoMode } = useAuth()
  return (
    <div>
      <div data-testid="user">{user ? JSON.stringify(user) : 'null'}</div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="demo">{String(isDemoMode)}</div>
      <button onClick={() => signIn('any@email.com', 'anypassword')}>sign-in</button>
      <button onClick={() => signOut()}>sign-out</button>
      <button onClick={() => enterDemoMode()}>demo</button>
    </div>
  )
}

function renderAuth() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  )
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('AuthContext initial state', () => {
  it('starts with no user', () => {
    renderAuth()
    expect(screen.getByTestId('user').textContent).toBe('null')
  })

  it('loading is false from the start', () => {
    renderAuth()
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('isDemoMode is false from the start', () => {
    renderAuth()
    expect(screen.getByTestId('demo').textContent).toBe('false')
  })
})

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------

describe('signIn', () => {
  it('sets the dev user regardless of credentials', async () => {
    renderAuth()
    await userEvent.click(screen.getByText('sign-in'))
    const user = JSON.parse(screen.getByTestId('user').textContent)
    expect(user.id).toBe(GENGHIS_UUID)
    expect(user.email).toBe('KhanG@magnoleng.pc')
    expect(user.user_metadata.full_name).toBe('Genghis Khan')
  })

  it('sets isDemoMode to false after sign-in', async () => {
    renderAuth()
    await userEvent.click(screen.getByText('demo'))
    await userEvent.click(screen.getByText('sign-in'))
    expect(screen.getByTestId('demo').textContent).toBe('false')
  })

  it('returns an object with no error', async () => {
    let result
    function Capture() {
      const { signIn } = useAuth()
      return (
        <button onClick={async () => { result = await signIn('x', 'y') }}>go</button>
      )
    }
    render(<AuthProvider><Capture /></AuthProvider>)
    await userEvent.click(screen.getByText('go'))
    expect(result.error).toBeNull()
    expect(result.data).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------

describe('signOut', () => {
  it('clears the user', async () => {
    renderAuth()
    await userEvent.click(screen.getByText('sign-in'))
    await userEvent.click(screen.getByText('sign-out'))
    expect(screen.getByTestId('user').textContent).toBe('null')
  })

  it('clears isDemoMode', async () => {
    renderAuth()
    await userEvent.click(screen.getByText('demo'))
    await userEvent.click(screen.getByText('sign-out'))
    expect(screen.getByTestId('demo').textContent).toBe('false')
  })

  it('returns an object with no error', async () => {
    let result
    function Capture() {
      const { signOut } = useAuth()
      return (
        <button onClick={async () => { result = await signOut() }}>go</button>
      )
    }
    render(<AuthProvider><Capture /></AuthProvider>)
    await userEvent.click(screen.getByText('go'))
    expect(result.error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// enterDemoMode
// ---------------------------------------------------------------------------

describe('enterDemoMode', () => {
  it('sets the dev user', async () => {
    renderAuth()
    await userEvent.click(screen.getByText('demo'))
    const user = JSON.parse(screen.getByTestId('user').textContent)
    expect(user.id).toBe(GENGHIS_UUID)
  })

  it('sets isDemoMode to true', async () => {
    renderAuth()
    await userEvent.click(screen.getByText('demo'))
    expect(screen.getByTestId('demo').textContent).toBe('true')
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
