/**
 * The sign-in page: an email and password form, and "Try Demo Mode" for visitors without an account. Failures show
 * inline under the form. Once someone is signed in it sends them to the page they were headed for, else the
 * project list.
 */
import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HardHat } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

// A small spinner inside a button whose request is in flight
function ButtonSpinner() {
  return (
    <span
      role="status"
      aria-label="Working"
      className="inline-block h-4 w-4 mr-2 align-[-2px] rounded-full border-2 border-current border-t-transparent animate-spin"
    />
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(null) // 'login' | 'demo' while that request is in flight
  const { login, loginDemo, user, isLoading, error } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Page the user was sent here from by ProtectedRoute, else the project list
  const from = location.state?.from
  const redirectTo = from ? `${from.pathname}${from.search}` : '/projects'

  useEffect(() => {
    // Signed in (just now, or already): leave the login page
    if (user) {
      navigate(redirectTo, { replace: true })
    }
  }, [user, navigate, redirectTo])

  const handleSignIn = async (e) => {
    e.preventDefault()
    setPending('login')
    await login(email, password)
    setPending(null)
  }

  const handleDemo = async () => {
    setPending('demo')
    await loginDemo()
    setPending(null)
  }

  if (isLoading) return <LoadingSpinner />

  const busy = pending !== null

  return (
    <div className="min-h-screen bg-gradient-to-br from-construction-50 to-construction-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-construction-600 p-4 rounded-full">
              <HardHat className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-construction-900">ICID Co.</h1>
          <p className="mt-2 text-sm text-gray-600">Integrated Construction Information Database</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <form onSubmit={handleSignIn} className="space-y-6">
            <div>
              <label htmlFor="email" className="input-label">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="input-field"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="password" className="input-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input-field"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>

            <button type="submit" disabled={busy} className="w-full btn-primary">
              {pending === 'login' && <ButtonSpinner />}
              {pending === 'login' ? 'Signing in...' : 'Sign in'}
            </button>

            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
          </form>

          {/* Demo Mode */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center mb-3">
              I don't have an account yet
            </p>
            <button type="button" onClick={handleDemo} disabled={busy} className="w-full btn-secondary">
              {pending === 'demo' && <ButtonSpinner />}
              {pending === 'demo' ? 'Starting demo...' : 'Try Demo Mode'}
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500">
          © 2024 ICID Co. All rights reserved.
        </p>
      </div>
    </div>
  )
}
