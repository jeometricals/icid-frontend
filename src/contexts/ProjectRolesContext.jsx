import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { getProjectsForUser } from '../services/api'

// Outside a provider (a component rendered on its own, as in most tests) the user simply holds no roles
const NO_ROLES = { rolesByProject: {}, error: null, reload: () => {} }

const ProjectRolesContext = createContext(NO_ROLES)

export const useProjectRoles = () => useContext(ProjectRolesContext)

/**
 * Holds the roles the signed-in user has on each project ('inspector', 'oe', 're'), read once from the project
 * list when they sign in. Must sit inside AuthProvider.
 * Provides: rolesByProject ({project_id: [roles]}; null while loading, {} when signed out or when the load failed),
 * error (why the load failed, else null) and reload().
 */
export function ProjectRolesProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.uuid
  const [rolesByProject, setRolesByProject] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to reload

  useEffect(() => {
    setError(null)
    if (!userId) {
      setRolesByProject({})
      return
    }
    let ignore = false
    setRolesByProject(null)
    getProjectsForUser()
      .then(projects => {
        if (!ignore) setRolesByProject(Object.fromEntries(projects.map(p => [p.project_id, p.roles ?? []])))
      })
      .catch(err => {
        if (ignore) return
        setRolesByProject({})
        setError(err.message)
      })
    return () => { ignore = true }
  }, [userId, attempt])

  const value = { rolesByProject, error, reload: () => setAttempt(a => a + 1) }

  return <ProjectRolesContext.Provider value={value}>{children}</ProjectRolesContext.Provider>
}

export { ProjectRolesContext }
