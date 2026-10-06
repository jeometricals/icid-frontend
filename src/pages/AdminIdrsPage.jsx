/**
 * Every IDR on every project, at /admin/idrs. Admins only: a sortable table (work date by default, submit date,
 * status) with a Soft-delete button on each IDR and Unlock on those the backend can unlock; a deleted IDR shows a
 * Deleted badge instead. "Show deleted" and "Show all drafts" (both off to start) bring in deleted IDRs and other
 * people's drafts. Each action is confirmed first, and the list is read again afterwards, so a row shows what the
 * backend wrote. Anyone who isn't an admin is told so instead.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { useTaskCount } from '../contexts/TaskCountContext'
import { adminDeleteIdr, adminUnlockIdr, listIdrs } from '../services/api'
import { ADMIN_UNLOCKABLE_STATUSES, STATUS_LABELS, isAdmin } from '../lib/reviewRoles'
import ConfirmDialog from '../components/ConfirmDialog'
import IdrTable from '../components/IdrTable'
import StatusBadge from '../components/StatusBadge'

const STATUS_ORDER = Object.keys(STATUS_LABELS)
const DEFAULT_SORT = { key: 'report_date', direction: 'desc' }

// The two admin actions: the call, and the words of its confirm dialog
const ACTIONS = {
  unlock: {
    run: idrId => adminUnlockIdr(idrId),
    title: 'Unlock IDR',
    message: 'This returns the IDR to RE Review and clears the RE signature. The RE must re-approve to lock it again.',
    confirmLabel: 'Unlock',
    confirmClassName: 'btn-primary',
    failure: "Couldn't unlock the IDR",
  },
  delete: {
    run: idrId => adminDeleteIdr(idrId),
    title: 'Soft-delete IDR',
    message: 'This removes the IDR from every list. The record is kept, and its day and IDR number become free again.',
    confirmLabel: 'Soft-delete',
    confirmClassName: 'btn-danger',
    failure: "Couldn't delete the IDR",
  },
}

const isDeleted = (idr) => idr.status === 'deleted' || Boolean(idr.deleted_at)

// "Sep 16, 2025 on HWS0023 (Genghis Khan)": which IDR a confirm dialog is about
function describeIdr(idr) {
  const date = format(parseISO(idr.report_date), 'MMM d, yyyy')
  return `${date} on ${idr.project_id} (${idr.reporter_name || 'Unknown inspector'})`
}

function sortValue(idr, key) {
  if (key === 'status') return String(STATUS_ORDER.indexOf(idr.status)).padStart(2, '0')
  return idr[key] || ''
}

// Orders by the chosen column; IDRs that tie there go newest work date first
function sorted(idrs, { key, direction }) {
  const flip = direction === 'asc' ? 1 : -1
  return [...idrs].sort((a, b) =>
    flip * sortValue(a, key).localeCompare(sortValue(b, key)) || b.report_date.localeCompare(a.report_date))
}

export default function AdminIdrsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refresh: refreshTaskCount } = useTaskCount()
  const admin = isAdmin(user)

  const [idrs, setIdrs] = useState([]) // every IDR, deleted ones and everyone's drafts included
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  const [showDeleted, setShowDeleted] = useState(false)
  const [showAllDrafts, setShowAllDrafts] = useState(false)
  const [sort, setSort] = useState(DEFAULT_SORT)

  const [pending, setPending] = useState(null) // {idr, action}: the action waiting to be confirmed
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [refreshError, setRefreshError] = useState(null) // an action worked but the list couldn't be read again

  useEffect(() => {
    if (!admin) return
    let ignore = false
    setLoading(true)
    setLoadError(null)
    setRefreshError(null)
    listIdrs({ includeDeleted: true, includeAllDrafts: true })
      .then(data => { if (!ignore) setIdrs(data) })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [admin, attempt])

  const ask = (idr, action) => {
    setActionError(null)
    setPending({ idr, action })
  }

  // Runs the confirmed action, then reads the list again rather than guessing what the backend wrote
  const confirm = async () => {
    const { idr, action } = pending
    setBusy(true)
    setActionError(null)
    try {
      await ACTIONS[action].run(idr.idr_id)
    } catch (err) {
      setActionError(`${ACTIONS[action].failure}: ${err.message}`)
      setBusy(false)
      return
    }
    try {
      setIdrs(await listIdrs({ includeDeleted: true, includeAllDrafts: true }))
      setRefreshError(null)
    } catch (err) {
      setRefreshError(`The change was saved, but the list couldn't be refreshed: ${err.message}`)
    }
    refreshTaskCount() // an unlocked IDR is a task for its project's REs again
    setPending(null)
    setBusy(false)
  }

  const changeSort = (key) => {
    setSort(current => (current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'status' ? 'asc' : 'desc' }))
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
            Only an admin can see every IDR.
          </div>
        </main>
      </div>
    )
  }

  const visible = sorted(
    idrs.filter(idr => (isDeleted(idr)
      ? showDeleted
      : showAllDrafts || idr.status !== 'draft' || idr.reporter_uuid === user.uuid)),
    sort,
  )

  const renderActions = (idr) => (isDeleted(idr) ? (
    <StatusBadge status="deleted" />
  ) : (
    <div className="flex items-center space-x-2">
      {ADMIN_UNLOCKABLE_STATUSES.includes(idr.status) && (
        <button type="button" onClick={() => ask(idr, 'unlock')} disabled={busy} className="btn-secondary">
          Unlock
        </button>
      )}
      <button type="button" onClick={() => ask(idr, 'delete')} disabled={busy} className="btn-danger">
        Soft-delete
      </button>
    </div>
  ))

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {back}

        <h2 className="text-2xl font-bold text-gray-900 mb-6">All IDRs (Admin)</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load the IDRs: {loadError}</p>
            <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-sm text-gray-700">
              <label className="inline-flex items-center space-x-2">
                <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
                <span>Show deleted</span>
              </label>
              <label className="inline-flex items-center space-x-2">
                <input type="checkbox" checked={showAllDrafts} onChange={(e) => setShowAllDrafts(e.target.checked)} />
                <span>Show all drafts</span>
              </label>
            </div>

            {refreshError && (
              <p role="alert" className="text-sm text-red-600 mb-4">
                {refreshError}{' '}
                <button type="button" onClick={() => setAttempt(a => a + 1)} className="underline font-medium">Retry</button>
              </p>
            )}

            {visible.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
                No IDRs to show.
              </div>
            ) : (
              <IdrTable
                idrs={visible}
                showProject
                sort={sort}
                onSort={changeSort}
                renderActions={renderActions}
                blankNumber="—"
              />
            )}
          </>
        )}

        {pending && (
          <ConfirmDialog
            title={ACTIONS[pending.action].title}
            message={ACTIONS[pending.action].message}
            note={`IDR: ${describeIdr(pending.idr)}`}
            confirmLabel={ACTIONS[pending.action].confirmLabel}
            cancelLabel="Cancel"
            confirmClassName={ACTIONS[pending.action].confirmClassName}
            onConfirm={confirm}
            onCancel={() => setPending(null)}
            busy={busy}
            error={actionError}
          />
        )}
      </main>
    </div>
  )
}
