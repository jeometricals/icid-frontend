/**
 * Who holds which role on one project, at /admin/projects/:projectId/roles. Admins only: one row per user and role
 * (Inspector, OE, RE) with a Revoke button, and under the table an "Add role" row to grant a role to any user.
 * Each change answers with the project's roles as they now stand, so the table always shows what the server has.
 * A failed change is shown inline and leaves the table as it was. Anyone who isn't an admin is told so instead.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useProjectRoles } from '../contexts/ProjectRolesContext'
import { useTaskCount } from '../contexts/TaskCountContext'
import { changeProjectRole, getProjectRoles, listUsers } from '../services/api'
import { PROJECT_ROLE_LABELS, isAdmin } from '../lib/reviewRoles'
import { personName } from '../lib/personName'
import ConfirmDialog from '../components/ConfirmDialog'

const ROLES = Object.keys(PROJECT_ROLE_LABELS)

export default function ProjectRolesPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { reload: reloadOwnRoles } = useProjectRoles()
  const { refresh: refreshTaskCount } = useTaskCount()
  const admin = isAdmin(user)

  const [members, setMembers] = useState([]) // one entry per {user, role}
  const [users, setUsers] = useState([]) // everyone a role can be granted to
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  const [pickedUser, setPickedUser] = useState('')
  const [pickedRole, setPickedRole] = useState('inspector')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState(null) // what the last change did, in the backend's words
  const [revoking, setRevoking] = useState(null) // the member whose Revoke is waiting to be confirmed

  useEffect(() => {
    if (!admin) return
    let ignore = false
    setLoading(true)
    setLoadError(null)
    Promise.all([getProjectRoles(projectId), listUsers()])
      .then(([roles, everyone]) => {
        if (ignore) return
        setMembers(roles.members)
        setUsers(everyone)
      })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [projectId, admin, attempt])

  // Runs a grant or a revoke. Returns whether it worked; on failure the table is left as it was.
  const change = async (userUuid, role, action) => {
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      const result = await changeProjectRole(projectId, { userUuid, role, action })
      setMembers(result.members)
      setNotice(result.message)
      if (userUuid === user.uuid) {
        // The admin changed their own roles: the menu and the task count depend on them
        reloadOwnRoles()
        refreshTaskCount()
      }
      return true
    } catch (err) {
      setActionError(`Couldn't ${action} the role: ${err.message}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  const handleGrant = async (e) => {
    e.preventDefault()
    if (busy || !pickedUser) return
    if (await change(pickedUser, pickedRole, 'grant')) setPickedUser('')
  }

  const confirmRevoke = async () => {
    await change(revoking.user_uuid, revoking.role, 'revoke')
    setRevoking(null)
  }

  const back = (
    <button
      onClick={() => navigate(`/project/${projectId}`)}
      className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="font-medium">Back to Project Page</span>
    </button>
  )

  if (!admin) {
    return (
      <div className="flex-1 bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {back}
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
            Only an admin can manage project roles.
          </div>
        </main>
      </div>
    )
  }

  // The last role a user holds: revoking it takes them off the project altogether
  const isLastRole = (member) => members.filter(m => m.user_uuid === member.user_uuid).length === 1

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {back}

        <h2 className="text-2xl font-bold text-gray-900 mb-6">Project Roles — {projectId}</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load project roles: {loadError}</p>
            <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
          </div>
        ) : (
          <>
            {actionError && <p role="alert" className="text-sm text-red-600 mb-4">{actionError}</p>}
            {notice && !actionError && <p role="status" className="text-sm text-emerald-700 mb-4">{notice}</p>}

            {members.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600 mb-6">
                Nobody holds a role on this project yet. Add one below.
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-x-auto mb-6">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">User</th>
                      <th scope="col" className="px-4 py-3">Role</th>
                      <th scope="col" className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {members.map(member => (
                      <tr key={`${member.user_uuid}:${member.role}`}>
                        <td className="px-4 py-3">
                          <span className="block font-medium text-gray-900">{personName(member)}</span>
                          {personName(member) !== member.email && (
                            <span className="block text-xs text-gray-500">{member.email}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{PROJECT_ROLE_LABELS[member.role] || member.role}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setRevoking(member)}
                            disabled={busy}
                            aria-label={`Revoke ${PROJECT_ROLE_LABELS[member.role] || member.role} from ${personName(member)}`}
                            className="btn-secondary"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form onSubmit={handleGrant} className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="form-section-title">Add role</h3>
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[14rem]">
                  <label htmlFor="grant-user" className="input-label">User</label>
                  <select
                    id="grant-user"
                    className="input-field"
                    value={pickedUser}
                    disabled={busy}
                    onChange={(e) => setPickedUser(e.target.value)}
                  >
                    <option value="">Choose a user…</option>
                    {users.map(u => (
                      <option key={u.user_id} value={u.user_id}>
                        {personName(u) === u.email ? u.email : `${personName(u)} (${u.email})`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="grant-role" className="input-label">Role</label>
                  <select
                    id="grant-role"
                    className="input-field"
                    value={pickedRole}
                    disabled={busy}
                    onChange={(e) => setPickedRole(e.target.value)}
                  >
                    {ROLES.map(role => <option key={role} value={role}>{PROJECT_ROLE_LABELS[role]}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={busy || !pickedUser} className="btn-primary">
                  {busy ? 'Working...' : 'Grant'}
                </button>
              </div>
            </form>
          </>
        )}

        {revoking && (
          <ConfirmDialog
            title="Revoke role"
            message={`Revoke ${PROJECT_ROLE_LABELS[revoking.role] || revoking.role} from ${personName(revoking)} on ${projectId}?`}
            note={isLastRole(revoking)
              ? 'This is their only role here, so they will no longer see this project.'
              : null}
            confirmLabel="Revoke"
            cancelLabel="Cancel"
            onConfirm={confirmRevoke}
            onCancel={() => setRevoking(null)}
            busy={busy}
          />
        )}
      </main>
    </div>
  )
}
