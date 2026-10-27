import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import {
  createFlagOnPage, deleteFlag, getContractItems, getPageTitleBlock, listFlagNonAssessableAreas, listFlags,
  listPirFeatures, listPirSegments, putSidewalkStrip, updateFlag,
} from '../../services/api'
import { newFlagValues } from '../../lib/flags'
import { flagsToFlip, stripFrontageFt, stripProblem } from '../../lib/stripGeometry'
import ConfirmDialog from '../ConfirmDialog'
import CalibrateControl from './CalibrateControl'
import FlagPanel from './FlagPanel'
import FlagsFallbackList from './FlagsFallbackList'
import SegmentsTable from './SegmentsTable'
import ShapeToolbar from './ShapeToolbar'
import SketchCanvas from './SketchCanvas'
import StripControl, { STRIP_NO_ROLE, STRIP_NO_SCALE } from './StripControl'
import Toast from '../Toast'

export const NO_SCALE_REASON = "Set this page's scale (or calibrate) to draw flags."
export const PANEL_EMPTY_TEXT = 'Select a flag to see its details.'
export const PANEL_EMPTY_WRITER_TEXT = 'Pick a shape and click the page to add a flag, or select one to edit it.'
export const AI_DETECT_TOOLTIP = 'Available when Vercel Pro is enabled (R1k).'
export const STRIP_CLEAR_TITLE = 'Clear the sidewalk strip?'
export const STRIP_CLEAR_MESSAGE = 'The strip is removed. Flags it marked non-assessable stay non-assessable: revert each '
  + 'one in the flag editor if needed.'
// Two clicks closer than this (page pixels) are one point: a double-click's two clicks, say
const SAME_POINT_PX = 3

/** What a saved strip did, for its toast. */
export function stripSavedText(flipped, claimed) {
  let text = `Sidewalk strip saved; ${flipped} flag${flipped === 1 ? '' : 's'} marked non-assessable (outside the strip).`
  if (claimed > 0) {
    text += ` ${claimed} claimed flag${claimed === 1 ? ' is' : 's are'} outside it but ${claimed === 1 ? 'was' : 'were'} not changed.`
  }
  return text
}

const TOOL_BUTTON = 'inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm '
  + 'font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'

// A button for a feature still to come: always disabled, its tooltip saying when it comes (on a wrapper too, since a
// disabled button shows no tooltip in every browser)
function ComingButton({ icon: Icon, label, tooltip }) {
  return (
    <span title={tooltip} className="inline-flex">
      <button type="button" disabled title={tooltip} className={TOOL_BUTTON}>
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </button>
    </span>
  )
}

// Whether a key press belongs to a form control (or a modifier shortcut), not to the sketch
const typingIn = (e) => e.ctrlKey || e.metaKey || e.altKey
  || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable

/**
 * The sketch workspace of one PIR page: the shape toolbar and Calibrate above, the page with its sketch
 * (SketchCanvas) beside the selected flag's panel (FlagPanel), and every flag of the PIR in a read-only list below
 * (FlagsFallbackList), then its curb segments in another (SegmentsTable, when it has some; a writer sets a segment's
 * reported length there). Reads the PIR's flags and the project's contract items when it mounts (render it with a key
 * that changes when the pages are replaced). A writer places a flag by arming a shape and clicking the page (the
 * defaults of lib/flags.js `newFlagValues`, then it is selected; the shape stays armed until Esc or its button),
 * drags a selected flag to move it (saved on release; a refusal puts it back), deletes the selected flag with the
 * Delete key or the panel's button, and calibrates the page's scale. Without a scale nothing can be drawn (the
 * toolbar says why). A reader (a demo user, or anyone but an admin on a deleted site) gets the same views with the
 * toolbar, Calibrate and the panel disabled. Clicking a list row goes to its page (onJump) and selects the flag.
 * It also reads the PIR's features and segments and the non-assessable areas of every flag that has some
 * (non_assessable_areas_count), and draws them (rendering only: there is no editor for them yet; a Smart PIR file
 * is imported on the admin's /admin/import-smart-pirs). "Auto-detect with AI" is a disabled stub whose tooltip says
 * when it comes. A flag an approved IDR claimed carries an "IDR #042" badge on the page and a line in its panel; either
 * opens that IDR (onOpenIdr).
 * The page's sidewalk strip (Slice Y1.5; StripControl): read off the page's title block, drawn red with its property line
 * heavier, shown or hidden. A strip writer (an OE or RE on the project, or an admin) draws it on a scaled page: clicks
 * add points (the property line first), Enter, a double-click or Finish saves it (putSidewalkStrip), Esc or Cancel
 * drops it; while drawing, the flags it would mark non-assessable are tinted red (lib/stripGeometry.js, the backend's
 * own test). The save's toast says how many flags were marked and how many claimed ones were left; the marked flags
 * are updated in place. Clear asks first and warns that marked flags stay so.
 * Props: pir (id, project_id), page, pages, writer, stripWriter, onPageSaved(page), onJump(pageNumber), onImageError,
 * initialFlagId (the flag selected to start, from the URL's ?flag=), onOpenIdr(flag).
 */
