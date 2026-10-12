/**
 * Every user, at /admin/users. Admins only: a table (email, first name, last name, role, whether they have a
 * signature) in the backend's order, with an Edit button on each row that opens a dialog for the user's first and
 * last name. After a save the list is read again, so a row shows what the backend wrote; when the admin renamed
 * themselves, the signed-in user is re-read too, so the header shows the new name. Anyone who isn't an admin is
 * told so instead.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { listAdminUsers, patchAdminUser } from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
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
    setEditing(row)
  }

  // Saves the names, then reads the list again rather than guessing what the backend wrote
  const save = async (changes) => {
    setBusy(true)
    setSaveError(null)
    try {
      await patchAdminUser(editing.uuid, changes)
    } catch (err) {
      setSaveError(`Couldn't save the user: ${err.message}`)
      setBusy(false)
      return
    }
    try {
      setUsers(await listAdminUsers())
      setRefreshError(null)
    } catch (err) {
      setRefreshError(`The change was saved, but the list couldn't be refreshed: ${err.message}`)
    }
    // The admin renamed themselves: the header shows their name
    if (editing.uuid === user.uuid) refreshUser().catch(() => {})
    setEditing(null)
    setBusy(false)
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

        <h2 className="text-2xl font-bold text-gray-900 mb-6">All Users (Admin)</h2>

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
                          <button type="button" onClick={() => edit(row)} className="btn-secondary">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
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
      </main>
    </div>
  )
}
