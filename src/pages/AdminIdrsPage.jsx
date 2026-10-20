/**
 * Every IDR on every project, at /admin/idrs. Admins only: a sortable table (work date by default, submit date,
 * status) with a Soft-delete button on each IDR and Unlock on those the backend can unlock. "Include deleted" (off
 * to start) asks the backend for the list again with deleted IDRs in it; a deleted IDR is crossed out, reads
 * Deleted, and has Un-delete and Delete forever instead. "Show all drafts" (off to start) brings in other people's
 * drafts from what was fetched. Each action is confirmed first (Delete forever by typing the IDR's number), and
 * the list is read again afterwards, so a row shows what the backend wrote. Unlock on an IDR in RE Review that no
 * RE has accepted has nothing to undo: it only says so, in a toast. Unlocking or deleting an approved IDR releases
 * the PIR flags it claimed (R1f): its dialog reads how many first (getIdrFlags) and says so, and the toast after
 * repeats the count the backend gives; an un-delete back to approved says how many it claimed back. Anyone who isn't
 * an admin is told so instead.
 * Unlocking an approved IDR (Slice T2) lists in its dialog what reopens and what stays, as the ped ramp inspection's
 * unlock does; an IDR an admin has unlocked shows "Last unlocked ... by ..." under its actions.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { useTaskCount } from '../contexts/TaskCountContext'
import { adminDeleteIdr, adminUnlockIdr, getIdrFlags, listIdrs, permanentDeleteIdr, undeleteIdr } from '../services/api'
import { ADMIN_UNLOCKABLE_STATUSES, STATUS_LABELS, isAdmin } from '../lib/reviewRoles'
import { countOf, releaseSentence } from '../lib/idrFlags'
import ConfirmDialog from '../components/ConfirmDialog'
import DeleteForeverModal from '../components/DeleteForeverModal'
import IdrTable from '../components/IdrTable'
import Toast from '../components/Toast'

const STATUS_ORDER = Object.keys(STATUS_LABELS)
const DEFAULT_SORT = { key: 'report_date', direction: 'desc' }

// "IDR 004", or for an IDR that has no number yet, "IDR of Sep 16, 2025 on HWS0023"
export function idrName(idr) {
  if (idr.idr_number) return `IDR ${idr.idr_number}`
  return `IDR of ${format(parseISO(idr.report_date), 'MMM d, yyyy')} on ${idr.project_id}`
}

// What an admin types to delete an IDR for good: its number, or its work date when it has none
export function deleteForeverPhrase(idr) {
  return idr.idr_number || idr.report_date
}

// "3 flags", "3 flags and 2 curb segments", "2 curb segments": what a move claimed or released; '' for nothing
function moved(flags = 0, segments = 0) {
  return [flags > 0 && countOf(flags, 'flag'), segments > 0 && countOf(segments, 'curb segment')].filter(Boolean).join(' and ')
}
const released = (idr) => moved(idr?.flags_released, idr?.segments_released)

// The admin actions: the call, the words of its confirm dialog, and what the toast says once it went through
// (given the IDR as it was and what the call returned)
const ACTIONS = {
  unlock: {
    run: idrId => adminUnlockIdr(idrId),
    title: () => 'Unlock IDR',
    message: 'This returns the IDR to RE Review and clears the RE signature. The RE must re-approve to lock it again.',
    // What an approved IDR's unlock reopens, and what stays
    items: idr => (idr.status === 'approved' ? [
      "The RE's approval and signature: any RE on the project can accept it again from the queue",
      'Its pay-item quantities: removed, and written afresh when it is approved again',
      'The PIR flags and curb segments it claimed: released, and claimed again at the next approval',
    ] : null),
    stays: "What stays: its IDR number, its reports, the inspector's signature and the OE's acceptance.",
    confirmLabel: 'Unlock',
    confirmClassName: 'btn-primary',
    failure: "Couldn't unlock the IDR",
    releases: true,
    done: (idr, unlocked) => (released(unlocked) ? `${idrName(idr)} unlocked; ${released(unlocked)} released.` : null),
  },
  delete: {
    run: idrId => adminDeleteIdr(idrId),
    title: () => 'Soft-delete IDR',
    message: 'This removes the IDR from every list. The record is kept, and its day and IDR number become free again.',
    confirmLabel: 'Soft-delete',
    confirmClassName: 'btn-danger',
    failure: "Couldn't delete the IDR",
    releases: true,
    done: (idr, deleted) => (released(deleted) ? `${idrName(idr)} deleted; ${released(deleted)} released.` : null),
  },
  undelete: {
    run: idrId => undeleteIdr(idrId),
    title: idr => `Un-delete ${idrName(idr)}?`,
    message: 'This brings the IDR back with the status it had when it was deleted, and into the lists again.',
    confirmLabel: 'Un-delete',
    confirmClassName: 'btn-primary',
    failure: "Couldn't un-delete the IDR",
    done: (idr, restored) => {
      const status = STATUS_LABELS[restored?.status]
      const back = moved(restored?.flags_claimed, restored?.segments_claimed)
      const claimed = back ? ` ${back} claimed back.` : ''
      return `${status ? `${idrName(idr)} restored to ${status}.` : `${idrName(idr)} restored.`}${claimed}`
    },
  },
  // Confirmed in DeleteForeverModal, not ConfirmDialog, so it has no dialog words here
  purge: {
    run: idrId => permanentDeleteIdr(idrId),
    failure: "Couldn't delete the IDR",
    done: idr => `${idrName(idr)} permanently deleted.`,
  },
}

export const ALREADY_UNLOCKED = 'Already unlocked — IDR is in RE Review'

const isDeleted = (idr) => idr.status === 'deleted' || Boolean(idr.deleted_at)

// In RE Review with no RE on it: an unlock would change nothing. Once an RE has accepted it, an unlock takes it
// off them, so that one still goes through.
const isAlreadyUnlocked = (idr) => idr.status === 'stage2_review' && !idr.re_reviewer_uuid

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

  const [idrs, setIdrs] = useState([]) // every IDR, everyone's drafts included; deleted ones only when asked for
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false) // whether there is a list to keep on screen while it is read again
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [showAllDrafts, setShowAllDrafts] = useState(false)
  const [sort, setSort] = useState(DEFAULT_SORT)

  const [pending, setPending] = useState(null) // {idr, action}: the action waiting to be confirmed
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [refreshError, setRefreshError] = useState(null) // an action worked but the list couldn't be read again
  const [toast, setToast] = useState(null)
  // How many flags the pending unlock or delete would release: {loading, count, error}, or null when it releases none
  const [release, setRelease] = useState(null)

  // Only an approved IDR has claimed flags; read how many before its unlock or delete is confirmed
  useEffect(() => {
    if (!pending || !ACTIONS[pending.action].releases || pending.idr.status !== 'approved') {
      setRelease(null)
      return
    }
    let ignore = false
    setRelease({ loading: true, count: null, error: null })
    getIdrFlags(pending.idr.idr_id)
      .then(data => { if (!ignore) setRelease({ loading: false, count: data.counts.attributed, error: null }) })
      .catch(err => { if (!ignore) setRelease({ loading: false, count: null, error: err.message }) })
    return () => { ignore = true }
  }, [pending])

  useEffect(() => {
    if (!admin) return
    let ignore = false
    setLoading(true)
    setLoadError(null)
    setRefreshError(null)
    listIdrs({ includeDeleted, includeAllDrafts: true })
      .then(data => {
        if (ignore) return
        setIdrs(data)
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

  const ask = (idr, action) => {
    if (action === 'unlock' && isAlreadyUnlocked(idr)) {
      setToast(ALREADY_UNLOCKED)
      return
    }
    setToast(null)
    setActionError(null)
    setPending({ idr, action })
  }

  // Runs the confirmed action, then reads the list again rather than guessing what the backend wrote
  const confirm = async () => {
    const { idr, action } = pending
    setBusy(true)
    setActionError(null)
    let result
    try {
      result = await ACTIONS[action].run(idr.idr_id)
    } catch (err) {
      setActionError(`${ACTIONS[action].failure}: ${err.message}`)
      setBusy(false)
      return
    }
    try {
      setIdrs(await listIdrs({ includeDeleted, includeAllDrafts: true }))
      setRefreshError(null)
    } catch (err) {
      setRefreshError(`The change was saved, but the list couldn't be refreshed: ${err.message}`)
    }
    refreshTaskCount() // an unlocked or restored IDR can be a task for its project's reviewers again
    setToast(ACTIONS[action].done?.(idr, result) ?? null)
    setPending(null)
    setBusy(false)
  }

  // The pending action's dialog words, with what it releases
  const releaseText = !release ? '' : release.loading
    ? ' Counting the flags it claimed...'
    : release.error ? ` Couldn't count the flags it claimed: ${release.error}` : ` ${releaseSentence(release.count)}`

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

  // A deleted IDR is in the list only because it was asked for, so it always shows
  const visible = sorted(
    idrs.filter(idr => isDeleted(idr) || showAllDrafts || idr.status !== 'draft' || idr.reporter_uuid === user.uuid),
    sort,
  )

  const renderActions = (idr) => (
    <div className="flex items-center space-x-2">
      {isDeleted(idr) ? (
        <>
          <button type="button" onClick={() => ask(idr, 'undelete')} disabled={busy} className="btn-secondary">
            Un-delete
          </button>
          <button type="button" onClick={() => ask(idr, 'purge')} disabled={busy} className="btn-danger">
            Delete forever
          </button>
        </>
      ) : (
        <>
          {ADMIN_UNLOCKABLE_STATUSES.includes(idr.status) && (
            <button type="button" onClick={() => ask(idr, 'unlock')} disabled={busy} className="btn-secondary">
              Unlock
            </button>
          )}
          <button type="button" onClick={() => ask(idr, 'delete')} disabled={busy} className="btn-danger">
            Soft-delete
          </button>
        </>
      )}
      {idr.last_unlocked_at && (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          Last unlocked {format(parseISO(idr.last_unlocked_at), 'MMM d, yyyy')}{idr.last_unlocked_by_name ? ` by ${idr.last_unlocked_by_name}` : ''}
        </span>
      )}
    </div>
  )

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {back}

        <h2 className="text-2xl font-bold text-gray-900 mb-6">All IDRs (Admin)</h2>

        {loading && !loaded ? (
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
                <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
                <span>Include deleted</span>
              </label>
              <label className="inline-flex items-center space-x-2">
                <input type="checkbox" checked={showAllDrafts} onChange={(e) => setShowAllDrafts(e.target.checked)} />
                <span>Show all drafts</span>
              </label>
              {loading && <span role="status" className="text-gray-500">Loading...</span>}
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

        {pending && pending.action !== 'purge' && (
          <ConfirmDialog
            title={ACTIONS[pending.action].title(pending.idr)}
            message={`${ACTIONS[pending.action].message}${releaseText}`}
            items={ACTIONS[pending.action].items?.(pending.idr) ?? null}
            note={[ACTIONS[pending.action].items?.(pending.idr) && ACTIONS[pending.action].stays, `IDR: ${describeIdr(pending.idr)}`]
              .filter(Boolean).join(' ')}
            confirmLabel={ACTIONS[pending.action].confirmLabel}
            cancelLabel="Cancel"
            confirmClassName={ACTIONS[pending.action].confirmClassName}
            onConfirm={confirm}
            onCancel={() => setPending(null)}
            busy={busy}
            error={actionError}
          />
        )}

        {pending?.action === 'purge' && (
          <DeleteForeverModal
            title="Delete IDR forever?"
            warning={`This will permanently remove ${idrName(pending.idr)} and all its data: pay-item quantities, reviewer redlines, attachments. This can't be undone.`}
            phrase={deleteForeverPhrase(pending.idr)}
            note={`IDR: ${describeIdr(pending.idr)}`}
            onConfirm={confirm}
            onCancel={() => setPending(null)}
            busy={busy}
            error={actionError}
          />
        )}

        <Toast message={toast} onDone={() => setToast(null)} />
      </main>
    </div>
  )
}
