import { createContext, useContext, useEffect, useRef } from 'react'

/**
 * Lets the page on screen stand between the app header and a navigation away from it. A report form registers its
 * "save unsaved edits first" routine with useLeaveGuard; the header runs its own exits (the logo, Sign Out) through
 * useGuardedLeave, so they save first too, exactly like the form's own Back and Cancel buttons.
 * Without a provider (a component rendered on its own) both hooks do nothing special: exits just happen.
 */
const LeaveGuardContext = createContext(null)

export function LeaveGuardProvider({ children }) {
  const guardRef = useRef(null) // the current page's guard: (action) => runs action once leaving is safe
  return <LeaveGuardContext.Provider value={guardRef}>{children}</LeaveGuardContext.Provider>
}

/**
 * Registers the calling page's guard for as long as it is mounted. Takes guard(action): it must run action (a
 * navigation) only when leaving is safe, e.g. after saving, and not run it otherwise.
 */
export function useLeaveGuard(guard) {
  const guardRef = useContext(LeaveGuardContext)
  // Every render: the guard closes over the page's latest state
  useEffect(() => {
    if (!guardRef) return
    guardRef.current = guard
    return () => { if (guardRef.current === guard) guardRef.current = null }
  })
}

/**
 * Returns leave(action): runs action through the current page's guard, or straight away when no page has one.
 */
export function useGuardedLeave() {
  const guardRef = useContext(LeaveGuardContext)
  return (action) => (guardRef?.current ? guardRef.current(action) : action())
}
