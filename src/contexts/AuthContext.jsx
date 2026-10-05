import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCurrentUser, signIn, signOutOnServer, startDemo } from '../services/api'
import { clearToken, getToken, setToken, UNAUTHORIZED_EVENT } from '../services/session'

const AuthContext = createContext(null)

export const INVALID_CREDENTIALS = 'Invalid email or password'
export const CANT_REACH_SERVER = "Can't reach the server. Please try again."
export const SESSION_EXPIRED = 'Your session has expired. Please sign in again.'

// What to tell the user when signing in (or restoring a session) fails: no status means the request never got an answer
function failureMessage(err) {
  if (err.status === 401) return INVALID_CREDENTIALS
  if (err.status === undefined) return CANT_REACH_SERVER
  return err.message
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Holds the signed-in user ({uuid, email, first_name, last_name, role, is_demo}) for the whole app. On startup it
 * restores the session from the stored token (isLoading is true meanwhile). Must sit inside the Router.
 * Provides: user (null when signed out), isLoading, error (why the last sign-in or restore failed, else null),
 * login(email, password) and loginDemo() (both resolve to true on success, false with error set), and logout().
 */
export const AuthProvider = ({ children }) => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(getToken()))
  const [error, setError] = useState(null)

  // Restore the session from a stored token
  useEffect(() => {
    if (!getToken()) return
    let ignore = false
    fetchCurrentUser()
      .then(restored => { if (!ignore) setUser(restored) })
      .catch(err => {
        if (ignore) return
        // A rejected token is gone for good; any other failure keeps it, so a reload can try again
        if (err.status === 401) clearToken()
        else setError(failureMessage(err))
      })
      .finally(() => { if (!ignore) setIsLoading(false) })
    return () => { ignore = true }
  }, [])

  // apiFetch reports a 401 on any signed-in request: the session is over, wherever the user was
  useEffect(() => {
    const endSession = () => {
      clearToken()
      setUser(null)
      setError(SESSION_EXPIRED)
      navigate('/login', { replace: true })
    }
    window.addEventListener(UNAUTHORIZED_EVENT, endSession)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, endSession)
  }, [navigate])

  const startSession = async (request) => {
    setError(null)
    try {
      const session = await request()
      setToken(session.access_token)
      setUser(session.user)
      return true
    } catch (err) {
      setError(failureMessage(err))
      return false
    }
  }

  const login = (email, password) => startSession(() => signIn(email, password))

  const loginDemo = () => startSession(startDemo)

  const logout = async () => {
    if (user?.is_demo) {
      // The backend deletes a demo user and their data on sign-out. If the call fails they are signed out here
      // anyway; the backend's daily cleanup removes whatever was left behind.
      try {
        await signOutOnServer()
      } catch {
        // nothing more to do from the browser
      }
    }
    clearToken()
    setUser(null)
    setError(null)
    navigate('/login', { replace: true })
  }

  const value = { user, isLoading, error, login, loginDemo, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
