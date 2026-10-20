/**
 * One ramp's Technical Infeasibility Form (Pedramp Phase 3, S3), at /project/:projectId/ped-ramp-tifs/:tifId, opened
 * from its ramp's card on the As-Built Inspection Form. One scrolling page of DOT's TIF v1.9 sections 1-7 (TIF_SECTIONS),
 * saved with Save (only what changed; a blank sends null). Its status heads it (Draft / Approved, with who signed it
 * when). Who may change it follows the backend: a draft TIF on a draft inspection, an inspector or an RE on the
 * project; on a submitted inspection, only an RE; an approved TIF, or one of an approved inspection, nobody ("TIF is
 * approved — no further edits"). An RE (or an admin) signs it with "Sign & Approve": their name as it prints (their own
 * to start) and New York licence number, both required; it uses their ICID signature image, which is not a
 * cryptographic signature. Everyone gets "Download TIF form" (DOT's form filled as it stands); an admin alone gets
 * Delete (confirmed), which returns to the inspection. Section 8's photos and section 9's site design / layout are
 * PedRampPhotosSection's, under the same lock. Refusals read as the backend words them.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useProjectRoles } from '../contexts/ProjectRolesContext'
import { approveTif, deleteTif, downloadTifForm, getTif, updateTif } from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
import { rampTypeLabel } from '../data/propertyKinds'
import { TIF_FIELDS, TIF_SECTIONS } from '../data/tifForm'
import ConfirmDialog from '../components/ConfirmDialog'
import DownloadFileButton from '../components/DownloadFileButton'
import PedRampPhotosSection from '../components/PedRampPhotosSection'
import StatusBadge from '../components/StatusBadge'
import Toast from '../components/Toast'
import { APPROVED_LOCK, SUBMITTED_LOCK } from './PedRampInspectionPage'

export const TIF_APPROVED_LOCK = 'TIF is approved — no further edits'
export const SIGNATURE_NOTE = 'Signed in ICID with your signature image; re-sign in Acrobat if DOT requires a cryptographic signature.'

const TYPES = Object.fromEntries(TIF_FIELDS.map(([key, , type]) => [key, type]))
const KEYS = TIF_FIELDS.map(([key]) => key)

// A stored value as the form holds it: a box's true / false, else text ('' for none)
const shown = (key, value) => (TYPES[key] === 'check' ? Boolean(value) : value === null || value === undefined ? '' : String(value))
// What the form sends for a field: a box as is, text trimmed, '' as null
const sent = (key, value) => (TYPES[key] === 'check' ? value : value.trim() === '' ? null : value.trim())
const valuesOf = (tif) => Object.fromEntries(KEYS.map(key => [key, shown(key, tif[key])]))

export default function PedRampTifPage() {
  const { projectId, tifId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { rolesByProject } = useProjectRoles()
  const admin = isAdmin(user)
  const roles = rolesByProject?.[projectId] ?? []
  const writer = !user?.is_demo
  const re = writer && (admin || roles.includes('re'))
  const drafter = writer && (admin || roles.includes('inspector') || roles.includes('re'))

  const [tif, setTif] = useState(null)
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry
  const [signer, setSigner] = useState({ signer_name: '', signer_ny_license_no: '' })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setLoadError(null)
    getTif(tifId)
      .then(found => {
        if (ignore) return
        setTif(found)
        setValues(valuesOf(found))
      })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [tifId, attempt])

  useEffect(() => {
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ')
    setSigner(current => (current.signer_name ? current : { ...current, signer_name: name }))
  }, [user])

  const inspectionPage = tif && `/project/${projectId}/ped-ramp-corners/${tif.corner_id}/inspection#ramp-${tif.property_id}`
  const back = (
    <button
      onClick={() => navigate(inspectionPage ?? `/project/${projectId}/properties`)}
      className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="font-medium">Back to the inspection</span>
    </button>
  )

  if (loading || loadError) {
    return (
      <div className="flex-1 bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {back}
          {loading ? (
            <div className="flex justify-center py-12">
              <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <p className="text-red-600 mb-4">Couldn't load the TIF: {loadError}</p>
              <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
            </div>
          )}
        </main>
      </div>
    )
  }

  const lock = tif.status === 'approved' ? TIF_APPROVED_LOCK
    : tif.inspection_status === 'approved' ? APPROVED_LOCK
      : tif.inspection_status === 'submitted' && !re ? SUBMITTED_LOCK : null
  const canEdit = drafter && !lock
  const canSign = re && tif.status === 'draft' && tif.inspection_status !== 'approved'
  const before = valuesOf(tif)
  const changes = Object.fromEntries(KEYS.filter(key => values[key] !== before[key]).map(key => [key, sent(key, values[key])]))
  const changed = Object.keys(changes).length > 0
  const signerReady = signer.signer_name.trim() && signer.signer_ny_license_no.trim()

  const run = async (action, done) => {
    setBusy(true)
    setActionError(null)
    try {
      await action()
      if (done) setToast(done)
    } catch (err) {
      setActionError(err)
    } finally {
      setBusy(false)
    }
  }
  const adopt = (found) => {
    setTif(found)
    setValues(valuesOf(found))
  }
  const save = () => run(async () => adopt(await updateTif(tif.id, changes)), 'TIF saved.')
  const sign = () => run(async () => adopt(await approveTif(tif.id, {
    signer_name: signer.signer_name.trim(), signer_ny_license_no: signer.signer_ny_license_no.trim(),
  })), 'TIF signed and approved.')
  const remove = async () => {
    setBusy(true)
    setActionError(null)
    try {
      await deleteTif(tif.id)
      navigate(inspectionPage)
    } catch (err) {
      setActionError(err)
      setBusy(false)
    }
  }

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const input = ([key, label, type, extra]) => {
    const id = `tif-${key}`
    const common = { id, disabled: !canEdit || busy }
    if (type === 'check') {
      return (
        <label key={key} htmlFor={id} className="flex items-start gap-2 text-sm text-gray-800 sm:col-span-1">
          <input type="checkbox" {...common} checked={values[key]} onChange={(e) => set(key, e.target.checked)} className="mt-0.5" />
          <span>{label}</span>
        </label>
      )
    }
    const control = type === 'select' ? (
      <select {...common} className="input-field" value={values[key]} onChange={(e) => set(key, e.target.value)}>
        <option value="">—</option>
        {extra.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    ) : type === 'textarea' ? (
      <textarea {...common} rows={4} maxLength={extra} className="input-field" value={values[key]} onChange={(e) => set(key, e.target.value)} />
    ) : (
      <input {...common} type={type === 'date' ? 'date' : 'text'} maxLength={type === 'date' ? undefined : extra} className="input-field" value={values[key]} onChange={(e) => set(key, e.target.value)} />
    )
    return (
      <div key={key} className={type === 'textarea' ? 'sm:col-span-2' : ''}>
        <label htmlFor={id} className="input-label">{label}</label>
        {control}
      </div>
    )
  }

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {back}

        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Technical Infeasibility Form — Ramp {tif.ramp_id_label ?? ''}
              <span className="font-normal text-gray-600"> ({rampTypeLabel(tif.ramp_type)} · {tif.quadrant})</span>
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <StatusBadge status={tif.status} />
              {tif.status === 'approved' && tif.signed_at && (
                <span>
                  Signed by {tif.signer_name} (NY licence {tif.signer_ny_license_no}) on {format(parseISO(tif.signed_at), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <DownloadFileButton label="Download TIF form" download={() => downloadTifForm(tif.id)} />
            {admin && tif.inspection_status !== 'approved' && (
              <button type="button" onClick={() => { setActionError(null); setDeleting(true) }} className="btn-secondary inline-flex items-center space-x-2 text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {lock && (
          <p role="note" className="mb-4 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700">{lock}</p>
        )}
        {actionError && !deleting && <p role="alert" className="mb-4 text-sm text-red-600">{actionError.message}</p>}

        {TIF_SECTIONS.map(section => (
          <section key={section.id} aria-label={section.title} className="bg-white rounded-lg shadow-sm p-6 mb-4">
            <h3 className="text-base font-semibold text-gray-900 mb-3">{section.title}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{section.fields.map(input)}</div>
          </section>
        ))}

        <PedRampPhotosSection parent={{ type: 'tif', id: tif.id }} canEdit={canEdit} kinds={['photo', 'layout']} />

        {canEdit && (
          <div className="flex justify-end mb-6">
            <button type="button" onClick={save} disabled={busy || !changed} className="btn-primary">
              {busy ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}

        {canSign && (
          <section aria-label="Sign and approve" className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">10. Statement and signature</h3>
            <p className="text-sm text-gray-600 mb-3">{SIGNATURE_NOTE}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tif-signer-name" className="input-label">Name (engineer / architect / landscape architect)</label>
                <input id="tif-signer-name" className="input-field" maxLength={200} value={signer.signer_name} disabled={busy}
                  onChange={(e) => setSigner(current => ({ ...current, signer_name: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="tif-signer-license" className="input-label">New York licence No.</label>
                <input id="tif-signer-license" className="input-field" maxLength={50} value={signer.signer_ny_license_no} disabled={busy}
                  onChange={(e) => setSigner(current => ({ ...current, signer_ny_license_no: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button type="button" onClick={sign} disabled={busy || !signerReady || changed} className="btn-primary"
                title={changed ? 'Save your changes first' : undefined}>
                Sign &amp; Approve
              </button>
            </div>
          </section>
        )}

        {deleting && (
          <ConfirmDialog
            title="Delete this TIF?"
            message="It is removed for good, with its photos. The ramp can have a new TIF drafted."
            confirmLabel="Delete"
            cancelLabel="Cancel"
            onConfirm={remove}
            onCancel={() => setDeleting(false)}
            busy={busy}
            error={actionError?.message ?? null}
          />
        )}

        <Toast message={toast} onDone={() => setToast(null)} />
      </main>
    </div>
  )
}
