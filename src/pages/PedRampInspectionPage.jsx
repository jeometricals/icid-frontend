/**
 * A ped ramp corner's As-Built Inspection Form (Pedramp Phase 3, S1), at
 * /project/:projectId/ped-ramp-corners/:cornerId/inspection, reached from "As-Built Inspection Form" on a corner's
 * heading row, on each of its ramp rows (with #ramp-<property id>, which scrolls to that ramp's card) and on a ped
 * ramp's site page. One scrolling page: the DOT form's sections 1-4 (the corner, read here and changed through the
 * Pedramp dialog's "Edit corner"), "Are all ADA requirements met?", and section 5 as a card per ramp
 * (RampAttributesSection, each saving its own).
 * The inspection's status heads the page (Not started / Draft / Returned / Submitted / Approved) with who signed it,
 * and the actions the signed-in user's roles on the project allow (an admin stands in for either): Start inspection
 * (an inspector or an RE), Submit (an inspector, on a draft; signs with their signature), Return (an RE, on a
 * submitted one; a comment is required) and Approve (an RE; signs). A returned draft shows the RE's comment. Who may
 * change the fields follows the backend's lock: a draft, anyone on the project who isn't a demo user; submitted,
 * only an RE ("Inspection is submitted — only the RE can edit"); approved, nobody ("Inspection is approved — no
 * further edits"); the message reads above the form. Every refusal reads as the backend words it.
 * TIFs (S3): once "Are all ADA requirements met?" is No, each ramp card shows its TIF (a link to its page, Draft or
 * Approved) or, for a ramp whose attributes raise ADA warnings, "Draft TIF" (an inspector or an RE, while the lock
 * allows), which drafts one and opens it. Approving waits for every TIF to be approved.
 * Photos (S4): each ramp card has its photos (PedRampPhotosSection: number, caption, upload, under the same lock);
 * submitting a form with none warns (NO_PHOTOS_WARNING) but doesn't stop it for the pilot.
 * An admin can unlock an approved inspection ("Admin: Unlock inspection", confirmed with what reopens and what stays):
 * it goes back to draft, its approved TIFs too, to be corrected and approved again; "Last unlocked by ... on ..." then
 * reads in the status line.
 * Downloads: "Preview (ICID)" (the ICID inspection report, for everyone) and, once approved, "Download DOT form"
 * (DOT's fillable forms as filed at approval, a ZIP when there are several), with a note on why there can be several
 * and on the TIFs' signature images.
 */
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { AlertTriangle, ArrowLeft, Pencil } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useProjectRoles } from '../contexts/ProjectRolesContext'
import {
  approveInspection, downloadInspectionDotForms, downloadInspectionReport, draftTif, getCorner, getCornerInspection,
  getInspectionReport, listInspectionTifs, returnInspection, startInspection, submitInspection, unlockInspection,
  updateCorner, updateInspection,
} from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
import { BOROUGHS, facingStreetName, rampTypeLabel } from '../data/propertyKinds'
import { SITE_CORNER_SECTIONS } from '../data/pedRampForm'
import ConfirmDialog from '../components/ConfirmDialog'
import DownloadFileButton from '../components/DownloadFileButton'
import PedrampSiteModal from '../components/PedrampSiteModal'
import PedRampPhotosSection, { NO_PHOTOS_WARNING } from '../components/PedRampPhotosSection'
import RampAttributesSection from '../components/RampAttributesSection'
import ReturnCommentModal from '../components/ReturnCommentModal'
import StatusBadge from '../components/StatusBadge'
import Toast from '../components/Toast'

export const APPROVED_LOCK = 'Inspection is approved — no further edits'
export const SUBMITTED_LOCK = 'Inspection is submitted — only the RE can edit'
export const NOT_STARTED = 'Not started'
// Why Acrobat may ask to save a DOT form nobody edited: the forms are left fillable, so it redraws their fields
export const ACROBAT_SAVE_NOTE = 'If Acrobat asks to save changes when you close the form, choose No: nothing was edited, it only redrew the fillable fields.'
export const DOT_FORM_NOTE = `DOT's fillable form, with the approved TIFs. A corner with more ramps than one DOT form holds comes as several forms in a ZIP. TIF signatures are ICID signature images: re-sign in Acrobat if DOT requires a cryptographic signature. ${ACROBAT_SAVE_NOTE}`
export const TIF_LIST_ERROR = "Couldn't load this inspection's TIFs"

/** How a corner field reads on the form: a choice's words, Yes / No, the value, or a dash. */
function shownValue(type, extra, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (type === 'select') return extra.find(option => option.value === value)?.label ?? value
  if (type === 'yesno') return value ? 'Yes' : 'No'
  if (type === 'boro') return BOROUGHS.includes(value) ? value : String(value)
  return String(value)
}

