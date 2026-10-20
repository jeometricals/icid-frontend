/**
 * One property (route params :projectId and :propertyId), at /project/:projectId/properties/:propertyId, for anyone
 * on the project: a card with the site's details (a sidewalk's borough, block, lot, CB, address, violation no. and property
 * type; a ped ramp's borough, CB, intersection, quadrant, the street it faces and ramp type; then notes and when it was
 * added), headed by its display_address; then its PIR card. With a live
 * PIR the card gives the inspector's initials, the date they signed, who digitized it when and whether the
 * as-built is signed, under the way into its sketch workspace (PirWorkspaceLink: its page count and "Open sketch
 * workspace", PirPage); without one it reads "No PIR yet.". A member who isn't a demo user also gets
 * Edit on the site, and Add PIR or Edit PIR. The destructive controls are an admin's alone: Delete and Delete
 * PIR, and the property's soft-deleted PIRs listed under the card, muted, each with Un-delete (off while a live PIR
 * exists). Every delete and un-delete is confirmed first and announced in a toast; a refusal stays in its dialog.
 * A deleted property reads Deleted and takes no new PIR (the backend refuses one); only an admin can change it, or
 * its PIR, or un-delete it. A PIR's flags are drawn and listed in its workspace. Everyone on the project, demo users
 * too, gets "Download Construction Report" (DownloadFileButton), on once an approved IDR has claimed one
 * of the live PIR's flags (when the flags can't be read the button stays on, and the backend's 404 says why). Back returns to the project's
 * properties; Back to task order to the latest live task order the site is in (the property's task_order_id), and is
 * off, titled "Not in a task order", when it is in none. The backend refuses anyone not on the
 * project (403), which shows as the load error.
 * A ped ramp (pedramp 2a) also shows its inspection corner in the Site card (its streets and direction, or a dash), and
 * "As-Built Inspection Form" beside Edit (a ped ramp at a corner: its corner's inspection, at this ramp), and
 * under the Site card, its Ramp Attributes (RampAttributesSection), which whoever may change the site saves and
 * everyone else reads. A ped ramp at a corner is edited in the Pedramp dialog (PedrampSiteModal, mode 'edit-ramp'): its
 * own fields and Ramp ID, the corner's sections locked (they are edited from Site Info, so its streets never part from
 * its corner's); one without a corner (or whose corner couldn't be read) in PropertyFormModal, which offers the live
 * corners.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  createPir, downloadConstructionReport, getProperty, listCorners, listFlags, listPirs, saveRampLabel, updatePir,
  updateProperty,
} from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
import { shortDate } from '../lib/shortDate'
import { PIR_ACTIONS, PIR_DEMO_NOTE } from '../lib/pirs'
import { PROPERTY_ACTIONS } from '../lib/properties'
import { useUserNames } from '../lib/useUserNames'
import { propertyTypeLabel } from '../data/propertyTypes'
import { facingStreetName, rampTypeLabel } from '../data/propertyKinds'
import ConfirmDialog from '../components/ConfirmDialog'
import DownloadFileButton from '../components/DownloadFileButton'
import PirFormModal from '../components/PirFormModal'
import PirStatusBadge from '../components/PirStatusBadge'
import PirWorkspaceLink from '../components/PirWorkspaceLink'
import PedrampSiteModal from '../components/PedrampSiteModal'
import { INSPECTION_FORM, inspectionPath } from '../components/PedRampsSection'
import PropertyFormModal from '../components/PropertyFormModal'
import RampAttributesSection from '../components/RampAttributesSection'
import StatusBadge from '../components/StatusBadge'
import Toast from '../components/Toast'

const NOT_IN_A_TASK_ORDER = 'Not in a task order'

export const NO_PIR_TEXT = 'No PIR yet.'
export const NOT_COVERED = 'No approved IDR has claimed this site’s flags yet.'
export const NOT_CONFIRMED_TEXT = 'Not yet confirmed'
export const LIVE_PIR_TOOLTIP = 'This site has a live PIR. Delete it first to restore this one.'
export const DEMO_NOTE = PIR_DEMO_NOTE

// "Sep 14 by Ada Admin", or the date alone when the name isn't known
const dateBy = (timestamp, name) => `${shortDate(timestamp)}${name ? ` by ${name}` : ''}`

// The confirmed actions, by kind: a property's and a PIR's delete and un-delete
const ACTIONS = {
  'property-delete': PROPERTY_ACTIONS.delete,
  'property-undelete': PROPERTY_ACTIONS.undelete,
  'pir-delete': PIR_ACTIONS.delete,
  'pir-undelete': PIR_ACTIONS.undelete,
}

export default function PropertyPage() {
  const { projectId, propertyId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const admin = isAdmin(user)
  const writer = !user?.is_demo // the backend keeps demo users read-only on properties and PIRs
  const nameOf = useUserNames(user)

  const [property, setProperty] = useState(null)
  // A write answers with the property alone; the task order it is in is only read with it, and no write changes it
  const setWritten = written => setProperty(current => ({
    ...written, task_order_id: current?.task_order_id ?? null, task_order_no: current?.task_order_no ?? null,
  }))
  const [pirs, setPirs] = useState([]) // every PIR of the property, deleted ones included, newest first
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  // The open dialog: {kind: 'property'} to edit the property, or {kind: 'pir', mode: 'add' | 'edit'}
  const [form, setForm] = useState(null)
  const [pending, setPending] = useState(null) // {kind, target}: the delete or un-delete waiting to be confirmed
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null) // the open dialog's failed action: the thrown error
  const [refreshError, setRefreshError] = useState(null) // a change worked but the PIRs couldn't be read again

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setLoadError(null)
    setRefreshError(null)
    Promise.all([getProperty(propertyId), listPirs(propertyId, { includeDeleted: true })])
      .then(([found, foundPirs]) => {
        if (ignore) return
        setProperty(found)
        setPirs(foundPirs)
      })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [propertyId, attempt])

  const open = (show) => {
    setActionError(null)
    show()
  }

  // Reads the PIRs again rather than guessing what the backend wrote
  const rereadPirs = async () => {
    try {
      setPirs(await listPirs(propertyId, { includeDeleted: true }))
      setRefreshError(null)
    } catch (err) {
      setRefreshError(`The change was saved, but the PIRs couldn't be refreshed: ${err.message}`)
    }
  }

  // Runs the open dialog's action, then what follows it. A refusal stays in the dialog; a 409 (the property got a
  // PIR meanwhile, or the one being restored lost its place) reads the PIRs again behind it, so closing the dialog
  // shows why. Resolves to whether the action went through.
  const run = async (action, after) => {
    setBusy(true)
    setActionError(null)
    let result
    try {
      result = await action()
    } catch (err) {
      setActionError(err)
      setBusy(false)
      if (err.status === 409) rereadPirs()
      return false
    }
    await after(result)
    setBusy(false)
    return true
  }

  const livePir = pirs.find(pir => !pir.deleted_at) ?? null
  const deletedPirs = pirs.filter(pir => pir.deleted_at)

  // Whether an approved IDR has claimed one of the live PIR's flags (only an approval claims): null while unknown
  const livePirId = livePir?.id ?? null
  const [claimed, setClaimed] = useState(null)
  useEffect(() => {
    if (!livePirId) {
      setClaimed(false)
      return undefined
    }
    let ignore = false
    setClaimed(null)
    listFlags(livePirId)
      .then(flags => { if (!ignore) setClaimed(flags.some(flag => flag.claimed_by_idr_id)) })
      .catch(() => { if (!ignore) setClaimed(true) }) // let the backend decide, and say why if it refuses
    return () => { ignore = true }
  }, [livePirId])

  // A ped ramp's project's live corners: its own shown in the Site card, all offered in its edit form. null until read
  // (or when they can't be: the card then shows a dash and the form offers none)
  const rampProject = property?.kind === 'ped_ramp' ? property.project_id : null
  const [corners, setCorners] = useState(null)
  useEffect(() => {
    if (!rampProject) return undefined
    let ignore = false
    listCorners(rampProject)
      .then(found => { if (!ignore) setCorners(found) })
      .catch(() => { if (!ignore) setCorners(null) })
    return () => { ignore = true }
  }, [rampProject])
  const corner = corners?.find(item => item.corner_id === property?.corner_id) ?? null

  // The Pedramp dialog's save: the ramp's own changes, then its Ramp ID; then the corners again, for its Ramp ID
  const saveRamp = async ({ ramp, label }) => {
    const saved = await run(async () => {
      const written = Object.keys(ramp).length > 0 ? await updateProperty(property.id, ramp) : property
      if (label !== undefined) await saveRampLabel(property.id, ramp.ramp_type ?? property.ramp_type, label)
      return written
    }, async (written) => {
      setWritten(written)
      try {
        setCorners(await listCorners(property.project_id))
      } catch {
        // the Site card keeps the corner it had; the next load reads it again
      }
    })
    if (saved) setForm(null)
  }

  const save = async (values) => {
    const saved = form.kind === 'property'
      ? await run(() => updateProperty(property.id, values), setWritten)
      : await run(
        () => (form.mode === 'add' ? createPir(property.id, values) : updatePir(livePir.id, values)),
        rereadPirs,
      )
    if (saved) setForm(null)
  }

  const confirm = async () => {
    const { kind, target } = pending
    const action = ACTIONS[kind]
    const done = await run(() => action.run(target), kind.startsWith('property') ? setWritten : rereadPirs)
    if (!done) return
    setToast(action.done(target))
    setPending(null)
  }

  const taskOrderId = property?.task_order_id ?? null
  const back = (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mb-6">
      <button
        onClick={() => navigate(`/project/${projectId}/properties`)}
        className="flex items-center space-x-2 text-construction-700 hover:text-construction-800"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="font-medium">Back to Site Info — {projectId}</span>
      </button>
      <button
        onClick={() => navigate(`/project/${projectId}/task-orders/${taskOrderId}`)}
        disabled={!taskOrderId}
        title={taskOrderId ? undefined : NOT_IN_A_TASK_ORDER}
        className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="font-medium">Back to task order{property?.task_order_no ? ` ${property.task_order_no}` : ''}</span>
      </button>
    </div>
  )

  const page = (children) => (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {back}
        {children}
      </main>
    </div>
  )

  if (loading && !property) {
    return (
      <div className="flex-1 bg-gray-50 flex justify-center py-12">
        <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
      </div>
    )
  }

  if (loadError) {
    return page(
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <p className="text-red-600 mb-4">Couldn't load the site: {loadError}</p>
        <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
      </div>
    )
  }

  const deleted = Boolean(property.deleted_at)
  // A deleted property is the admin's: anyone else can't change it or its PIR (the backend refuses with 400)
  const canChange = writer && (!deleted || admin)

  return page(
    <>
      <h2 className="text-2xl font-bold text-gray-900 mb-6 inline-flex flex-wrap items-center gap-3">
        <span className={deleted ? 'line-through text-gray-400' : ''}>{property.project_id} · {property.display_address}</span>
        {deleted && (
          <span title={`Deleted ${format(parseISO(property.deleted_at), 'MMM d, yyyy')}`}>
            <StatusBadge status="deleted" />
          </span>
        )}
      </h2>

      {!writer && <p className="text-sm text-gray-600 mb-4">{DEMO_NOTE}</p>}

      {refreshError && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {refreshError}{' '}
          <button type="button" onClick={() => setAttempt(a => a + 1)} className="underline font-medium">Retry</button>
        </p>
      )}

      <section aria-labelledby="property-heading" className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 id="property-heading" className="text-lg font-semibold text-gray-900">Site</h3>
          <div className="flex flex-wrap items-start gap-3">
            <DownloadFileButton
              label="Download Construction Report"
              download={() => downloadConstructionReport(property.id)}
              enabled={claimed === true}
              disabledTitle={claimed === null ? 'Checking for an approved IDR…' : NOT_COVERED}
            />
            {deleted ? (admin && (
              <button
                type="button"
                onClick={() => open(() => setPending({ kind: 'property-undelete', target: property }))}
                className="btn-primary"
              >
                Un-delete
              </button>
            )) : (
              <>
                {property.kind === 'ped_ramp' && property.corner_id && (
                  <Link
                    to={inspectionPath({ project_id: property.project_id, corner_id: property.corner_id }, property.id)}
                    className="btn-secondary"
                  >
                    {INSPECTION_FORM}
                  </Link>
                )}
                {writer && (
                  <button
                    type="button"
                    onClick={() => open(() => setForm({ kind: 'property' }))}
                    className="btn-secondary inline-flex items-center space-x-2"
                  >
                    <Pencil className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                )}
                {admin && (
                  <button
                    type="button"
                    onClick={() => open(() => setPending({ kind: 'property-delete', target: property }))}
                    className="btn-secondary inline-flex items-center space-x-2 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <Detail term="Borough">{property.boro}</Detail>
          {property.kind === 'ped_ramp' ? (
            <>
              <Detail term="CB">{property.community_board || '—'}</Detail>
              <Detail term="Intersection">{property.intersection_street_1} & {property.intersection_street_2}</Detail>
              <Detail term="Quadrant">{property.quadrant}</Detail>
              <Detail term="Facing">{facingStreetName(property) || '—'}</Detail>
              <Detail term="Ramp type">{rampTypeLabel(property.ramp_type)}</Detail>
              <Detail term="Inspection corner">
                {corner
                  ? `${corner.north_south_street} & ${corner.east_west_street}${corner.corner_direction ? ` (${corner.corner_direction})` : ''}`
                  : '—'}
              </Detail>
            </>
          ) : (
            <>
              <Detail term="Block">{property.block}</Detail>
              <Detail term="Lot">{property.lot}</Detail>
              <Detail term="CB">{property.community_board || '—'}</Detail>
              <Detail term="Address">{property.address}</Detail>
              <Detail term="Violation No.">{property.violation_no || '—'}</Detail>
              <Detail term="Type">{propertyTypeLabel(property.property_type)}</Detail>
            </>
          )}
          <Detail term="Notes" wide><span className="whitespace-pre-line">{property.notes || '—'}</span></Detail>
          <Detail term="Added">{shortDate(property.created_at)}</Detail>
        </dl>
      </section>

      {property.kind === 'ped_ramp' && <RampAttributesSection property={property} canEdit={canChange} />}

      <section aria-labelledby="pir-heading" className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 id="pir-heading" className="text-lg font-semibold text-gray-900 inline-flex items-center gap-3">
            <span>PIR</span>
            <PirStatusBadge pir={livePir} />
          </h3>
          {livePir && (canChange || admin) && (
            <div className="flex flex-wrap gap-3">
              {canChange && (
                <button
                  type="button"
                  onClick={() => open(() => setForm({ kind: 'pir', mode: 'edit' }))}
                  className="btn-secondary inline-flex items-center space-x-2"
                >
                  <Pencil className="h-4 w-4" />
                  <span>Edit PIR</span>
                </button>
              )}
              {admin && (
                <button
                  type="button"
                  onClick={() => open(() => setPending({ kind: 'pir-delete', target: livePir }))}
                  className="btn-secondary inline-flex items-center space-x-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete PIR</span>
                </button>
              )}
            </div>
          )}
        </div>

        {livePir ? (
          <>
            <PirWorkspaceLink pir={livePir} projectId={projectId} propertyId={property.id} />
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
              <Detail term="Inspector initials">{livePir.inspector_initials}</Detail>
              <Detail term="Signed on">{shortDate(livePir.inspector_sign_date)}</Detail>
              <Detail term="Digitized">{dateBy(livePir.digitized_at, nameOf(livePir.digitized_by))}</Detail>
              <Detail term="As-built" wide>
                {livePir.as_built_signed_at
                  ? `As-built signed${nameOf(livePir.as_built_signed_by) ? ` by ${nameOf(livePir.as_built_signed_by)}` : ''} on ${shortDate(livePir.as_built_signed_at)}`
                  : NOT_CONFIRMED_TEXT}
              </Detail>
            </dl>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-gray-600">
              {NO_PIR_TEXT}{deleted ? ' A deleted site takes no PIR; un-delete it first.' : ''}
            </p>
            {!deleted && writer && (
              <button
                type="button"
                onClick={() => open(() => setForm({ kind: 'pir', mode: 'add' }))}
                className="btn-primary inline-flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add PIR</span>
              </button>
            )}
          </div>
        )}

        {admin && deletedPirs.length > 0 && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">Deleted PIRs</h4>
            <ul className="divide-y divide-gray-200">
              {deletedPirs.map(pir => (
                <li key={pir.id} data-deleted="true" className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm text-gray-400">
                  <span>
                    <span className="line-through">{pir.inspector_initials}, signed {shortDate(pir.inspector_sign_date)}</span>
                    {' · '}deleted {shortDate(pir.deleted_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => open(() => setPending({ kind: 'pir-undelete', target: pir }))}
                    disabled={Boolean(livePir)}
                    title={livePir ? LIVE_PIR_TOOLTIP : undefined}
                    className="btn-secondary"
                  >
                    Un-delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {form?.kind === 'property' && corner && (
        <PedrampSiteModal
          mode="edit-ramp"
          corner={corner}
          ramp={{ ...property, ramp_id_label: corner.ramps.find(item => item.property_id === property.id)?.ramp_id_label }}
          onSave={saveRamp}
          onCancel={() => setForm(null)}
          busy={busy}
          error={actionError}
        />
      )}

      {form?.kind === 'property' && !corner && (
        <PropertyFormModal
          mode="edit"
          initial={property}
          corners={corners ? corners.filter(item => !item.deleted_at) : undefined}
          onSave={save}
          onCancel={() => setForm(null)}
          busy={busy}
          error={actionError}
        />
      )}

      {form?.kind === 'pir' && (
        <PirFormModal
          mode={form.mode}
          initial={form.mode === 'edit' ? livePir : undefined}
          onSave={save}
          onCancel={() => setForm(null)}
          busy={busy}
          error={actionError}
        />
      )}

      {pending && (
        <ConfirmDialog
          title={ACTIONS[pending.kind].title(pending.target)}
          message={ACTIONS[pending.kind].message(pending.target)}
          confirmLabel={ACTIONS[pending.kind].confirmLabel}
          cancelLabel="Cancel"
          confirmClassName={ACTIONS[pending.kind].confirmClassName}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
          busy={busy}
          error={actionError?.message ?? null}
        />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  )
}

// One term and its value in a card's list; wide ones take two columns
function Detail({ term, wide = false, children }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="font-medium text-gray-500">{term}</dt>
      <dd className="mt-1 text-gray-900">{children}</dd>
    </div>
  )
}
