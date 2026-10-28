import { useCallback, useEffect, useRef, useState } from 'react'
import { Combine, RotateCw, Ruler, Sparkles } from 'lucide-react'
import {
  createFlagOnPage, createSegment, deleteFlag, getContractItems, getPageTitleBlock, listFlagNonAssessableAreas, listFlags,
  listPirFeatures, listPirMatchLines, listPirSegments, putSidewalkStrip, updateFlag,
} from '../../services/api'
import { newFlagValues } from '../../lib/flags'
import { bundleNumbers } from '../../lib/bundleGeometry'
import { matchLineCaption, partnerOf } from '../../lib/matchLines'
import { centreOf, scrollWindowTo, topOf } from '../../lib/pageScroll'
import { scaleText } from '../../lib/pirs'
import { isLinearFoot, mostUsedLfItem } from '../../lib/segmentItems'
import { flagsToFlip, stripFrontageFt, stripProblem } from '../../lib/stripGeometry'
import ConfirmDialog from '../ConfirmDialog'
import BundleModal from './BundleModal'
import BundlePanel from './BundlePanel'
import CalibrateControl from './CalibrateControl'
import CurbControl, { CURB_NO_ROLE, CURB_NO_SCALE } from './CurbControl'
import FlagPanel from './FlagPanel'
import FlagsFallbackList from './FlagsFallbackList'
import SegmentsTable from './SegmentsTable'
import SegmentPanel from './SegmentPanel'
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
// After a scroll the workspace makes, how long the page it went to stands before the observer may report another (ms)
const SETTLE_MS = 250
// The bundle button's reasons for being disabled (Slice Y4a)
export const BUNDLE_NO_ROLE = 'Only an OE, an RE or an admin bundles flags.'
export const BUNDLE_SELECT = 'Ctrl- or Cmd-click two or more flags to bundle them.'
export const BUNDLE_LINE_READER = 'Bundled with other flags into one measurement.'
export const BUNDLE_CROSS_PAGE = 'The flags are on more than one page'

