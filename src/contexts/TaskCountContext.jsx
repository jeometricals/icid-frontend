import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { useProjectRoles } from './ProjectRolesContext'
import { getReviewQueue } from '../services/api'
import { isTaskFor, reviewQueuesFor } from '../lib/reviewRoles'

const NO_COUNTS = { submitted: 0, stage1_review: 0, stage2_review: 0, total: 0 }
// Outside a provider (a component rendered on its own, as in most tests) there are no tasks to count
const NO_TASKS = { ...NO_COUNTS, error: null, refresh: async () => {} }

const TaskCountContext = createContext(NO_TASKS)

export const useTaskCount = () => useContext(TaskCountContext)

/**
 * Counts the IDRs the signed-in user can act on right now (see isTaskFor), for the badges in the user menu. Reads
 * the review queues the user works once their roles are known, and again whenever refresh() is called: the review
 * toolbar does after every action, and the IDR page after a submit. Must sit inside ProjectRolesProvider.
 * Provides: submitted, stage1_review, stage2_review and total (all 0 for someone who reviews nothing), error (why
 * the last read failed, else null; the counts keep their last values) and refresh().
 */
export function TaskCountProvider({ children }) {
  const { user } = useAuth()
  const { rolesByProject } = useProjectRoles()
  const [counts, setCounts] = useState(NO_COUNTS)
  const [error, setError] = useState(null)
  const latest = useRef(0) // only the newest read may set the counts

  const refresh = useCallback(async () => {
    const request = ++latest.current
    const statuses = rolesByProject === null ? [] : reviewQueuesFor(user, rolesByProject).flatMap(q => q.statuses)
    if (statuses.length === 0) {
      setCounts(NO_COUNTS)
      setError(null)
      return
    }
    try {
      const queues = await Promise.all(statuses.map(getReviewQueue))
      if (request !== latest.current) return
      const next = { ...NO_COUNTS }
      statuses.forEach((status, i) => {
        next[status] = queues[i].filter(idr => isTaskFor(idr, user, rolesByProject[idr.project_id])).length
      })
      next.total = next.submitted + next.stage1_review + next.stage2_review
      setCounts(next)
      setError(null)
    } catch (err) {
      if (request === latest.current) setError(err.message)
    }
    // The user's identity and role are all of the user this depends on
  }, [user?.uuid, user?.role, rolesByProject]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh()
  }, [refresh])

  return <TaskCountContext.Provider value={{ ...counts, error, refresh }}>{children}</TaskCountContext.Provider>
}

export { TaskCountContext }
