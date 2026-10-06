import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTaskCount } from '../contexts/TaskCountContext'
import { acceptStage1, acceptStage2, approveStage1, approveStage2, returnIdr } from '../services/api'
import { reviewStage, stageAcceptedTimes, untouchedPayItems } from '../lib/fieldEdits'
import { reviewActionsFor } from '../lib/reviewRoles'
import AcceptStage1Modal from './AcceptStage1Modal'
import ConfirmDialog from './ConfirmDialog'
import ReturnCommentModal from './ReturnCommentModal'
import SignatureSetupModal from './SignatureSetupModal'
import Toast from './Toast'

const LABELS = {
  'accept-stage1': 'Accept Task - IDR Check',
  'approve-stage1': 'Approve → RE Review',
  'accept-stage2': 'Accept for RE Review',
  'approve-stage2': 'Final Approve & Sign',
  'return-oe': 'Return to OE',
  'return-inspector': 'Return to Inspector',
}
// The actions that move an IDR forward are the primary buttons; returns are secondary
const PRIMARY = ['accept-stage1', 'approve-stage1', 'accept-stage2', 'approve-stage2']
// The actions the backend only allows once the reviewer has attested to every pay item
const GATED = ['approve-stage1', 'approve-stage2']
const RETURNS = {
  'return-inspector': { to: 'inspector', title: 'Return to Inspector', recipient: 'the inspector' },
  'return-oe': { to: 'oe', title: 'Return to OE', recipient: 'the OE' },
}
const APPROVE_STAGE1_MESSAGE = 'Send this IDR on to the Resident Engineer for final approval?'
const APPROVE_STAGE2_MESSAGE = 'Approve this IDR? Your signature will be stamped on every page of its export.'

/**
 * The review actions on an IDR's page: the buttons the signed-in user may use at the IDR's current status, given
 * the roles they hold on its project (Accept Task - IDR Check, Approve → RE Review, Accept for RE Review, Final
 * Approve & Sign, Return to OE, Return to Inspector). It runs each action itself, then calls onChanged and refreshes
 * the task count, whether it worked or not, so the page and the header badge show where things now stand. Renders
 * nothing for someone with nothing to do here.
 * The two approve buttons carry "N un-approved items" while the reviewer still has pay items to approve or revise
 * in this round of the stage (since the IDR's stage1_accepted_at / stage2_accepted_at). They stay enabled: the
 * backend is the gate. When it refuses (400 with untouched), the toolbar shows its reason as a toast and calls
 * onPayItemsUntouched.
 * Props: idr, roles (the user's roles on the IDR's project), reports and fieldEdits (the IDR's, for the count),
 * onChanged (async; refetches the IDR), onPayItemsUntouched({detail, untouched}) (optional), disabled (the page is
 * busy with something else).
 */
export default function ReviewToolbar({
  idr, roles, reports = [], fieldEdits = [], onChanged, onPayItemsUntouched, disabled = false,
}) {
  const { user } = useAuth()
  const { refresh: refreshTaskCount } = useTaskCount()
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(null) // the action whose dialog is open, or 'signature'
  const [error, setError] = useState(null) // { message, conflictIdrId }
  const [toast, setToast] = useState(null)
  const { actions, note } = reviewActionsFor(idr, user, roles)

  if (actions.length === 0 && !note) return null

  // How many pay items the reviewer has yet to approve or revise in this round, for the approve button's badge
  const waiting = actions.some(action => GATED.includes(action))
    ? untouchedPayItems(reports, fieldEdits, {
      userUuid: user?.uuid, stage: reviewStage(idr.status), acceptedAt: stageAcceptedTimes(idr),
    }).length
    : 0

  // Runs one action; its dialog (if any) stays open on failure, showing the error
  const run = async (request) => {
    setBusy(true)
    setError(null)
    let failed = false
    let gate = null // the backend's refusal for pay items still waiting on the reviewer
    try {
      await request()
    } catch (err) {
      failed = true
      if (err.status === 400 && Array.isArray(err.body?.untouched) && err.body.untouched.length > 0) {
        gate = { detail: err.message, untouched: err.body.untouched }
      } else {
        setError({ message: err.message, conflictIdrId: err.status === 409 ? err.body?.existing_idr_id ?? null : null })
      }
    }
    await Promise.all([onChanged(), refreshTaskCount()])
    setBusy(false)
    if (!failed) setDialog(null)
    if (gate) {
      setDialog(null)
      setToast(gate.detail)
      onPayItemsUntouched?.(gate)
    }
  }

  const closeDialog = () => {
    setDialog(null)
    setError(null)
  }

  const start = (action) => {
    setError(null)
    if (action === 'accept-stage1' && idr.idr_number) {
      run(() => acceptStage1(idr.idr_id)) // a resubmitted IDR keeps its number
    } else if (action === 'accept-stage2') {
      run(() => acceptStage2(idr.idr_id))
    } else if (action === 'approve-stage2' && !user?.has_signature) {
      setDialog('signature') // approving signs, so the signature comes first
    } else {
      setDialog(action)
    }
  }

  const locked = busy || disabled
  const returning = RETURNS[dialog]

  return (
    <section aria-label="Review" className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Review</h2>
        <div className="flex flex-wrap items-center gap-3">
          {actions.map(action => (
            <button
              key={action}
              type="button"
              onClick={() => start(action)}
              disabled={locked}
              className={PRIMARY.includes(action) ? 'btn-primary' : 'btn-secondary'}
            >
              {LABELS[action]}
              {GATED.includes(action) && waiting > 0 && (
                <span className="ml-2 inline-block rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">
                  {waiting} un-approved {waiting === 1 ? 'item' : 'items'}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {note && <p className="text-sm text-gray-600 mt-2">{note}</p>}
      {error && !dialog && <p role="alert" className="text-sm text-red-600 mt-2">{error.message}</p>}
      <Toast message={toast} onDone={() => setToast(null)} duration={8000} />

      {dialog === 'accept-stage1' && (
        <AcceptStage1Modal
          projectId={idr.project_id}
          onConfirm={number => run(() => acceptStage1(idr.idr_id, number))}
          onCancel={closeDialog}
          busy={busy}
          error={error?.message}
          conflictIdrId={error?.conflictIdrId}
        />
      )}
      {dialog === 'approve-stage1' && (
        <ConfirmDialog
          title="Approve for RE Review"
          message={APPROVE_STAGE1_MESSAGE}
          confirmLabel="Approve"
          cancelLabel="Cancel"
          confirmClassName="btn-primary"
          onConfirm={() => run(() => approveStage1(idr.idr_id))}
          onCancel={closeDialog}
          busy={busy}
          error={error?.message}
        />
      )}
      <SignatureSetupModal
        isOpen={dialog === 'signature'}
        onClose={() => setDialog(current => (current === 'signature' ? null : current))}
        onSuccess={() => setDialog('approve-stage2')}
      />
      {dialog === 'approve-stage2' && (
        <ConfirmDialog
          title="Final Approve & Sign"
          message={APPROVE_STAGE2_MESSAGE}
          confirmLabel="Approve & Sign"
          cancelLabel="Cancel"
          confirmClassName="btn-primary"
          onConfirm={() => run(() => approveStage2(idr.idr_id))}
          onCancel={closeDialog}
          busy={busy}
          error={error?.message}
        />
      )}
      {returning && (
        <ReturnCommentModal
          title={returning.title}
          recipient={returning.recipient}
          onConfirm={comment => run(() => returnIdr(idr.idr_id, { to: returning.to, comment }))}
          onCancel={closeDialog}
          busy={busy}
          error={error?.message}
        />
      )}
    </section>
  )
}
