/**
 * One property (route param :propertyId), at /admin/properties/:propertyId. Admins only: a card with its BBL,
 * address, type, notes and when it was added, with Edit and Delete; then its PIR card. With a live PIR the card
 * gives the inspector's initials, the date they signed, who digitized it when and whether the as-built is signed,
 * with Edit PIR and Delete PIR; without one it reads "No PIR yet." with Add PIR. The property's soft-deleted PIRs
 * are listed under it, muted, each with Un-delete (off while a live PIR exists). Every delete and un-delete is
 * confirmed first and announced in a toast; a refusal stays in its dialog. A deleted property reads Deleted, has
 * only Un-delete, and takes no new PIR (the backend refuses one). Back returns to the project's properties.
 * Anyone who isn't an admin is told so instead.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { createPir, getProperty, listPirs, updatePir, updateProperty } from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
import { shortDate } from '../lib/shortDate'
import { PIR_ACTIONS } from '../lib/pirs'
import { PROPERTY_ACTIONS } from '../lib/properties'
import { useUserNames } from '../lib/useUserNames'
import { propertyTypeLabel } from '../data/propertyTypes'
import ConfirmDialog from '../components/ConfirmDialog'
import PirFormModal from '../components/PirFormModal'
import PirStatusBadge from '../components/PirStatusBadge'
import PropertyFormModal from '../components/PropertyFormModal'
import StatusBadge from '../components/StatusBadge'
import Toast from '../components/Toast'

export const NO_PIR_TEXT = 'No PIR yet.'
export const NOT_CONFIRMED_TEXT = 'Not yet confirmed'
export const LIVE_PIR_TOOLTIP = 'This property has a live PIR. Delete it first to restore this one.'

// "Sep 14 by Ada Admin", or the date alone when the name isn't known
const dateBy = (timestamp, name) => `${shortDate(timestamp)}${name ? ` by ${name}` : ''}`

// The confirmed actions, by kind: a property's and a PIR's delete and un-delete
const ACTIONS = {
  'property-delete': PROPERTY_ACTIONS.delete,
  'property-undelete': PROPERTY_ACTIONS.undelete,
  'pir-delete': PIR_ACTIONS.delete,
  'pir-undelete': PIR_ACTIONS.undelete,
}

export default function AdminPropertyPage() {
  const { propertyId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const admin = isAdmin(user)
  const nameOf = useUserNames(admin ? user : null)

  const [property, setProperty] = useState(null)
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
    if (!admin) return
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
  }, [admin, propertyId, attempt])

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

  const save = async (values) => {
    const saved = form.kind === 'property'
      ? await run(() => updateProperty(property.id, values), setProperty)
      : await run(
        () => (form.mode === 'add' ? createPir(property.id, values) : updatePir(livePir.id, values)),
        rereadPirs,
      )
    if (saved) setForm(null)
  }

  const confirm = async () => {
    const { kind, target } = pending
    const action = ACTIONS[kind]
    const done = await run(() => action.run(target), kind.startsWith('property') ? setProperty : rereadPirs)
    if (!done) return
    setToast(action.done(target))
    setPending(null)
  }

  const backTo = property ? `/admin/projects/${property.project_id}/properties` : '/admin/projects'
  const back = (
    <button
      onClick={() => navigate(backTo)}
      className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="font-medium">{property ? `Back to Properties — ${property.project_id}` : 'Back to All Projects (Admin)'}</span>
    </button>
  )

  const page = (children) => (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {back}
        {children}
      </main>
    </div>
  )

  if (!admin) {
    return page(
      <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
        Only an admin can manage properties.
      </div>
    )
  }

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
        <p className="text-red-600 mb-4">Couldn't load the property: {loadError}</p>
        <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
      </div>
    )
  }

  const deleted = Boolean(property.deleted_at)

  return page(
    <>
      <h2 className="text-2xl font-bold text-gray-900 mb-6 inline-flex flex-wrap items-center gap-3">
        <span className={deleted ? 'line-through text-gray-400' : ''}>{property.project_id} · {property.address}</span>
        {deleted && (
          <span title={`Deleted ${format(parseISO(property.deleted_at), 'MMM d, yyyy')}`}>
            <StatusBadge status="deleted" />
          </span>
        )}
      </h2>

      {refreshError && (
        <p role="alert" className="text-sm text-red-600 mb-4">
          {refreshError}{' '}
          <button type="button" onClick={() => setAttempt(a => a + 1)} className="underline font-medium">Retry</button>
        </p>
      )}

      <section aria-labelledby="property-heading" className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 id="property-heading" className="text-lg font-semibold text-gray-900">Property</h3>
          <div className="flex flex-wrap gap-3">
            {deleted ? (
              <button
                type="button"
                onClick={() => open(() => setPending({ kind: 'property-undelete', target: property }))}
                className="btn-primary"
              >
                Un-delete
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => open(() => setForm({ kind: 'property' }))}
                  className="btn-secondary inline-flex items-center space-x-2"
                >
                  <Pencil className="h-4 w-4" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => open(() => setPending({ kind: 'property-delete', target: property }))}
                  className="btn-secondary inline-flex items-center space-x-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <Detail term="BBL">{property.bbl}</Detail>
          <Detail term="Address">{property.address}</Detail>
          <Detail term="Type">{propertyTypeLabel(property.property_type)}</Detail>
          <Detail term="Notes" wide><span className="whitespace-pre-line">{property.notes || '—'}</span></Detail>
          <Detail term="Added">{shortDate(property.created_at)}</Detail>
        </dl>
      </section>

      <section aria-labelledby="pir-heading" className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 id="pir-heading" className="text-lg font-semibold text-gray-900 inline-flex items-center gap-3">
            <span>PIR</span>
            <PirStatusBadge pir={livePir} />
          </h3>
          {livePir && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => open(() => setForm({ kind: 'pir', mode: 'edit' }))}
                className="btn-secondary inline-flex items-center space-x-2"
              >
                <Pencil className="h-4 w-4" />
                <span>Edit PIR</span>
              </button>
              <button
                type="button"
                onClick={() => open(() => setPending({ kind: 'pir-delete', target: livePir }))}
                className="btn-secondary inline-flex items-center space-x-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete PIR</span>
              </button>
            </div>
          )}
        </div>

        {livePir ? (
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
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-gray-600">
              {NO_PIR_TEXT}{deleted ? ' A deleted property takes no PIR; un-delete it first.' : ''}
            </p>
            {!deleted && (
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

        {deletedPirs.length > 0 && (
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

      {form?.kind === 'property' && (
        <PropertyFormModal
          mode="edit"
          initial={property}
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
