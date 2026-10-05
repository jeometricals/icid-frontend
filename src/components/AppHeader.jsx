import { useState } from 'react'
import { HardHat, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import ConfirmDialog from './ConfirmDialog'

/**
 * The app's top bar: the ICID Co. logo, the signed-in user's first name (or email), a "Demo Mode" badge for a demo
 * user, and Sign Out. A demo user is asked to confirm first, since signing out deletes their test data.
 * Takes no props; reads the user from AuthContext.
 */
export default function AppHeader() {
  const { user, logout } = useAuth()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    await logout()
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="bg-construction-600 p-2 rounded-lg">
              <HardHat className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-construction-900">ICID Co.</h1>
              <p className="text-xs text-gray-500">Integrated Construction Information Database</p>
            </div>
          </div>

          {/* User */}
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-gray-900">{user?.first_name || user?.email || 'User'}</div>
              {user?.is_demo && (
                <div className="text-xs text-construction-600 font-medium">Demo Mode</div>
              )}
            </div>
            <button
              onClick={user?.is_demo ? () => setConfirmOpen(true) : signOut}
              disabled={signingOut}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title="Sign out of demo mode?"
          message="This will delete all your test data. Continue?"
          confirmLabel="Sign out"
          cancelLabel="Cancel"
          onConfirm={signOut}
          onCancel={() => setConfirmOpen(false)}
          busy={signingOut}
        />
      )}
    </header>
  )
}
