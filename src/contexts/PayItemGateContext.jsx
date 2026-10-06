import { createContext, useCallback, useContext, useMemo, useState } from 'react'

/**
 * What the backend last said about an IDR's pay items when it refused to approve a stage: the items still waiting
 * on the reviewer. The page can't always work that out itself (it doesn't know when the stage was last accepted,
 * and attestations from before then no longer count), so after a refusal the backend's list wins.
 * A refusal is {itemIds: the untouched pay items' ids, knownEditIds: the ids of the IDR's field_edits at that
 * moment}: an item on the list stays untouched until an edit made after the refusal attests to it.
 */
const PayItemGateContext = createContext(null)

/**
 * Remembers each IDR's last refusal for as long as the app is open, so the report page a reviewer is sent to shows
 * the same items as waiting. Sits around the routes.
 */
export function PayItemGateProvider({ children }) {
  const [refusals, setRefusals] = useState({})
  const set = useCallback((idrId, refusal) => setRefusals(prev => ({ ...prev, [idrId]: refusal })), [])
  const value = useMemo(() => ({ refusals, set }), [refusals, set])
  return <PayItemGateContext.Provider value={value}>{children}</PayItemGateContext.Provider>
}

/**
 * One IDR's last refusal: [refusal, setRefusal]; null until the backend has refused. Outside a
 * PayItemGateProvider (a page rendered on its own) the state is the page's own.
 */
export function usePayItemGate(idrId) {
  const shared = useContext(PayItemGateContext)
  const [local, setLocal] = useState(null)
  if (shared) return [shared.refusals[idrId] ?? null, refusal => shared.set(idrId, refusal)]
  return [local, setLocal]
}
