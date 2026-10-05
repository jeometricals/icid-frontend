import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

/**
 * Lets only a signed-in user through: a spinner while the session is being restored, a redirect to /login when
 * nobody is signed in, otherwise the routes nested inside it (or its children, when given).
 * Props: children (optional).
 */
export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingSpinner />

  if (!user) {
    // Remember where the user was headed so login can send them back
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children ?? <Outlet />
}
