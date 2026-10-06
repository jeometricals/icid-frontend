import { createContext, useCallback, useContext, useMemo, useState } from 'react'

/**
 * What a RedlinedField needs to draw one field of an IDR and, for its reviewer, edit it. Provided around the header
 * form on the IDR page and around a report's sections on a report page; with no provider a RedlinedField just
 * renders the control it wraps.
 * Value: reportId (null for the header), edits (the IDR's field_edits), isDraft (the IDR is a draft, so the form's
 * own inputs are live and the history only reads beside them), canEdit (edit mode is on and the signed-in user is
 * this stage's reviewer), saveField(fieldPath, newValue) → {ok} | {ok: false, message} | {ok: false, conflict: true},
 * and for pay items revise(itemId, quantity) and addItem(item), which answer the same way.
 */
const RedlineContext = createContext(null)

export const useRedline = () => useContext(RedlineContext)

export const RedlineProvider = RedlineContext.Provider

// Edit mode is per IDR and outlives a page: a reviewer turns it on on the IDR page and it is still on in a report
const EditModeContext = createContext(null)

/**
 * Remembers, for as long as the app is open, which IDRs the reviewer has edit mode on for. Sits around the routes.
 */
export function EditModeProvider({ children }) {
  const [on, setOn] = useState({})
  const toggle = useCallback((idrId) => setOn(prev => ({ ...prev, [idrId]: !prev[idrId] })), [])
  const value = useMemo(() => ({ on, toggle }), [on, toggle])
  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>
}

/**
 * Edit mode for one IDR: [isOn, toggle]. Off by default. Outside an EditModeProvider (a page rendered on its own)
 * the state is the page's own.
 */
export function useEditMode(idrId) {
  const shared = useContext(EditModeContext)
  const [local, setLocal] = useState(false)
  if (shared) return [Boolean(shared.on[idrId]), () => shared.toggle(idrId)]
  return [local, () => setLocal(isOn => !isOn)]
}