const when = (iso) => format(parseISO(iso), 'MMM d, yyyy')

// The confirmed moves: what each asks and does
const MOVES = {
  submit: {
    title: 'Submit inspection?',
    message: 'It goes to the RE for review, signed with your signature. Until it is returned, only the RE can change it.',
    confirmLabel: 'Submit',
    run: inspection => submitInspection(inspection.id),
    done: 'Inspection submitted.',
  },
  approve: {
    title: 'Approve inspection?',
    message: "It is signed with your signature and frozen: nobody can change it afterwards. DOT's forms are filed with it, the approved TIFs included.",
    confirmLabel: 'Approve',
    run: inspection => approveInspection(inspection.id),
    done: 'Inspection approved.',
  },
  unlock: {
    title: 'Unlock this approved inspection?',
    message: 'It goes back to draft so it can be corrected and approved again (when DOT sends it back). This reopens:',
    items: [
      "The RE's approval and signature, and the submit: it must be submitted and approved again",
      'The answer to "Are all ADA requirements met?"',
      'Every approved TIF of it: back to draft, its signing cleared',
      "The link to the DOT forms filed at approval",
    ],
    note: "What stays: the corner, the measurements, the photos and the inspector's signature. The DOT forms already filed stay in Storage for the record; the next approval files new ones.",
    confirmLabel: 'Unlock',
    className: 'btn-danger',
    run: inspection => unlockInspection(inspection.id),
    done: 'Inspection unlocked: back to draft.',
  },
}

