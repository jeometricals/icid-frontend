/**
 * Every user, at /admin/users. Admins only: a table (email, first name, last name, role, whether they have a
 * signature) in the backend's order, with an Edit button on each row that opens a dialog for the user's first and
 * last name, and a "Create user" button that opens one for a new user. After a save the list is read again, so a
 * row shows what the backend wrote; when the admin renamed themselves, the signed-in user is re-read too, so the
 * header shows the new name. A created user is announced once, in a banner that reminds the admin to pass the
 * password on; it goes when dismissed or when another dialog is opened. Each row but a demo user's also has
 * "Reset password", which opens a dialog for a new password and is announced in the same banner. Anyone who isn't
 * an admin is told so instead.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, UserPlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { createAdminUser, listAdminUsers, patchAdminUser } from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
import AdminResetPasswordModal from '../components/AdminResetPasswordModal'
import CreateUserModal from '../components/CreateUserModal'
import EditUserModal from '../components/EditUserModal'

// What the Role column says: an admin, a demo user, or anyone else
export function roleLabel(user) {
  if (isAdmin(user)) return 'Admin'
  return user.is_demo ? 'Demo' : 'Regular'
}

export default function AdminUsersPage() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const admin = isAdmin(user)

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  const [editing, setEditing] = useState(null) // the user whose names are being edited
  const [creating, setCreating] = useState(false) // whether the Create User dialog is open
  const [resetting, setResetting] = useState(null) // the user whose password is being reset
  // What the one-time banner announces: {kind: 'created' | 'reset', email}
  const [announced, setAnnounced] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [refreshError, setRefreshError] = useState(null) // a save worked but the list couldn't be read again

  useEffect(() => {
    if (!admin) return
    let ignore = false
    setLoading(true)
    setLoadError(null)
    setRefreshError(null)
    listAdminUsers()
      .then(data => { if (!ignore) setUsers(data) })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [admin, attempt])

  const edit = (row) => {
    setSaveError(null)
    setAnnounced(null)
    setEditing(row)
  }

  const startCreating = () => {
    setSaveError(null)
    setAnnounced(null)
    setCreating(true)
  }

  const startResetting = (row) => {
    setAnnounced(null)
    setResetting(row)
  }

  // Runs a save; on success reads the list again rather than guessing what the backend wrote.
  // Resolves to whether the save went through.
  const run = async (request, failure) => {
    setBusy(true)
    setSaveError(null)
    try {
      await request()
    } catch (err) {
      setSaveError(failure(err))
      setBusy(false)
      return false
    }
    try {
      setUsers(await listAdminUsers())
      setRefreshError(null)
    } catch (err) {
      setRefreshError(`The change was saved, but the list couldn't be refreshed: ${err.message}`)
    }
    setBusy(false)
    return true
  }

  const save = async (changes) => {
    const saved = await run(() => patchAdminUser(editing.uuid, changes), err => `Couldn't save the user: ${err.message}`)
    if (!saved) return
    // The admin renamed themselves: the header shows their name
    if (editing.uuid === user.uuid) refreshUser().catch(() => {})
    setEditing(null)
  }

  // A refusal is shown as the backend worded it: a taken email, or the value that doesn't fit
  const create = async (values) => {
    const saved = await run(() => createAdminUser(values), err => err.message)
    if (!saved) return
    setAnnounced({ kind: 'created', email: values.email })
    setCreating(false)
  }

  const back = (
    <button
      onClick={() => navigate('/projects')}
      className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="font-medium">Back to Projects</span>
    </button>
  )

  if (!admin) {
    return (
      <div className="flex-1 bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {back}
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
            Only an admin can manage users.
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {back}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">All Users (Admin)</h2>
          <button type="button" onClick={startCreating} className="btn-primary inline-flex items-center space-x-2">
            <UserPlus className="h-4 w-4" />
            <span>Create user</span>
          </button>
        </div>

        {announced && (
          <div role="status" className="flex items-start justify-between gap-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-md px-4 py-3 mb-4">
            {announced.kind === 'created' ? (
              <p>
                Created user <span className="font-medium">{announced.email}</span>. Share the password with them
                securely — it won't be shown again.
              </p>
            ) : (
              <p>
                Password reset for <span className="font-medium">{announced.email}</span>. Share with them
                securely — it won't be shown again.
              </p>
            )}
            <button type="button" onClick={() => setAnnounced(null)} className="underline font-medium">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load the users: {loadError}</p>
            <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
          </div>
        ) : (
          <>
            {refreshError && (
              <p role="alert" className="text-sm text-red-600 mb-4">
                {refreshError}{' '}
                <button type="button" onClick={() => setAttempt(a => a + 1)} className="underline font-medium">Retry</button>
              </p>
            )}

            {users.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
                No users to show.
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Email', 'First Name', 'Last Name', 'Role', 'Signature', 'Actions'].map(heading => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map(row => (
                      <tr key={row.uuid}>
                        <td className="px-6 py-4 text-sm text-gray-900">{row.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{row.first_name || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{row.last_name || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{roleLabel(row)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {row.has_signature
                            ? <Check role="img" aria-label="Has a signature" className="h-5 w-5 text-green-600" />
                            : <span aria-label="No signature">—</span>}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => edit(row)} className="btn-secondary">Edit</button>
                            {!row.is_demo && (
                              <button type="button" onClick={() => startResetting(row)} className="btn-secondary">
                                Reset password
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {creating && (
          <CreateUserModal
            onCreate={create}
            onCancel={() => setCreating(false)}
            busy={busy}
            error={saveError}
          />
        )}

        {editing && (
          <EditUserModal
            user={editing}
            onSave={save}
            onCancel={() => setEditing(null)}
            busy={busy}
            error={saveError}
          />
        )}

        {resetting && (
          <AdminResetPasswordModal
            user={resetting}
            onClose={() => setResetting(null)}
            onSuccess={(row) => setAnnounced({ kind: 'reset', email: row.email })}
          />
        )}
      </main>
    </div>
  )
}
