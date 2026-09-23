import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { HardHat } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, enterDemoMode, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Page the user was sent here from by ProtectedRoute, else the project list
  const from = location.state?.from
  const redirectTo = from ? `${from.pathname}${from.search}` : '/projects'

  useEffect(() => {
    // Redirect if already logged in
    if (user) {
      navigate(redirectTo, { replace: true })
    }
  }, [user, navigate, redirectTo])

  const handleSignIn = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(username, password)
    
    if (error) {
      setError(error.message || 'Failed to sign in')
      setLoading(false)
    } else {
      navigate(redirectTo, { replace: true })
    }
  }

  const handleDemoMode = () => {
    enterDemoMode()
    navigate(redirectTo, { replace: true })
  }

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

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <form onSubmit={handleSignIn} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="input-label">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="input-field"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
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
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Demo Mode */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center mb-3">
              I don't have an account yet
            </p>
            <button
              onClick={handleDemoMode}
              disabled={loading}
              className="w-full btn-secondary"
            >
              Trial Mode
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          © 2024 ICID Co. All rights reserved.
        </p>
      </div>
    </div>
  )
}