export default function PedRampInspectionPage() {
  const { projectId, cornerId } = useParams()
  const navigate = useNavigate()
  const { hash } = useLocation()
  const { user } = useAuth()
  const { rolesByProject } = useProjectRoles()
  const admin = isAdmin(user)
  const roles = rolesByProject?.[projectId] ?? []
  const writer = !user?.is_demo
  const inspector = writer && (admin || roles.includes('inspector'))
  const re = writer && (admin || roles.includes('re'))

  const [corner, setCorner] = useState(null)
  const [inspection, setInspection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [dialog, setDialog] = useState(null) // 'submit' | 'approve' | 'return' | 'corner'
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null) // the open dialog's (or the page's) failed action
  const [toast, setToast] = useState(null)
  const [tifs, setTifs] = useState([]) // the inspection's TIFs
  const [tifError, setTifError] = useState(null)
  const [warned, setWarned] = useState(() => new Set()) // the ramps whose attributes raise ADA warnings
  const [formPhotos, setFormPhotos] = useState(null) // every photo on the form, once its photo sections have read them

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setLoadError(null)
    Promise.all([getCorner(cornerId), getCornerInspection(cornerId)])
      .then(([foundCorner, foundInspection]) => {
        if (ignore) return
        setCorner(foundCorner)
        setInspection(foundInspection)
      })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [cornerId, attempt])

  // The inspection's TIFs, read again when it moves
  const inspectionId = inspection?.id
  const status = inspection?.status ?? null
  useEffect(() => {
    if (!inspectionId) {
      setTifs([])
      return undefined
    }
    let ignore = false
    setTifError(null)
    listInspectionTifs(inspectionId)
      .then(found => { if (!ignore) setTifs(found) })
      .catch(err => { if (!ignore) setTifError(`${TIF_LIST_ERROR}: ${err.message}`) })
    return () => { ignore = true }
  }, [inspectionId, status])

  // Which ramps need a TIF: those whose attributes raise ADA warnings, read once the requirements are answered No
  const requirementsFailed = inspection?.requirements_met === false
  useEffect(() => {
    if (!requirementsFailed) return undefined
    let ignore = false
    getInspectionReport(cornerId)
      .then(report => {
        if (ignore) return
        setWarned(new Set(report.ramps.filter(ramp => ramp.attributes?.warnings?.length).map(ramp => ramp.property_id)))
      })
      .catch(err => { if (!ignore) setTifError(`Couldn't read the ramps' ADA warnings: ${err.message}`) })
    return () => { ignore = true }
  }, [cornerId, requirementsFailed])

  // A ramp row's link lands on its card once the form is there
  useEffect(() => {
    if (!loading && corner && hash) document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' })
  }, [loading, corner, hash])

  const lock = status === 'approved' ? APPROVED_LOCK : status === 'submitted' && !re ? SUBMITTED_LOCK : null
  const canEdit = writer && !lock
  const canAnswer = status === 'draft' ? inspector || re : status === 'submitted' && re
  const canDraftTif = (inspector || re) && !lock && Boolean(inspection) && status !== 'approved'

  // Runs an action; a refusal stays in the open dialog (or above the form), else the dialog closes
  const run = async (action, done) => {
    setBusy(true)
    setActionError(null)
    try {
      await action()
      setDialog(null)
      if (done) setToast(done)
    } catch (err) {
      setActionError(err)
    } finally {
      setBusy(false)
    }
  }
  const open = (name) => {
    setActionError(null)
    setDialog(name)
  }

  const start = () => run(async () => setInspection(await startInspection(cornerId)), 'Inspection started.')
  const answer = (value) => run(async () => setInspection(await updateInspection(inspection.id, value)))
  const move = () => run(async () => setInspection(await MOVES[dialog].run(inspection)), MOVES[dialog].done)
  const sendBack = (comment) => run(async () => setInspection(await returnInspection(inspection.id, comment)),
    'Inspection returned to the inspector.')
  const startTif = (propertyId) => run(async () => {
    const tif = await draftTif(inspection.id, propertyId)
    navigate(`/project/${projectId}/ped-ramp-tifs/${tif.id}`)
  })
  const saveCorner = ({ corner: changes }) => run(async () => setCorner(await updateCorner(cornerId, changes)),
    'Corner saved.')

  const back = (
    <button
      onClick={() => navigate(`/project/${projectId}/properties`)}
      className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="font-medium">Back to Site Info</span>
    </button>
  )

  if (loading) {
    return (
      <div className="flex-1 bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {back}
          <div className="flex justify-center py-12">
            <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
          </div>
        </main>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex-1 bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {back}
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-red-600 mb-4">Couldn't load the inspection: {loadError}</p>
            <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
          </div>
        </main>
      </div>
    )
  }

  const name = `${corner.north_south_street} & ${corner.east_west_street}${corner.corner_direction ? ` — ${corner.corner_direction}` : ''}`
  const pageError = !dialog && actionError

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {back}

        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">As-Built Inspection Form — {name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              {inspection
                ? <StatusBadge status={status} returned={Boolean(inspection.return_comment)} />
                : <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{NOT_STARTED}</span>}
              {inspection?.submitted_at && (
                <span>Submitted by {inspection.inspector_name ?? 'the inspector'} on {when(inspection.submitted_at)}</span>
              )}
              {status === 'approved' && inspection.re_signed_at && (
                <span>Approved by {inspection.re_name ?? 'the RE'} on {when(inspection.re_signed_at)}</span>
              )}
              {inspection?.last_unlocked_at && (
                <span>Last unlocked by {inspection.last_unlocked_by_name ?? 'an admin'} on {when(inspection.last_unlocked_at)}</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <DownloadFileButton label="Preview (ICID)" download={() => downloadInspectionReport(cornerId)} />
            {status === 'approved' && inspection.has_dot_pdf && (
              <DownloadFileButton label="Download DOT form" download={() => downloadInspectionDotForms(inspection.id)} />
            )}
            {!inspection && (inspector || re) && (
              <button type="button" onClick={start} disabled={busy} className="btn-primary">Start inspection</button>
            )}
            {status === 'draft' && inspector && (
              <button type="button" onClick={() => open('submit')} className="btn-primary">Submit</button>
            )}
            {status === 'approved' && admin && writer && (
              <button type="button" onClick={() => open('unlock')} className="btn-secondary text-red-600 hover:text-red-700">
                Admin: Unlock inspection
              </button>
            )}
            {status === 'submitted' && re && (
              <>
                <button type="button" onClick={() => open('return')} className="btn-secondary">Return</button>
                <button type="button" onClick={() => open('approve')} className="btn-primary">Approve</button>
              </>
            )}
          </div>
        </div>

        {status === 'draft' && inspection.return_comment && (
          <div role="note" className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-medium">
              Returned by {inspection.returned_by_name ?? 'the RE'}
              {inspection.returned_at ? ` on ${when(inspection.returned_at)}` : ''}
            </p>
            <p className="mt-1 whitespace-pre-line">{inspection.return_comment}</p>
          </div>
        )}
        {lock && (
          <p role="note" className="mb-4 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700">
            {lock}
          </p>
        )}
        {status === 'approved' && inspection.has_dot_pdf && (
          <p className="mb-4 text-sm text-gray-600">{DOT_FORM_NOTE}</p>
        )}
        {pageError && <p role="alert" className="mb-4 text-sm text-red-600">{pageError.message}</p>}
        {tifError && <p role="alert" className="mb-4 text-sm text-red-600">{tifError}</p>}

        <section aria-label="Corner" className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Sections 1-4 — the corner</h3>
            {canEdit && (
              <button type="button" onClick={() => open('corner')} className="btn-secondary inline-flex items-center space-x-2">
                <Pencil className="h-4 w-4" />
                <span>Edit corner</span>
              </button>
            )}
          </div>
          {SITE_CORNER_SECTIONS.map(section => (
            <div key={section.id} className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">{section.title}</h4>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                {section.fields.map(([key, label, type, extra]) => (
                  <div key={key}>
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="text-gray-900">{shownValue(type, extra, corner[key])}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <p className="text-sm text-gray-600">
            Ramp types at this corner: {[...new Set(corner.ramps.map(ramp => rampTypeLabel(ramp.ramp_type)))].join(', ') || '—'}
          </p>
        </section>

        {inspection && (
          <section aria-label="ADA requirements" className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <fieldset disabled={!canAnswer || busy}>
              <legend className="text-sm font-semibold text-gray-900">Are all ADA requirements met?</legend>
              <div className="mt-2 flex gap-6 text-sm">
                {[[true, 'Yes'], [false, 'No']].map(([value, label]) => (
                  <label key={label} className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="requirements-met"
                      checked={inspection.requirements_met === value}
                      onChange={() => answer(value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {inspection.requirements_met === false && (
              <p className="mt-3 flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>A ramp that doesn't meet the ADA standards needs a Technical Infeasibility Form (TIF).</span>
              </p>
            )}
          </section>
        )}

        <h3 className="text-lg font-semibold text-gray-900 mb-3">Section 5 — the ramps ({corner.ramps.length})</h3>
        {corner.ramps.length === 0 && (
          <p className="bg-white rounded-lg shadow-sm p-6 text-sm text-gray-600">No ramps at this corner yet.</p>
        )}
        {corner.ramps.map((ramp, index) => (
          <section key={ramp.property_id} id={`ramp-${ramp.property_id}`} aria-label={`Ramp ${ramp.ramp_id_label ?? index + 1}`} className="mb-6 scroll-mt-4">
            <h4 className="text-base font-semibold text-gray-900 mb-2">
              Ramp {ramp.ramp_id_label ?? index + 1}
              <span className="font-normal text-gray-600">
                {' '}— {rampTypeLabel(ramp.ramp_type)} · {ramp.quadrant} · facing {facingStreetName(ramp) ?? '—'}
              </span>
            </h4>
            {requirementsFailed && (
              <TifLine
                tif={tifs.find(item => item.property_id === ramp.property_id)}
                warned={warned.has(ramp.property_id)}
                projectId={projectId}
                onDraft={canDraftTif ? () => startTif(ramp.property_id) : undefined}
                busy={busy}
              />
            )}
            <RampAttributesSection property={{ id: ramp.property_id, ramp_type: ramp.ramp_type }} canEdit={canEdit} />
            {inspection && (
              <PedRampPhotosSection
                parent={{ type: 'inspection', id: inspection.id }}
                propertyId={ramp.property_id}
                canEdit={canEdit}
                onPhotosChange={setFormPhotos}
              />
            )}
          </section>
        ))}

        {MOVES[dialog] && (
          <ConfirmDialog
            title={MOVES[dialog].title}
            message={MOVES[dialog].message}
            items={MOVES[dialog].items ?? null}
            note={dialog === 'submit' && formPhotos?.length === 0 ? NO_PHOTOS_WARNING : MOVES[dialog].note ?? null}
            confirmLabel={MOVES[dialog].confirmLabel}
            cancelLabel="Cancel"
            confirmClassName={MOVES[dialog].className ?? 'btn-primary'}
            onConfirm={move}
            onCancel={() => setDialog(null)}
            busy={busy}
            error={actionError?.message ?? null}
          />
        )}
        {dialog === 'return' && (
          <ReturnCommentModal
            title="Return inspection"
            recipient="the inspector"
            onConfirm={sendBack}
            onCancel={() => setDialog(null)}
            busy={busy}
            error={actionError?.message ?? null}
          />
        )}
        {dialog === 'corner' && (
          <PedrampSiteModal
            mode="edit-corner"
            corner={corner}
            onSave={saveCorner}
            onCancel={() => setDialog(null)}
            busy={busy}
            error={actionError}
          />
        )}

        <Toast message={toast} onDone={() => setToast(null)} />
      </main>
    </div>
  )
}


/**
 * A ramp card's TIF line, once the requirements are answered No: its TIF (a link to its page, with its status), or
 * "Draft TIF" for a ramp whose attributes raise ADA warnings (when onDraft is given), or a note that it needs one.
 * A ramp without warnings shows nothing.
 */
function TifLine({ tif, warned, projectId, onDraft, busy }) {
  if (tif) {
    return (
      <p className="mb-2 flex items-center gap-2 text-sm">
        <Link to={`/project/${projectId}/ped-ramp-tifs/${tif.id}`} className="font-medium text-construction-700 hover:underline">
          Technical Infeasibility Form
        </Link>
        <StatusBadge status={tif.status} />
      </p>
    )
  }
  if (!warned) return null
  return (
    <p className="mb-2 flex flex-wrap items-center gap-3 text-sm text-amber-800">
      <span>This ramp has ADA warnings and needs a TIF.</span>
      {onDraft && <button type="button" onClick={onDraft} disabled={busy} className="btn-secondary">Draft TIF</button>}
    </p>
  )
}
