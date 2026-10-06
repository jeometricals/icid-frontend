import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, CircleUserRound, ClipboardCheck, LogOut, PenLine } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { useGuardedLeave } from '../contexts/LeaveGuardContext'
import { useProjectRoles } from '../contexts/ProjectRolesContext'
import { reviewQueuesFor } from '../lib/reviewRoles'
import ConfirmDialog from './ConfirmDialog'
import SignatureSetupModal from './SignatureSetupModal'

/**
 * The signed-in user's menu in the app header: their first name (or email), with a "Demo Mode" badge for a demo
 * user, opening a dropdown with My queue (only for someone who reviews IDRs: an OE or RE on some project, or an
 * admin), their signature (set up or update; not for demo users, who can't submit) and Sign Out. A demo user is asked to confirm signing out, since it deletes their test data; signing out goes through
 * the page's leave guard, so a report form saves unsaved edits first.
 * Opens on click; closes on a pick, Escape or a click elsewhere. Arrow keys, Home and End move between items.
 * Takes no props; reads the user from AuthContext.
 */
export default function UserMenu() {
  const { user, logout } = useAuth()
  const { rolesByProject } = useProjectRoles()
  const navigate = useNavigate()
  const leave = useGuardedLeave()
  const [open, setOpen] = useState(false)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  // While open: a click anywhere else closes it, and focus starts on the first item
  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    menuRef.current?.querySelector('[role="menuitem"]')?.focus()
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [open])

  if (!user) return null

  const hasSignature = Boolean(user.has_signature)

  const signOut = async () => {
    setSigningOut(true)
    await logout()
  }

  // The menu, top to bottom. A new entry is one more object here; dividerAbove draws a line over it.
  const items = [
    reviewQueuesFor(user, rolesByProject).length > 0 && {
      id: 'queue',
      label: 'My queue',
      icon: ClipboardCheck,
      onSelect: () => leave(() => navigate('/review')),
    },
    !user.is_demo && {
      id: 'signature',
      label: hasSignature ? 'Update signature' : 'Set up signature',
      icon: PenLine,
      title: hasSignature && user.signature_set_at
        ? `Set on ${format(parseISO(user.signature_set_at), 'MMM d, yyyy')}`
        : undefined,
      onSelect: () => setSignatureOpen(true),
    },
    {
      id: 'sign-out',
      label: 'Sign Out',
      icon: LogOut,
      dividerAbove: true,
      onSelect: user.is_demo ? () => setConfirmOpen(true) : () => leave(signOut),
    },
  ].filter(Boolean)

  const close = ({ refocus = false } = {}) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  const select = (item) => {
    close()
    item.onSelect()
  }

  const handleMenuKeyDown = (event) => {
    const entries = Array.from(menuRef.current.querySelectorAll('[role="menuitem"]'))
    const current = entries.indexOf(document.activeElement)
    const moves = {
      ArrowDown: (current + 1) % entries.length,
      ArrowUp: (current - 1 + entries.length) % entries.length,
      Home: 0,
      End: entries.length - 1,
    }
    if (event.key in moves) {
      event.preventDefault()
      entries[moves[event.key]].focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close({ refocus: true })
    } else if (event.key === 'Tab') {
      close()
    }
  }

  const handleTriggerKeyDown = (event) => {
    if (event.key === 'ArrowDown' && !open) {
      event.preventDefault()
      setOpen(true)
    } else if (event.key === 'Escape' && open) {
      close()
    }
  }

  const name = user.first_name || user.email || 'User'

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`User menu: ${name}`}
        onClick={() => setOpen(isOpen => !isOpen)}
        onKeyDown={handleTriggerKeyDown}
        disabled={signingOut}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
      >
        <CircleUserRound className="h-5 w-5 text-gray-500" />
        <span className="text-right hidden sm:block">
          <span className="block text-sm font-medium text-gray-900">{name}</span>
          {user.is_demo && (
            <span className="block text-xs text-construction-600 font-medium">Demo Mode</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="User menu"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black/5 py-1 z-20"
        >
          {items.map((item, index) => (
            <div key={item.id} role="none">
              {item.dividerAbove && index > 0 && <div role="separator" className="my-1 border-t border-gray-100" />}
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                title={item.title}
                onClick={() => select(item)}
                className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                <item.icon className="h-4 w-4 text-gray-500" />
                <span>{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}

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
    </div>
  )
}
