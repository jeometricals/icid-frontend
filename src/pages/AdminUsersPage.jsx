/**
 * Every user, at /admin/users. Admins only: a table (email, first name, last name, role, whether they have a
 * signature) in the backend's order, with an Edit button on each row that opens a dialog for the user's names,
 * email, admin role and (for a demo user) promotion to a real one, and a "Create user" button that opens one for
 * a new user. After a save the list is read again, so a row shows what the backend wrote; when the admin changed
 * themselves, the signed-in user is re-read too, so the header shows the new name. A created or updated user is
 * announced once, in a banner (a created one's reminds the admin to pass the password on); it goes when
 * dismissed or when another dialog is opened. Each row but a demo user's also has
 * "Reset password", which opens a dialog for a new password and is announced in the same banner. Every row has
 * "Soft-delete" (off on the admin's own). "Include deleted" (off to start) asks the backend for the list again with
 * soft-deleted users in it; a deleted user is crossed out, reads Deleted, and has "Un-delete" and "Delete forever"
 * instead. Those three are confirmed first (Delete forever by typing the email) and announced in a toast. Anyone
 * who isn't an admin is told so instead.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, UserPlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { format, parseISO } from 'date-fns'
import {
  createAdminUser, listAdminUsers, patchAdminUser, permanentDeleteUser, softDeleteUser, undeleteUser,
} from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
import AdminResetPasswordModal from '../components/AdminResetPasswordModal'
import ConfirmDialog from '../components/ConfirmDialog'
import CreateUserModal from '../components/CreateUserModal'
import DeleteForeverModal from '../components/DeleteForeverModal'
import EditUserModal from '../components/EditUserModal'
import StatusBadge from '../components/StatusBadge'
import Toast from '../components/Toast'

export const EMAIL_TAKEN = 'Another user already has this email.'
export const OWN_ACCOUNT_TOOLTIP = 'You cannot delete your own account.'

const isDeleted = (row) => Boolean(row.deleted_at)

// What still names a user, as the backend counts it for a refused permanent delete
const REFERENCES = [
  ['idrs', 'IDR', 'IDRs'],
  ['project_users', 'project assignment', 'project assignments'],
  ['audit', 'audit row', 'audit rows'],
  ['field_edits', 'field edit', 'field edits'],
  ['attachments', 'attachment', 'attachments'],
]

// "User has history and can't be permanently deleted: 3 IDRs, 1 project assignment. Keep the user soft-deleted."
// Takes the references of the backend's 409 ({idrs, project_users, audit, field_edits, attachments}).
export function historyMessage(references = {}) {
  const counts = REFERENCES
    .filter(([key]) => references[key] > 0)
    .map(([key, one, many]) => `${references[key]} ${references[key] === 1 ? one : many}`)
  const what = counts.length > 0 ? `: ${counts.join(', ')}` : ''
  return `User has history and can't be permanently deleted${what}. Keep the user soft-deleted.`
}

// The three delete actions: the call, the words of its confirm dialog (Delete forever has its own dialog), what
// to say when it is refused and what the toast says once it went through
const ACTIONS = {
  delete: {
    run: row => softDeleteUser(row.uuid),
    title: row => `Soft-delete ${row.email}?`,
    message: 'This removes them from most lists and prevents sign-in. Their IDRs, signatures and history stay intact.',
    confirmLabel: 'Soft-delete',
    confirmClassName: 'btn-danger',
    failure: err => `Couldn't delete the user: ${err.message}`,
    done: row => `User ${row.email} deleted.`,
  },
  undelete: {
    run: row => undeleteUser(row.uuid),
    title: row => `Un-delete ${row.email}?`,
    message: 'This brings the user back and lets them sign in again.',
    confirmLabel: 'Un-delete',
    confirmClassName: 'btn-primary',
    // A 409 is their email gone to someone else, said as the backend words it
    failure: err => (err.status === 409 ? err.message : `Couldn't un-delete the user: ${err.message}`),
    done: row => `User ${row.email} restored.`,
  },
  purge: {
    run: row => permanentDeleteUser(row.uuid),
    failure: err => (err.status === 409 ? historyMessage(err.body?.references) : `Couldn't delete the user: ${err.message}`),
    done: row => `User ${row.email} permanently deleted.`,
  },
}

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
  const [loaded, setLoaded] = useState(false) // whether there is a list to keep on screen while it is read again
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [includeDeleted, setIncludeDeleted] = useState(false)

  const [editing, setEditing] = useState(null) // the user whose names are being edited
  const [creating, setCreating] = useState(false) // whether the Create User dialog is open
  const [resetting, setResetting] = useState(null) // the user whose password is being reset
  const [pending, setPending] = useState(null) // {row, action}: the delete action waiting to be confirmed
  const [toast, setToast] = useState(null)
  // What the one-time banner announces: {kind: 'created' | 'updated' | 'reset', email}
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
    listAdminUsers({ include_deleted: includeDeleted })
      .then(data => {
        if (ignore) return
        setUsers(data)
        setLoaded(true)
      })
      .catch(err => {
        if (ignore) return
        setLoadError(err.message)
        setLoaded(false)
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [admin, includeDeleted, attempt])

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

  const ask = (row, action) => {
    setSaveError(null)
    setAnnounced(null)
    setToast(null)
    setPending({ row, action })
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
      setUsers(await listAdminUsers({ include_deleted: includeDeleted }))
      setRefreshError(null)
    } catch (err) {
      setRefreshError(`The change was saved, but the list couldn't be refreshed: ${err.message}`)
    }
    setBusy(false)
    return true
  }

  const save = async (changes) => {
    const saved = await run(
      () => patchAdminUser(editing.uuid, changes),
      err => (err.status === 409 ? EMAIL_TAKEN : `Couldn't save the user: ${err.message}`),
    )
    if (!saved) return
    // The admin changed themselves: the header shows their name
    if (editing.uuid === user.uuid) refreshUser().catch(() => {})
    setAnnounced({ kind: 'updated', email: changes.email ?? editing.email })
    setEditing(null)
  }

  // A refusal is shown as the backend worded it: a taken email, or the value that doesn't fit
  const create = async (values) => {
    const saved = await run(() => createAdminUser(values), err => err.message)
    if (!saved) return
    setAnnounced({ kind: 'created', email: values.email })
    setCreating(false)
  }

  // Runs the confirmed delete action; the list read afterwards is what moves, restyles or drops the row
  const confirm = async () => {
    const { row, action } = pending
    const done = await run(() => ACTIONS[action].run(row), ACTIONS[action].failure)
    if (!done) return
    setToast(ACTIONS[action].done(row))
    setPending(null)
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
            ) : announced.kind === 'updated' ? (
              <p>User <span className="font-medium">{announced.email}</span> updated.</p>
            ) : (
              <p>
                Password reset for <span className="font-medium">{announced.email}</span>. Share with them
                securely — it won't be shown again.
              </p>
            )}
            <button type="button" onClick={() => setAnnounced(null)} className="underline font-medium">Dismiss</button>
          </div>
        )}

        {loading && !loaded ? (
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
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-sm text-gray-700">
              <label className="inline-flex items-center space-x-2">
                <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
                <span>Include deleted</span>
              </label>
              {loading && <span className="text-gray-500">Loading...</span>}
            </div>

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
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {isDeleted(row) ? <span className="text-gray-400 line-through">{row.email}</span> : row.email}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{row.first_name || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{row.last_name || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {isDeleted(row) ? (
                            <span title={`Deleted ${format(parseISO(row.deleted_at), 'MMM d, yyyy')}`}>
                              <StatusBadge status="deleted" />
                            </span>
                          ) : roleLabel(row)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {row.has_signature
                            ? <Check role="img" aria-label="Has a signature" className="h-5 w-5 text-green-600" />
                            : <span aria-label="No signature">—</span>}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {isDeleted(row) ? (
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => ask(row, 'undelete')} className="btn-secondary">
                                Un-delete
                              </button>
                              <button type="button" onClick={() => ask(row, 'purge')} className="btn-danger">
                                Delete forever
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => edit(row)} className="btn-secondary">Edit</button>
                              {!row.is_demo && (
                                <button type="button" onClick={() => startResetting(row)} className="btn-secondary">
                                  Reset password
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => ask(row, 'delete')}
                                disabled={row.uuid === user.uuid}
                                title={row.uuid === user.uuid ? OWN_ACCOUNT_TOOLTIP : undefined}
                                className="btn-danger"
                              >
                                Soft-delete
                              </button>
                            </div>
                          )}
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
            isSelf={editing.uuid === user.uuid}
            onSave={save}
            onCancel={() => setEditing(null)}
            busy={busy}
            error={saveError}
          />
        )}

        {pending && pending.action !== 'purge' && (
          <ConfirmDialog
            title={ACTIONS[pending.action].title(pending.row)}
            message={ACTIONS[pending.action].message}
            confirmLabel={ACTIONS[pending.action].confirmLabel}
            cancelLabel="Cancel"
            confirmClassName={ACTIONS[pending.action].confirmClassName}
            onConfirm={confirm}
            onCancel={() => setPending(null)}
            busy={busy}
            error={saveError}
          />
        )}

        {pending?.action === 'purge' && (
          <DeleteForeverModal
            title="Delete user forever?"
            warning={`This permanently removes ${pending.row.email} from the system. Only possible for a user with no IDRs, project assignments or other history. This can't be undone.`}
            phrase={pending.row.email}
            onConfirm={confirm}
            onCancel={() => setPending(null)}
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

        <Toast message={toast} onDone={() => setToast(null)} />
      </main>
    </div>
  )
}