// Adds a point unless it is on the last (a double-click's second click)
const withPoint = (current, point) => {
  const last = current[current.length - 1]
  return last && Math.hypot(point.x - last.x, point.y - last.y) < SAME_POINT_PX ? current : [...current, point]
}

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
 * The sketch workspace of a PIR (Slice Y4b: every page in one scroll). A sticky toolbar (shapes, the curb tool, Bundle
 * flags) over the pages stacked top to bottom, each with a static header bar of its own (its number and scale, Rotate,
 * Set scale, Calibrate and its sidewalk strip) above its sketch (SketchCanvas); beside them a sticky panel (the selected
 * flag's FlagPanel, a bundle's or a curb's); every flag of the PIR in a read-only list below (FlagsFallbackList), then
 * its curb segments (SegmentsTable). Reads the PIR's flags, contract items, features, segments, match lines and each
 * page's title block (for its strip) when it mounts (render it with a key that changes when the pages are replaced).
 * A writer places a flag by arming a shape and clicking a scaled page (the defaults of lib/flags.js `newFlagValues`,
 * then it is selected; the shape stays armed until Esc or its button), drags a selected flag to move it (saved on
 * release; a refusal puts it back), deletes the selected flag with the Delete key or the panel's button, and
 * calibrates a page's scale from its header. A reader (a demo user, or anyone but an admin on a deleted site) gets the
 * same views with the toolbar, the headers' writes and the panel disabled. Clicking a list row scrolls to its page and
 * selects the flag. Features, non-assessable areas and segments are drawn on their pages. "Auto-detect with AI" is a
 * disabled stub whose tooltip says when it comes. A flag an approved IDR claimed carries an "IDR #042" badge on the
 * page and a line in its panel; either opens that IDR (onOpenIdr).
 * A page's sidewalk strip (Slice Y1.5; StripControl in its header): read off its title block, drawn red with its
 * property line heavier, shown or hidden. A strip writer (an OE or RE on the project, or an admin) draws it on a
 * scaled page: clicks add points (the property line first), Enter, a double-click or Finish saves it
 * (putSidewalkStrip), Esc or Cancel drops it; while drawing, the flags it would mark non-assessable are tinted red
 * (lib/stripGeometry.js, the backend's own test). The save's toast says how many flags were marked and how many
 * claimed ones were left. Clear asks first and warns that marked flags stay so. One page is drawn on at a time.
 * Bundles (Slice Y4a): Ctrl- or Cmd-click adds flags to the selection; "Bundle flags" (an OE, an RE or an admin, two
 * or more selected, all on one page) opens BundleModal for the outline measured. Bundles are drawn with their members
 * outlined in violet and an "M1" label (numbered per PIR by lowest flag number); the label, or "Open bundle" on a
 * bundled flag's panel, opens BundlePanel. Anyone else sees "Bundled" on a bundled flag. The PIR's flags are read again
 * after a bundle is formed, changed or broken up.
 * Curbs (Slice Y4a; CurbControl): a writer picks the type and pay item and draws a curb on one page as the strip is
 * drawn (its first click picks the page), saved on Finish, Enter or a double-click (createSegment). Clicking a curb
 * opens SegmentPanel.
 * Scrolling (Slice Y4b): the page in view (the one across a line a third of the way down the window) is reported to
 * onPageVisible, for the URL's ?page= (not while a scroll this makes is under way). On mount it scrolls to initialFlagId's page, else to
 * initialPageNumber. [ and ] scroll to the page before or after the one in view, 1-9 to that page (not while typing or
 * with a dialog open). Match lines (R1h.1a's) are drawn on their pages with MATCH LINE "A" — SEE PAGE 2; clicking a
 * caption eases the window (300 ms) to centre its partner line, whose caption lights up for a moment.
 * Props: pir (id, project_id), pages, writer, stripWriter, bundleWriter (an OE, an RE or an admin: bundles),
 * onPageSaved(page) (a scale calibrated), onRotate(page), onSetScale(page), pageBusy (a page action under way),
 * onImageError, initialFlagId (?flag=), initialPageNumber (?page=), onPageVisible(pageNumber), onOpenIdr(flag).
 */
export default function SketchWorkspace({
  pir, pages, writer, stripWriter = false, bundleWriter = false, onPageSaved, onRotate, onSetScale, pageBusy = false,
  onImageError, initialFlagId = null, initialPageNumber = 1, onPageVisible, onOpenIdr,
}) {
  const [flags, setFlags] = useState([])
  const [areas, setAreas] = useState([])
  const [features, setFeatures] = useState([])
  const [segments, setSegments] = useState([])
  const [matchLines, setMatchLines] = useState([])
  const [contractItems, setContractItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to retry

  const [selectedIds, setSelectedIds] = useState(initialFlagId ? [initialFlagId] : [])
  const [selectedBundle, setSelectedBundle] = useState(null)
  const [selectedSegment, setSelectedSegment] = useState(null)
  const [bundling, setBundling] = useState(false)
  const [drawingCurb, setDrawingCurb] = useState(false)
  const [curbPage, setCurbPage] = useState(null) // the page a curb is being drawn on (its first click's)
  const [curbPoints, setCurbPoints] = useState([])
  const [curbBusy, setCurbBusy] = useState(false)
  const [curbType, setCurbType] = useState('curb_concrete')
  const [curbPayItem, setCurbPayItem] = useState(undefined) // undefined until the PIR's curbs are read
  const [activeShape, setActiveShape] = useState(null)
  const [calibratingPage, setCalibratingPage] = useState(null)
  const [calibratePoints, setCalibratePoints] = useState([])
  const [actionError, setActionError] = useState(null)
  const [toast, setToast] = useState(null)
  const [strips, setStrips] = useState({}) // each page's saved strip points (null for none), by page id
  const [hiddenStrips, setHiddenStrips] = useState([]) // pages whose strip is hidden
  const [stripPage, setStripPage] = useState(null) // the page a strip is being drawn on
  const [stripPoints, setStripPoints] = useState([])
  const [stripBusy, setStripBusy] = useState(false)
  const [clearing, setClearing] = useState(null) // {pageId, error} while a clear is being confirmed
  const [highlightedLine, setHighlightedLine] = useState(null)

  const blocks = useRef({}) // each page's block, by page number
  const toolbarRef = useRef(null)
  const scrolling = useRef(false) // a scroll this makes is under way: the URL waits for it
  const shown = useRef(null) // the page last reported in view
  const landed = useRef(false) // the deep link has been followed

  // Each page's strip, off its title block (none when it has no title block, or it can't be read)
  const pageIds = pages.map(page => page.pir_page_id).join()
  useEffect(() => {
    let ignore = false
    Promise.all(pages.map(page => getPageTitleBlock(page.pir_page_id)
      .then(block => [page.pir_page_id, block?.sidewalk_strip_points ?? null])
      .catch(() => [page.pir_page_id, null])))
      .then(found => { if (!ignore) setStrips(Object.fromEntries(found)) })
    return () => { ignore = true }
  }, [pageIds]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setLoadError(null)
    Promise.all([listFlags(pir.id), getContractItems(pir.project_id), listPirFeatures(pir.id), listPirSegments(pir.id),
      listPirMatchLines(pir.id).catch(() => [])])
      .then(async ([foundFlags, foundItems, foundFeatures, foundSegments, foundLines]) => {
        // There is no list of areas per PIR: ask each flag that has some
        const withAreas = foundFlags.filter(flag => flag.non_assessable_areas_count > 0)
        const foundAreas = (await Promise.all(withAreas.map(flag => listFlagNonAssessableAreas(flag.id)))).flat()
        if (ignore) return
        setFlags(foundFlags)
        setContractItems(foundItems)
        setFeatures(foundFeatures)
        setSegments(foundSegments)
        setMatchLines(foundLines ?? [])
        setAreas(foundAreas)
        setCurbPayItem(current => (current === undefined
          ? mostUsedLfItem(foundItems.filter(isLinearFoot), foundSegments) : current))
      })
      .catch(err => { if (!ignore) setLoadError(err.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [pir.id, pir.project_id, attempt])

  const pageOf = (id) => pages.find(page => page.pir_page_id === id) ?? null
  const scaledPages = pages.filter(page => page.scale_px_per_ft != null)
  const canDraw = writer && scaledPages.length > 0
  // One flag selected: its panel; several: the bundle button (all on one page)
  const selectedFlags = flags.filter(flag => selectedIds.includes(flag.id))
  const selected = selectedFlags.length === 1 ? selectedFlags[0] : null
  const onePage = new Set(selectedFlags.map(flag => flag.pir_page_id)).size <= 1
  const canBundle = selectedFlags.length >= 2 && onePage
  const numbers = bundleNumbers(flags)
  const lfItems = contractItems.filter(isLinearFoot)
  const canDrawCurb = writer && scaledPages.length > 0
  const pickedSegment = segments.find(segment => segment.segment_id === selectedSegment) ?? null
  const drawingStrip = stripPage !== null
  const calibrating = calibratingPage !== null
  const stripOn = pageOf(stripPage)
  const wouldFlip = drawingStrip && stripPoints.length >= 3
    ? flagsToFlip(stripPoints, flags.filter(flag => flag.pir_page_id === stripPage), stripOn?.scale_px_per_ft) : []

  const setSelectedId = (id) => {
    setSelectedIds(id ? [id] : [])
    setSelectedBundle(null)
    setSelectedSegment(null)
  }
  const toggleSelected = (id) => {
    setSelectedIds(current => (current.includes(id) ? current.filter(found => found !== id) : [...current, id]))
    setSelectedBundle(null)
    setSelectedSegment(null)
  }
  const openBundle = (id) => {
    setSelectedIds([])
    setSelectedSegment(null)
    setSelectedBundle(id)
  }
  const openSegment = (id) => {
    setSelectedIds([])
    setSelectedBundle(null)
    setSelectedSegment(id)
  }
  // The PIR's flags again, quietly: a bundle formed, changed or broken up changes their measurement and quantities
  const refreshFlags = async () => {
    try {
      setFlags(await listFlags(pir.id))
    } catch (err) {
      setActionError(`Couldn't read the flags again: ${err.message}`)
    }
  }

  // Scrolling: to a page's top, under the sticky toolbar; the URL waits until it is there, and the page it was sent to
  // stands a moment (SETTLE_MS) against the observer's last reports of the scroll
  const scrollTo = useCallback(async (top, { smooth, pageNumber }) => {
    scrolling.current = true
    await scrollWindowTo(top, { smooth })
    if (pageNumber && pageNumber !== shown.current) {
      shown.current = pageNumber
      onPageVisible?.(pageNumber)
    }
    window.setTimeout(() => { scrolling.current = false }, SETTLE_MS)
  }, [onPageVisible])
  const scrollToPage = useCallback((pageNumber, smooth = true) => {
    const block = blocks.current[pageNumber]
    if (!block) return
    scrollTo(topOf(block, (toolbarRef.current?.offsetHeight ?? 0) + 8), { smooth, pageNumber })
  }, [scrollTo])

  // The page in view: the one across a line a third of the way down the window (a thin band; between pages, none, and
  // the last one stands; above the first page, the first)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined
    const inView = new Set()
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const number = Number(entry.target.dataset.pageNumber)
        if (entry.isIntersecting) inView.add(number)
        else inView.delete(number)
      }
      if (scrolling.current || !landed.current) return // nothing reported before the deep link is followed
      const firstTop = blocks.current[1]?.getBoundingClientRect().top
      if (inView.size === 0 && !(firstTop > window.innerHeight / 3)) return
      const first = inView.size === 0 ? 1 : Math.min(...inView)
      if (first !== shown.current) {
        shown.current = first
        onPageVisible?.(first)
      }
    }, { rootMargin: '-33% 0px -66% 0px' })
    Object.values(blocks.current).forEach(block => block && observer.observe(block))
    return () => observer.disconnect()
  }, [loading, pageIds, onPageVisible]) // eslint-disable-line react-hooks/exhaustive-deps

  // On mount, once the flags are read: to ?flag='s page, else to ?page=
  useEffect(() => {
    if (loading || landed.current) return
    landed.current = true
    const flagPage = initialFlagId ? pageOf(flags.find(flag => flag.id === initialFlagId)?.pir_page_id) : null
    const target = flagPage?.page_number ?? initialPageNumber
    // A page past the first is reported once it is reached, so a ?page= out of range is put right in the URL
    if (target > 1) scrollToPage(target, false)
    else shown.current = target
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // A match line's caption: to its partner line, centred; the partner's caption lights up a moment
  const goToPartner = (line, partner) => {
    const target = document.querySelector(`[data-match-line-id="${partner.match_line_id}"] line`)
    if (!target) return
    scrollTo(centreOf(target), { smooth: true, pageNumber: partner.page_number })
    setHighlightedLine(partner.match_line_id)
    window.setTimeout(() => setHighlightedLine(current => (current === partner.match_line_id ? null : current)), 1500)
  }

  const stopCalibrating = () => {
    setCalibratingPage(null)
    setCalibratePoints([])
  }
  const cancelCurb = () => {
    setDrawingCurb(false)
    setCurbPage(null)
    setCurbPoints([])
  }
  const cancelStrip = () => {
    setStripPage(null)
    setStripPoints([])
  }

  const addCurbPoint = (page, point) => {
    if (curbPage && curbPage !== page.pir_page_id) {
      setActionError('A curb is drawn on one page: finish this one first.')
      return
    }
    if (page.scale_px_per_ft == null) {
      setActionError(`Set the scale of page ${page.page_number} to draw curbs on it.`)
      return
    }
    setCurbPage(page.pir_page_id)
    setCurbPoints(current => withPoint(current, point))
  }

  const finishCurb = async () => {
    if (!drawingCurb || curbBusy) return
    if (curbPoints.length < 2 || !curbPage) {
      setActionError('A curb takes two points or more.')
      return
    }
    setCurbBusy(true)
    setActionError(null)
    try {
      const points = curbPoints.map(({ x, y }) => ({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }))
      const created = await createSegment(curbPage, { segment_type: curbType, points, pay_item_id: curbPayItem ?? null })
      setSegments(current => [...current, created])
      cancelCurb()
      openSegment(created.segment_id)
      setToast('Curb drawn.')
    } catch (err) {
      setActionError(`Couldn't save the curb: ${err.message}`)
    } finally {
      setCurbBusy(false)
    }
  }

  const replaceFlag = (saved) => setFlags(current => current.map(flag => (flag.id === saved.id ? saved : flag)))

  const startStrip = (page) => {
    stopCalibrating()
    cancelCurb()
    setActiveShape(null)
    setActionError(null)
    setStripPoints([])
    setStripPage(page.pir_page_id)
  }

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
      const pageId = stripPage
      const { data } = await putSidewalkStrip(pageId, points)
      const marked = new Set(data.flipped.map(flag => flag.id))
      setFlags(current => current.map(flag => (marked.has(flag.id)
        ? { ...flag, surveyed_is_assessable: false, surveyed_non_assessable_reason: 'outside_property_line' }
        : flag)))
      setStrips(current => ({ ...current, [pageId]: data.points }))
      setHiddenStrips(current => current.filter(id => id !== pageId))
      cancelStrip()
      setToast(stripSavedText(data.flipped.length, data.outside_claimed.length))
    } catch (err) {
      setActionError(`Couldn't save the sidewalk strip: ${err.message}`)
    } finally {
      setStripBusy(false)
    }
  }

  const clearStrip = async () => {
    const { pageId } = clearing
    setStripBusy(true)
    try {
      await putSidewalkStrip(pageId, null)
    } catch (err) {
      setClearing({ pageId, error: err.message })
      setStripBusy(false)
      return
    }
    const left = flags.filter(flag => flag.pir_page_id === pageId
      && flag.surveyed_non_assessable_reason === 'outside_property_line').length
    setStrips(current => ({ ...current, [pageId]: null }))
    setClearing(null)
    setStripBusy(false)
    setToast(left > 0
      ? `Sidewalk strip cleared. ${left} flag${left === 1 ? '' : 's'} it marked stay${left === 1 ? 's' : ''} non-assessable: open the flag editor to revert each.`
      : 'Sidewalk strip cleared.')
  }

  const place = async (page, point) => {
    if (!canDraw || !activeShape) return
    if (page.scale_px_per_ft == null) {
      setActionError(`Page ${page.page_number}: ${NO_SCALE_REASON}`)
      return
    }
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
    setSelectedIds(current => current.filter(id => id !== flag.id))
    setToast(`Flag #${flag.display_order} deleted.`)
  }

  // Esc leaves a drawing mode or disarms the shape; Enter finishes a strip or a curb; Delete removes the selected flag;
  // [ ] and 1-9 scroll between pages
  useEffect(() => {
    const onKeyDown = (e) => {
      if (typingIn(e)) return
      const dialogOpen = Boolean(document.querySelector('[role="dialog"]'))
      if (drawingStrip && (e.key === 'Escape' || e.key === 'Enter')) {
        e.preventDefault()
        if (e.key === 'Escape') cancelStrip()
        else finishStrip()
        return
      }
      if (drawingCurb && (e.key === 'Escape' || e.key === 'Enter')) {
        e.preventDefault()
        if (e.key === 'Escape') cancelCurb()
        else finishCurb()
        return
      }
      if (e.key === 'Escape') {
        if (calibrating) stopCalibrating()
        else setActiveShape(null)
      } else if (e.key === 'Delete' && writer && selected && !calibrating && !dialogOpen) {
        e.preventDefault()
        remove(selected)
      } else if (!dialogOpen && pages.length > 0) {
        const current = shown.current ?? 1
        if (e.key === '[' && current > 1) scrollToPage(current - 1)
        else if (e.key === ']' && current < pages.length) scrollToPage(current + 1)
        else if (/^[1-9]$/.test(e.key) && Number(e.key) <= pages.length) scrollToPage(Number(e.key))
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  const pick = (flag, pageNumber) => {
    if (pageNumber) scrollToPage(pageNumber)
    setSelectedId(flag.id)
  }

  const linesOn = (page) => matchLines
    .filter(line => line.pir_page_id === page.pir_page_id)
    .map(line => {
      const partner = partnerOf(line, matchLines)
      return { line, partner, caption: matchLineCaption(line, partner) }
    })

  const bundleReason = !canBundle ? (selectedFlags.length < 2 ? BUNDLE_SELECT : BUNDLE_CROSS_PAGE) : undefined
  const anyMode = calibrating || drawingStrip || drawingCurb

  return (
    <>
      <div ref={toolbarRef} data-testid="sketch-toolbar" style={{ scrollbarWidth: 'thin' }}
        className="sticky top-0 z-20 -mx-2 mb-4 flex flex-nowrap items-center gap-3 overflow-x-auto bg-white px-2 py-2 shadow-sm">
        <ShapeToolbar
          activeShape={activeShape}
          onPick={(shape) => { stopCalibrating(); cancelStrip(); cancelCurb(); setActiveShape(shape) }}
          disabled={!canDraw || anyMode}
          disabledReason={writer && scaledPages.length === 0 ? NO_SCALE_REASON : null}
        />
        <CurbControl
          drawing={drawingCurb}
          points={curbPoints}
          canDraw={canDrawCurb && !drawingStrip && !calibrating}
          disabledReason={!writer ? CURB_NO_ROLE : CURB_NO_SCALE}
          busy={curbBusy}
          type={curbType}
          onType={setCurbType}
          payItemId={curbPayItem ?? null}
          onPayItem={setCurbPayItem}
          lfItems={lfItems}
          onStart={() => { stopCalibrating(); cancelStrip(); setActiveShape(null); setActionError(null); setCurbPoints([]); setCurbPage(null); setDrawingCurb(true) }}
          onFinish={finishCurb}
          onCancel={cancelCurb}
        />
        {bundleWriter && (
          <span title={bundleReason} className="inline-flex shrink-0">
            <button type="button" onClick={() => setBundling(true)} disabled={!canBundle} title={bundleReason}
              className={TOOL_BUTTON}>
              <Combine className="h-4 w-4 text-violet-600" />
              <span className="whitespace-nowrap">Bundle flags{selectedFlags.length >= 2 ? ` (${selectedFlags.length})` : ''}</span>
            </button>
          </span>
        )}
        <ComingButton icon={Sparkles} label="Auto-detect with AI" tooltip={AI_DETECT_TOOLTIP} />
      </div>

      {actionError && <p role="alert" className="text-sm text-red-600 mb-4">{actionError}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6">
        <div data-testid="page-stack" className="space-y-8">
          {pages.map(page => {
            const pageId = page.pir_page_id
            const onIt = (item) => item.pir_page_id === pageId
            const pageFlags = flags.filter(onIt)
            const strip = strips[pageId] ?? null
            const stripHere = stripPage === pageId
            const calibratingHere = calibratingPage === pageId
            const scaled = page.scale_px_per_ft != null
            return (
              <section key={pageId} ref={element => { blocks.current[page.page_number] = element }}
                data-page-number={page.page_number} aria-label={`Page ${page.page_number}`} className="scroll-mt-24">
                <div data-testid={`page-header-${page.page_number}`}
                  className="mb-2 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">Page {page.page_number} of {pages.length}</span>
                  <span className="text-sm text-gray-500">Scale: {scaleText(page.scale_px_per_ft)}</span>
                  <span className="flex-1" />
                  <button type="button" onClick={() => onRotate?.(page)} disabled={pageBusy || !writer}
                    aria-label={`Rotate page ${page.page_number}`} className={TOOL_BUTTON}>
                    <RotateCw className="h-4 w-4" /><span>Rotate</span>
                  </button>
                  <button type="button" onClick={() => onSetScale?.(page)} disabled={pageBusy || !writer}
                    aria-label={`Set the scale of page ${page.page_number}`} className={TOOL_BUTTON}>
                    <Ruler className="h-4 w-4" /><span>Set scale</span>
                  </button>
                  <CalibrateControl
                    page={page}
                    active={calibratingHere}
                    points={calibratingHere ? calibratePoints : []}
                    disabled={!writer || drawingStrip || drawingCurb || (calibrating && !calibratingHere)}
                    onToggle={() => {
                      if (calibratingHere) stopCalibrating()
                      else {
                        setActiveShape(null)
                        cancelStrip()
                        cancelCurb()
                        setCalibratePoints([])
                        setCalibratingPage(pageId)
                      }
                    }}
                    onCancel={stopCalibrating}
                    onDone={(saved) => {
                      stopCalibrating()
                      onPageSaved(saved)
                    }}
                  />
                  <StripControl
                    strip={strip}
                    drawing={stripHere}
                    points={stripHere ? stripPoints : []}
                    wouldFlip={stripHere ? wouldFlip.length : 0}
                    frontageFt={strip ? stripFrontageFt(strip, page.scale_px_per_ft) : null}
                    canDraw={stripWriter && scaled && !(anyMode && !stripHere)}
                    disabledReason={!stripWriter ? STRIP_NO_ROLE : STRIP_NO_SCALE}
                    busy={stripBusy}
                    shown={!hiddenStrips.includes(pageId)}
                    onStart={() => startStrip(page)}
                    onFinish={finishStrip}
                    onCancel={cancelStrip}
                    onClear={() => setClearing({ pageId, error: null })}
                    onToggleShown={() => setHiddenStrips(current => (current.includes(pageId)
                      ? current.filter(id => id !== pageId) : [...current, pageId]))}
                  />
                </div>
                <SketchCanvas
                  page={page}
                  flags={pageFlags}
                  areas={areas}
                  features={features.filter(onIt)}
                  segments={segments.filter(onIt)}
                  selectedId={selected?.id ?? null}
                  selectedIds={selectedIds}
                  bundles={Object.entries(numbers).map(([id, number]) => ({
                    id, number, flagIds: pageFlags.filter(flag => flag.bundled && flag.measurement_id === id).map(flag => flag.id),
                  })).filter(bundle => bundle.flagIds.length > 0)}
                  selectedBundleId={selectedBundle}
                  selectedSegmentId={pickedSegment?.segment_id ?? null}
                  drawingCurb={drawingCurb && (curbPage === null || curbPage === pageId)}
                  curbPoints={curbPage === pageId ? curbPoints : []}
                  onCurbPoint={(point) => addCurbPoint(page, point)}
                  onCurbFinish={finishCurb}
                  onToggleSelect={toggleSelected}
                  onSelectBundle={bundleWriter ? openBundle : undefined}
                  onSelectSegment={openSegment}
                  activeShape={canDraw && scaled ? activeShape : null}
                  calibrating={calibratingHere}
                  calibratePoints={calibratingHere ? calibratePoints : []}
                  writer={writer}
                  onPlace={(point) => place(page, point)}
                  onSelect={setSelectedId}
                  onMove={move}
                  onCalibratePoint={(point) => setCalibratePoints(current => (current.length < 2 ? [...current, point] : current))}
                  strip={strip}
                  stripShown={!hiddenStrips.includes(pageId)}
                  drawingStrip={stripHere}
                  stripPoints={stripHere ? stripPoints : []}
                  tintedIds={stripHere ? wouldFlip.map(flag => flag.id) : []}
                  onStripPoint={(point) => setStripPoints(current => withPoint(current, point))}
                  onStripFinish={finishStrip}
                  matchLines={linesOn(page)}
                  highlightedLineId={highlightedLine}
                  onMatchLineClick={goToPartner}
                  onOpenIdr={onOpenIdr}
                  onImageError={onImageError}
                />
              </section>
            )
          })}
        </div>
        <div data-testid="sketch-panel"
          className="rounded-lg border border-gray-200 p-4 self-start bg-white lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-6">
              <div role="status" aria-label="Loading flags" className="animate-spin rounded-full h-8 w-8 border-b-2 border-construction-600"></div>
            </div>
          ) : loadError ? (
            <div className="text-center">
              <p className="text-red-600 mb-4">Couldn't load the flags: {loadError}</p>
              <button type="button" onClick={() => setAttempt(a => a + 1)} className="btn-primary">Retry</button>
            </div>
          ) : selectedBundle && bundleWriter ? (
            <BundlePanel
              key={selectedBundle}
              measurementId={selectedBundle}
              number={numbers[selectedBundle] ?? '?'}
              flags={flags}
              onChanged={() => { refreshFlags() }}
              onUnbundled={() => { setSelectedBundle(null); refreshFlags(); setToast('Bundle broken up: each flag measured on its own again.') }}
            />
          ) : pickedSegment ? (
            <SegmentPanel
              key={pickedSegment.segment_id}
              segment={pickedSegment}
              lfItems={lfItems}
              writer={writer}
              onSaved={saved => setSegments(current => current.map(s => (s.segment_id === saved.segment_id ? saved : s)))}
              onDeleted={gone => {
                setSegments(current => current.filter(s => s.segment_id !== gone.segment_id))
                setSelectedSegment(null)
                setToast('Curb deleted.')
              }}
            />
          ) : selected ? (
            <>
              {selected.bundled && (
                <p className="mb-3 rounded-md bg-violet-50 px-2 py-1.5 text-sm text-violet-800" data-testid="flag-bundle-line">
                  {bundleWriter ? (
                    <>
                      In bundle M{numbers[selected.measurement_id] ?? '?'}{' '}
                      <button type="button" onClick={() => openBundle(selected.measurement_id)}
                        className="font-medium underline">Open bundle</button>
                    </>
                  ) : BUNDLE_LINE_READER}
                </p>
              )}
              <FlagPanel
                key={selected.id}
                flag={selected}
                contractItems={contractItems}
                writer={writer}
                onSaved={replaceFlag}
                onDelete={remove}
                onOpenIdr={onOpenIdr}
              />
            </>
          ) : selectedFlags.length >= 2 ? (
            <p className="text-sm text-gray-700" data-testid="multi-selection">
              {selectedFlags.length} flags selected ({selectedFlags.map(flag => `#${flag.display_order}`).join(', ')}).
              {bundleWriter ? (onePage ? ' Bundle them from the toolbar.' : ` ${BUNDLE_CROSS_PAGE}.`) : ''}
            </p>
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

      {bundling && (
        <BundleModal
          page={pageOf(selectedFlags[0]?.pir_page_id) ?? pages[0]}
          flags={selectedFlags}
          onClose={() => setBundling(false)}
          onBundled={async (formed) => {
            setBundling(false)
            await refreshFlags()
            openBundle(formed.measurement_id)
            setToast(`Bundle formed: ${formed.members.length} flags.`)
          }}
        />
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