export default function SketchWorkspace({
  pir, page, pages, writer, stripWriter = false, onPageSaved, onJump, onImageError, initialFlagId = null, onOpenIdr,
}) {
  const [flags, setFlags] = useState([])
  const [areas, setAreas] = useState([])
  const [features, setFeatures] = useState([])
  const [segments, setSegments] = useState([])
  const [contractItems, setContractItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  const [selectedId, setSelectedId] = useState(initialFlagId)
  const [activeShape, setActiveShape] = useState(null)
  const [calibrating, setCalibrating] = useState(false)
  const [calibratePoints, setCalibratePoints] = useState([])
  const [actionError, setActionError] = useState(null)
  const [toast, setToast] = useState(null)
  const [strip, setStrip] = useState(null) // the page's saved strip points, or null
  const [stripShown, setStripShown] = useState(true)
  const [drawingStrip, setDrawingStrip] = useState(false)
  const [stripPoints, setStripPoints] = useState([])
  const [stripBusy, setStripBusy] = useState(false)
  const [clearing, setClearing] = useState(null) // {error} while the clear is being confirmed

  // The page's strip, off its title block (none when it has no title block, or it can't be read)
  useEffect(() => {
    let ignore = false
    setStrip(null)
    setDrawingStrip(false)
    setStripPoints([])
    getPageTitleBlock(page.pir_page_id)
      .then(block => { if (!ignore) setStrip(block?.sidewalk_strip_points ?? null) })
      .catch(() => { if (!ignore) setStrip(null) })
    return () => { ignore = true }
  }, [page.pir_page_id])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setLoadError(null)
    Promise.all([listFlags(pir.id), getContractItems(pir.project_id), listPirFeatures(pir.id), listPirSegments(pir.id)])
      .then(async ([foundFlags, foundItems, foundFeatures, foundSegments]) => {
        // There is no list of areas per PIR: ask each flag that has some
        const withAreas = foundFlags.filter(flag => flag.non_assessable_areas_count > 0)
        const foundAreas = (await Promise.all(withAreas.map(flag => listFlagNonAssessableAreas(flag.id)))).flat()
        if (ignore) return
        setFlags(foundFlags)
        setContractItems(foundItems)
        setFeatures(foundFeatures)
        setSegments(foundSegments)
        setAreas(foundAreas)
      })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [pir.id, pir.project_id, attempt])

  const scaled = page.scale_px_per_ft != null
  const canDraw = writer && scaled
  const pageFlags = flags.filter(flag => flag.pir_page_id === page.pir_page_id)
  const onPage = (item) => item.pir_page_id === page.pir_page_id
  const selected = pageFlags.find(flag => flag.id === selectedId) ?? null
  const canDrawStrip = stripWriter && scaled
  const wouldFlip = drawingStrip && stripPoints.length >= 3 ? flagsToFlip(stripPoints, pageFlags, page.scale_px_per_ft) : []

  const stopCalibrating = () => {
    setCalibrating(false)
    setCalibratePoints([])
  }

  const replaceFlag = (saved) => setFlags(current => current.map(flag => (flag.id === saved.id ? saved : flag)))

  const startStrip = () => {
    stopCalibrating()
    setActiveShape(null)
    setActionError(null)
    setStripPoints([])
    setDrawingStrip(true)
  }

  const cancelStrip = () => {
    setDrawingStrip(false)
    setStripPoints([])
  }

  // A click close to the last point (a double-click's second click) adds nothing
  const addStripPoint = (point) => setStripPoints(current => {
    const last = current[current.length - 1]
    return last && Math.hypot(point.x - last.x, point.y - last.y) < SAME_POINT_PX ? current : [...current, point]
  })

  const finishStrip = async () => {
    if (!drawingStrip || stripBusy) return
    const points = stripPoints.map(({ x, y }) => ({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }))
    const problem = stripProblem(points)
    if (problem) {
      setActionError(problem)
      return
    }
    setStripBusy(true)
    setActionError(null)
    try {
      const { data } = await putSidewalkStrip(page.pir_page_id, points)
      const marked = new Set(data.flipped.map(flag => flag.id))
      setFlags(current => current.map(flag => (marked.has(flag.id)
        ? { ...flag, surveyed_is_assessable: false, surveyed_non_assessable_reason: 'outside_property_line' }
        : flag)))
      setStrip(data.points)
      setStripShown(true)
      cancelStrip()
      setToast(stripSavedText(data.flipped.length, data.outside_claimed.length))
    } catch (err) {
      setActionError(`Couldn't save the sidewalk strip: ${err.message}`)
    } finally {
      setStripBusy(false)
    }
  }

  const clearStrip = async () => {
    setStripBusy(true)
    try {
      await putSidewalkStrip(page.pir_page_id, null)
    } catch (err) {
      setClearing({ error: err.message })
      setStripBusy(false)
      return
    }
    const left = pageFlags.filter(flag => flag.surveyed_non_assessable_reason === 'outside_property_line').length
    setStrip(null)
    setClearing(null)
    setStripBusy(false)
    setToast(left > 0
      ? `Sidewalk strip cleared. ${left} flag${left === 1 ? '' : 's'} it marked stay${left === 1 ? 's' : ''} non-assessable: open the flag editor to revert each.`
      : 'Sidewalk strip cleared.')
  }

  const place = async (point) => {
    if (!canDraw || !activeShape) return
    setActionError(null)
    try {
      const created = await createFlagOnPage(page.pir_page_id, newFlagValues(activeShape, point, flags))
      setFlags(current => [...current, created])
      setSelectedId(created.id)
    } catch (err) {
      setActionError(`Couldn't add the flag: ${err.message}`)
    }
  }

  const move = async (id, at) => {
    const before = flags.find(flag => flag.id === id)
    setActionError(null)
    replaceFlag({ ...before, sketch_x: at.x, sketch_y: at.y })
    try {
      replaceFlag(await updateFlag(id, { sketch_x: at.x, sketch_y: at.y }))
    } catch (err) {
      replaceFlag(before)
      setActionError(`Couldn't move flag #${before.display_order}: ${err.message}`)
    }
  }

  const remove = async (flag) => {
    setActionError(null)
    try {
      await deleteFlag(flag.id)
    } catch (err) {
      setActionError(`Couldn't delete flag #${flag.display_order}: ${err.message}`)
      return
    }
    setFlags(current => current.filter(found => found.id !== flag.id))
    setSelectedId(current => (current === flag.id ? null : current))
    setToast(`Flag #${flag.display_order} deleted.`)
  }

  // Esc leaves calibration, else disarms the shape; Delete removes the selected flag
  useEffect(() => {
    const onKeyDown = (e) => {
      if (typingIn(e)) return
      if (drawingStrip && (e.key === 'Escape' || e.key === 'Enter')) {
        e.preventDefault()
        if (e.key === 'Escape') cancelStrip()
        else finishStrip()
        return
      }
      if (e.key === 'Escape') {
        if (calibrating) stopCalibrating()
        else setActiveShape(null)
      } else if (e.key === 'Delete' && writer && selected && !calibrating && !document.querySelector('[role="dialog"]')) {
        e.preventDefault()
        remove(selected)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  const pick = (flag, pageNumber) => {
    if (pageNumber) onJump(pageNumber)
    setSelectedId(flag.id)
  }

  return (
    <>
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <ShapeToolbar
          activeShape={activeShape}
          onPick={(shape) => { stopCalibrating(); cancelStrip(); setActiveShape(shape) }}
          disabled={!canDraw || calibrating || drawingStrip}
          disabledReason={writer && !scaled ? NO_SCALE_REASON : null}
        />
        <div className="flex items-center gap-2">
          <CalibrateControl
            page={page}
            active={calibrating}
            points={calibratePoints}
            disabled={!writer || drawingStrip}
            onToggle={() => {
              if (calibrating) stopCalibrating()
              else {
                setActiveShape(null)
                setCalibrating(true)
              }
            }}
            onCancel={stopCalibrating}
            onDone={(saved) => {
              stopCalibrating()
              onPageSaved(saved)
            }}
          />
        </div>
        <StripControl
          strip={strip}
          drawing={drawingStrip}
          points={stripPoints}
          wouldFlip={wouldFlip.length}
          frontageFt={strip ? stripFrontageFt(strip, page.scale_px_per_ft) : null}
          canDraw={canDrawStrip}
          disabledReason={!stripWriter ? STRIP_NO_ROLE : STRIP_NO_SCALE}
          busy={stripBusy}
          shown={stripShown}
          onStart={startStrip}
          onFinish={finishStrip}
          onCancel={cancelStrip}
          onClear={() => setClearing({ error: null })}
          onToggleShown={() => setStripShown(shown => !shown)}
        />
        <ComingButton icon={Sparkles} label="Auto-detect with AI" tooltip={AI_DETECT_TOOLTIP} />
      </div>

      {actionError && <p role="alert" className="text-sm text-red-600 mb-4">{actionError}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6">
        <SketchCanvas
          page={page}
          flags={pageFlags}
          areas={areas}
          features={features.filter(onPage)}
          segments={segments.filter(onPage)}
          selectedId={selected?.id ?? null}
          activeShape={canDraw ? activeShape : null}
          calibrating={calibrating}
          calibratePoints={calibratePoints}
          writer={writer}
          onPlace={place}
          onSelect={setSelectedId}
          onMove={move}
          onCalibratePoint={(point) => setCalibratePoints(current => (current.length < 2 ? [...current, point] : current))}
          strip={strip}
          stripShown={stripShown}
          drawingStrip={drawingStrip}
          stripPoints={stripPoints}
          tintedIds={wouldFlip.map(flag => flag.id)}
          onStripPoint={addStripPoint}
          onStripFinish={finishStrip}
          onOpenIdr={onOpenIdr}
          onImageError={onImageError}
        />
        <div className="rounded-lg border border-gray-200 p-4 self-start">
          {loading ? (
            <div className="flex justify-center py-6">
              <div role="status" aria-label="Loading flags" className="animate-spin rounded-full h-8 w-8 border-b-2 border-construction-600"></div>
            </div>
          ) : loadError ? (
            <div className="text-center">
              <p className="text-red-600 mb-4">Couldn't load the flags: {loadError}</p>
              <button type="button" onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
            </div>
          ) : selected ? (
            <FlagPanel
              key={selected.id}
              flag={selected}
              contractItems={contractItems}
              writer={writer}
              onSaved={replaceFlag}
              onDelete={remove}
              onOpenIdr={onOpenIdr}
            />
          ) : (
            <p className="text-sm text-gray-600">{writer ? PANEL_EMPTY_WRITER_TEXT : PANEL_EMPTY_TEXT}</p>
          )}
        </div>
      </div>

      {!loading && !loadError && (
        <>
          <FlagsFallbackList flags={flags} pages={pages} contractItems={contractItems} selectedId={selected?.id ?? null} onPick={pick} />
          <SegmentsTable segments={segments} pages={pages} contractItems={contractItems} writer={writer}
            onSaved={saved => setSegments(current => current.map(s => (s.segment_id === saved.segment_id ? saved : s)))} />
        </>
      )}

      {clearing && (
        <ConfirmDialog
          title={STRIP_CLEAR_TITLE}
          message={STRIP_CLEAR_MESSAGE}
          confirmLabel="Clear strip"
          cancelLabel="Keep it"
          onConfirm={clearStrip}
          onCancel={() => setClearing(null)}
          busy={stripBusy}
          error={clearing.error}
        />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  )
}
