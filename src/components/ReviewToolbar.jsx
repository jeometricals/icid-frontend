import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { acceptStage1, acceptStage2, approveStage1, approveStage2, returnIdr } from '../services/api'
import { reviewActionsFor } from '../lib/reviewRoles'
import AcceptStage1Modal from './AcceptStage1Modal'
import ConfirmDialog from './ConfirmDialog'
import ReturnCommentModal from './ReturnCommentModal'
import SignatureSetupModal from './SignatureSetupModal'

const LABELS = {
  'accept-stage1': 'Accept for Stage 1',
  'approve-stage1': 'Approve → Stage 2',
  'accept-stage2': 'Accept for Stage 2',
  'approve-stage2': 'Approve + Sign (final)',
  'return-oe': 'Return to OE',
  'return-inspector': 'Return to Inspector',
}
// The actions that move an IDR forward are the primary buttons; returns are secondary
const PRIMARY = ['accept-stage1', 'approve-stage1', 'accept-stage2', 'approve-stage2']
const RETURNS = {
  'return-inspector': { to: 'inspector', title: 'Return to Inspector', recipient: 'the inspector' },
  'return-oe': { to: 'oe', title: 'Return to OE', recipient: 'the OE' },
}
const APPROVE_STAGE1_MESSAGE = 'Send this IDR on to the Resident Engineer for final approval?'
const APPROVE_STAGE2_MESSAGE = 'Approve this IDR? Your signature will be stamped on every page of its export.'

/**
 * The review actions on an IDR's page: the buttons the signed-in user may use at the IDR's current status, given
 * the roles they hold on its project (Accept for Stage 1, Approve → Stage 2, Accept for Stage 2, Approve + Sign,
 * Return to OE, Return to Inspector). It runs each action itself and then calls onChanged, whether it worked or
 * not, so the page shows where the IDR now stands. Renders nothing for someone with nothing to do here.
 * Props: idr, roles (the user's roles on the IDR's project), onChanged (async; refetches the IDR), disabled (the
 * page is busy with something else).
 */
export default function ReviewToolbar({ idr, roles, onChanged, disabled = false }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(null) // the action whose dialog is open, or 'signature'
  const [error, setError] = useState(null) // { message, conflictIdrId }
  const { actions, note } = reviewActionsFor(idr, user, roles)

  if (actions.length === 0 && !note) return null

  // Runs one action; its dialog (if any) stays open on failure, showing the error
  const run = async (request) => {
    setBusy(true)
    setError(null)
    let failed = false
    try {
      await request()
    } catch (err) {
      failed = true
      setError({ message: err.message, conflictIdrId: err.status === 409 ? err.body?.existing_idr_id ?? null : null })
    }
    await onChanged()
    setBusy(false)
    if (!failed) setDialog(null)
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
            </button>
          ))}
        </div>
      </div>
      {note && <p className="text-sm text-gray-600 mt-2">{note}</p>}
      {error && !dialog && <p role="alert" className="text-sm text-red-600 mt-2">{error.message}</p>}

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
          title="Approve for Stage 2"
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
          title="Final approval"
          message={APPROVE_STAGE2_MESSAGE}
          confirmLabel="Approve + Sign"
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
