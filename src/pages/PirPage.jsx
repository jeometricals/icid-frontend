/**
 * A site's PIR workspace (route params :projectId and :propertyId), at /project/:projectId/properties/:propertyId/pir,
 * for anyone on the project: the PIR's scanned pages, one at a time. Prev / Next and "Page n of N" (also the [ and ]
 * keys) move between them, and the page shown is in the URL (?page=, replaced rather than pushed). Each page shows
 * at its rotation, with its scale ("15 px/ft", or "not set"), in the sketch workspace (SketchWorkspace: the shape
 * toolbar, the page's flags drawn over it, the selected flag's panel, Calibrate, and every flag listed below). A
 * writer (a member who isn't a demo user; while the site is deleted only an admin) can use Rotate (a quarter turn
 * clockwise, saved on that page), Set scale (that page only), Replace PIR (a new upload replaces every page) and
 * Remove pages, and draw, and import a Smart PIR file (after which the pages are read again if it set any page's
 * scale, rotation or title block); for a reader they are there but disabled. With no pages the card prompts an upload. The
 * backend refuses anyone not on the project (403), which shows as the load error.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCw, Ruler, Trash2, Upload } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { deletePirPages, getPirByProperty, getProperty, listPirPages, nextRotation, setPirPageRotation } from '../services/api'
import { isAdmin } from '../lib/reviewRoles'
import { PIR_DEMO_NOTE } from '../lib/pirs'
import ConfirmDialog from '../components/ConfirmDialog'
import GoToProjectButton from '../components/GoToProjectButton'
import PageScaleModal from '../components/PageScaleModal'
import PirStatusBadge from '../components/PirStatusBadge'
import PirUploadModal, { UPLOAD_PROMPT } from '../components/PirUploadModal'
import StatusBadge from '../components/StatusBadge'
import Toast from '../components/Toast'
import SketchWorkspace from '../components/sketch/SketchWorkspace'

export const NO_PIR_TEXT = 'This site has no PIR yet. Add one on the site page first.'
export const NO_PAGES_READ_ONLY = 'No PIR pages uploaded yet.'
export const IMAGE_FAILED_TEXT = "The page didn't load; its link may have expired."

// "15 px/ft", "12.35 px/ft"; "not set" for a page without a scale
export const scaleText = (scale) => (scale == null ? 'not set' : `${Number(Number(scale).toFixed(2))} px/ft`)

// "3 pages", "1 page"
const pagesText = (count) => `${count} ${count === 1 ? 'page' : 'pages'}`

// Whether a key press belongs to a form control (or a modifier shortcut), not to page navigation
const typingIn = (e) => e.ctrlKey || e.metaKey || e.altKey
  || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable

export default function PirPage() {
  const { projectId, propertyId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const admin = isAdmin(user)

  const [property, setProperty] = useState(null)
  const [pir, setPir] = useState(null)
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  const [dialog, setDialog] = useState(null) // 'upload', 'scale' or 'remove'
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null) // a failed rotate or remove
  const [imageFailed, setImageFailed] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setLoadError(null)
    Promise.all([getProperty(propertyId), getPirByProperty(propertyId)])
      .then(async ([foundProperty, foundPir]) => {
        const foundPages = foundPir ? await listPirPages(foundPir.id) : []
        if (ignore) return
        setProperty(foundProperty)
        setPir(foundPir)
        setPages(foundPages)
        setImageFailed(false)
      })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [propertyId, attempt])

  // The page shown: ?page= within 1..N, else the first
  const count = pages.length
  const asked = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const pageNumber = count === 0 ? 0 : Math.min(Math.max(Number.isNaN(asked) ? 1 : asked, 1), count)
  const page = pages[pageNumber - 1] ?? null

  const goTo = useCallback((number) => {
    setImageFailed(false)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('page', String(number))
      return next
    }, { replace: true })
  }, [setSearchParams])

  // [ and ] move a page back and forward, unless a dialog is open or the key is being typed into a field
  useEffect(() => {
    const onKeyDown = (e) => {
      if (dialog || typingIn(e) || count === 0) return
      if (e.key === '[' && pageNumber > 1) goTo(pageNumber - 1)
      if (e.key === ']' && pageNumber < count) goTo(pageNumber + 1)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dialog, count, pageNumber, goTo])

  const replacePage = (saved) => setPages(current => current.map(found => (found.pir_page_id === saved.pir_page_id ? saved : found)))

  const rotate = async () => {
    setBusy(true)
    setActionError(null)
    try {
      replacePage(await setPirPageRotation(page.pir_page_id, nextRotation(page.rotation_deg)))
    } catch (err) {
      setActionError(`Couldn't rotate page ${page.page_number}: ${err.message}`)
    }
    setBusy(false)
  }

  const removePages = async () => {
    setBusy(true)
    setActionError(null)
    try {
      await deletePirPages(pir.id)
    } catch (err) {
      setActionError(err.message)
      setBusy(false)
      return
    }
    setBusy(false)
    setPages([])
    setDialog(null)
    setToast('PIR pages removed.')
  }

  const uploaded = (saved) => {
    const replacing = count > 0
    setPages(saved.pages ?? [])
    setDialog(null)
    goTo(1)
    setToast(`PIR ${replacing ? 'replaced' : 'uploaded'}: ${pagesText(saved.pages?.length ?? 0)}.`)
  }

  // An import set some pages' scale or rotation: read them again, quietly (the same pages, so the workspace stays)
  const rereadPages = async () => {
    try {
      setPages(await listPirPages(pir.id))
    } catch (err) {
      setActionError(`The import went in, but the pages couldn't be read again: ${err.message}`)
    }
  }

  const header = (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mb-6">
      <button
        onClick={() => navigate(`/project/${projectId}/properties/${propertyId}`)}
        className="flex items-center space-x-2 text-construction-700 hover:text-construction-800"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="font-medium">Back to Site{property ? ` ${property.bbl}` : ''}</span>
      </button>
      <GoToProjectButton onClick={() => navigate(`/project/${projectId}`)} />
    </div>
  )

  const shell = (children) => (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {header}
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
    return shell(
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <p className="text-red-600 mb-4">Couldn't load the PIR: {loadError}</p>
        <button onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
      </div>
    )
  }

  const deleted = Boolean(property.deleted_at)
  // A demo user only reads; a deleted site is the admin's (the backend refuses anyone else with 400)
  const writer = !user?.is_demo && (!deleted || admin)

  return shell(
    <>
      <h2 className="text-2xl font-bold text-gray-900 mb-6 inline-flex flex-wrap items-center gap-3">
        <span className={deleted ? 'line-through text-gray-400' : ''}>PIR · {property.address}</span>
        <PirStatusBadge pir={pir} />
        {deleted && <StatusBadge status="deleted" />}
      </h2>

      {user?.is_demo && <p className="text-sm text-gray-600 mb-4">{PIR_DEMO_NOTE}</p>}

      {!pir ? (
        <section className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-600">{NO_PIR_TEXT}</p>
        </section>
      ) : count === 0 ? (
        <section aria-label="PIR pages" className="bg-white rounded-lg shadow-sm p-6">
          {writer ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <p className="text-gray-700 mb-4">{UPLOAD_PROMPT}</p>
              <button type="button" onClick={() => setDialog('upload')} className="btn-primary inline-flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Upload PIR</span>
              </button>
            </div>
          ) : (
            <p className="text-gray-600">{NO_PAGES_READ_ONLY}</p>
          )}
        </section>
      ) : (
        <section aria-label="PIR pages" className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goTo(pageNumber - 1)}
                disabled={pageNumber <= 1}
                aria-label="Previous page"
                title="Previous page ([)"
                className="btn-secondary px-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-gray-900 tabular-nums" aria-live="polite">
                Page {pageNumber} of {count}
              </span>
              <button
                type="button"
                onClick={() => goTo(pageNumber + 1)}
                disabled={pageNumber >= count}
                aria-label="Next page"
                title="Next page (])"
                className="btn-secondary px-2"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-500 ml-3">Scale: {scaleText(page.scale_px_per_ft)}</span>
            </div>
            <div className="flex flex-wrap gap-2" title={writer ? undefined : 'Read-only'}>
              <button type="button" onClick={rotate} disabled={busy || !writer} className="btn-secondary inline-flex items-center space-x-2">
                <RotateCw className="h-4 w-4" />
                <span>Rotate</span>
              </button>
              <button type="button" onClick={() => setDialog('scale')} disabled={busy || !writer} className="btn-secondary inline-flex items-center space-x-2">
                <Ruler className="h-4 w-4" />
                <span>Set scale</span>
              </button>
              <button type="button" onClick={() => setDialog('upload')} disabled={busy || !writer} className="btn-secondary inline-flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Replace PIR</span>
              </button>
              <button
                type="button"
                onClick={() => { setActionError(null); setDialog('remove') }}
                disabled={busy || !writer}
                className="btn-secondary inline-flex items-center space-x-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                <span>Remove pages</span>
              </button>
            </div>
          </div>

          {actionError && !dialog && <p role="alert" className="text-sm text-red-600 mb-4">{actionError}</p>}

          {imageFailed ? (
            <div className="text-center py-8">
              <p className="text-gray-700 mb-4">{IMAGE_FAILED_TEXT}</p>
              <button type="button" onClick={() => setAttempt(a => a + 1)} className="btn-primary">Reload pages</button>
            </div>
          ) : (
            <SketchWorkspace
              key={pages.map(found => found.pir_page_id).join()}
              pir={pir}
              page={page}
              pages={pages}
              writer={writer}
              onPageSaved={(saved) => {
                replacePage(saved)
                setToast(`Page ${saved.page_number} scale set to ${scaleText(saved.scale_px_per_ft)}.`)
              }}
              onPagesChanged={rereadPages}
              onJump={goTo}
              onImageError={() => setImageFailed(true)}
            />
          )}
        </section>
      )}

      {dialog === 'upload' && (
        <PirUploadModal pirId={pir.id} replacing={count > 0} onUploaded={uploaded} onClose={() => setDialog(null)} />
      )}

      {dialog === 'scale' && (
        <PageScaleModal
          page={page}
          onSaved={(saved) => {
            replacePage(saved)
            setDialog(null)
            setToast(`Page ${saved.page_number} scale set to ${scaleText(saved.scale_px_per_ft)}.`)
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === 'remove' && (
        <ConfirmDialog
          title="Remove the PIR's pages?"
          message={`All ${pagesText(count)} and the flags drawn on them are deleted.`}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          confirmClassName="btn-danger"
          onConfirm={removePages}
          onCancel={() => setDialog(null)}
          busy={busy}
          error={actionError}
        />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  )
}
