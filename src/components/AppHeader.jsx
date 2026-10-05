import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HardHat, LogOut, PenLine } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { useGuardedLeave } from '../contexts/LeaveGuardContext'
import ConfirmDialog from './ConfirmDialog'
import SignatureSetupModal from './SignatureSetupModal'

/**
 * The app's top bar, on every signed-in page: the ICID Co. logo (a link to the project list), the signed-in user's
 * first name (or email), a "Demo Mode" badge for a demo user, a button to set up or update their signature (not for
 * demo users, who can't submit), and Sign Out. A demo user is asked to confirm first, since signing out deletes their
 * test data. Leaving through the logo or Sign Out goes through the page's leave
 * guard, so a report form saves unsaved edits first.
 * Takes no props; reads the user from AuthContext.
 */
export default function AppHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const leave = useGuardedLeave()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const hasSignature = Boolean(user?.has_signature)

  const signOut = async () => {
    setSigningOut(true)
    await logout()
  }

  const goToProjects = (event) => {
    event.preventDefault()
    leave(() => navigate('/projects'))
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo: home, i.e. the project list */}
          <Link
            to="/projects"
            onClick={goToProjects}
            aria-label="ICID Co. — go to the project list"
            className="flex items-center space-x-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-construction-500 focus:ring-offset-2"
          >
            <div className="bg-construction-600 p-2 rounded-lg">
              <HardHat className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-construction-900">ICID Co.</h1>
              <p className="text-xs text-gray-500">Integrated Construction Information Database</p>
            </div>
          </Link>

          {/* User */}
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-gray-900">{user?.first_name || user?.email || 'User'}</div>
              {user?.is_demo && (
                <div className="text-xs text-construction-600 font-medium">Demo Mode</div>
              )}
            </div>
            {user && !user.is_demo && (
              <button
                onClick={() => setSignatureOpen(true)}
                title={hasSignature && user.signature_set_at
                  ? `Signature on file, set ${format(parseISO(user.signature_set_at), 'MMM d, yyyy')}`
                  : 'No signature on file yet'}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <PenLine className="h-4 w-4" />
                <span className="hidden sm:inline">{hasSignature ? 'Update signature' : 'Set up signature'}</span>
              </button>
            )}
            <button
              onClick={user?.is_demo ? () => setConfirmOpen(true) : () => leave(signOut)}
              disabled={signingOut}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <SignatureSetupModal
        isOpen={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        title={hasSignature ? 'Update Your Signature' : 'Set Up Your Signature'}
      />

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
