import { useEffect, useId, useRef, useState } from 'react'
import RotatedPage from './RotatedPage'
import FeatureGlyph from './FeatureGlyph'
import SketchLegend from './SketchLegend'
import SketchPatterns, { FLAG_NUMBER_COLOR, NON_ASSESSABLE_INK, fillUrl } from './SketchPatterns'
import { boundsOf, centreOf, flagOutline, svgPoints } from '../../lib/flagGeometry'
import { flagFill, labelSize, labelledAreas, thicknessRuns } from '../../lib/flagGroups'
import { thicknessColor } from '../../lib/flags'
import { toNativeCoords } from '../../lib/pageGeometry'
import { areaReasonLabel, segmentTypeLabel } from '../../data/flagEnums'

// How far (page pixels) a pointer must travel on a selected flag before it counts as a drag rather than a click
const DRAG_THRESHOLD = 1

// How a curb run is stroked, by its segment type (screen pixels: the strokes don't scale with the page)
export const SEGMENT_STYLES = {
  curb_concrete: { stroke: '#374151', width: 2.5, dash: undefined },
  curb_concrete_depressed: { stroke: '#374151', width: 2.5, dash: '8 4' },
  curb_steel_faced: { stroke: '#1e3a8a', width: 3.5, dash: undefined },
  curb_steel_faced_corner: { stroke: '#1e3a8a', width: 3.5, dash: '12 3 2 3' },
  curb_granite: { stroke: '#78716c', width: 3.5, dash: '2 3' },
  other: { stroke: '#9ca3af', width: 2, dash: '4 4' },
}
const segmentStyle = (type) => SEGMENT_STYLES[type] ?? SEGMENT_STYLES.other

// The ink of the area outlines and their labels
const AREA_INK = '#a16207'
// The fill of the badge on a flag an approved IDR claimed (constructed)
const CLAIM_INK = '#047857'
// The sidewalk strip's ink (Slice Y1.5), and the tint of a flag the strip being drawn would mark non-assessable
export const STRIP_INK = '#dc2626'
// A bundle's ink (Slice Y4a): its members' shared outline and its M label
export const BUNDLE_INK = '#7c3aed'
// A selected curb run's halo, and a curb being drawn (Slice Y4a)
const SEGMENT_SELECTED_INK = '#f59e0b'
const CURB_DRAW_INK = '#374151'

/** What a claimed flag's badge reads: "IDR #042" (or "IDR" for one without a number). */
export const claimBadgeText = (flag) => (flag.claimed_by_idr_number ? `IDR #${flag.claimed_by_idr_number}` : 'IDR')

/**
 * One PIR page with its sketch: the page's image (RotatedPage) and an SVG overlay over it in the page's native
 * pixels (viewBox 0 0 width height), turned with it, so a flag's stored place (sketch_x / sketch_y) is right at every
 * rotation. Drawn as the DOT Construction Report draws it, bottom to top:
 * - segments (curb runs), each a polyline stroked by its type (SEGMENT_STYLES);
 * - flags: each its outline (lib/flagGeometry.js) stroked in its thickness's colour and filled by lib/flagGroups.js
 *   `flagFill` (light-blue stipple, white, tan hatch; SketchPatterns), with a cross when it isn't assessable; the
 *   selected one heavier and dashed;
 * - non-assessable areas, in yellow stripes, labelled A1, A2, ... at render time (`labelledAreas`);
 * - features, by their key symbols (FeatureGlyph);
 * - each flag's number in an orange circle at its top-left and its defect codes in its middle;
 * - "4\" Conc." / "7\" Conc." on each run of consecutive same-thickness flags (`thicknessRuns`);
 * - on a flag an approved IDR claimed (R1f), an "IDR #042" badge at its top-right, which opens that IDR (onOpenIdr).
 * Only the flags and the badges take clicks; the rest is drawing. A legend (SketchLegend) sits in the page's lower-left corner.
 * - A click on empty page: places the armed shape there (onPlace), else a calibration point while calibrating
 *   (onCalibratePoint), else clears the selection (onSelect(null)).
 * - A click on a flag selects it (while calibrating it is a calibration point instead), armed shape or not. For a
 *   writer, dragging an already selected flag moves it, even with a shape armed: the overlay alone follows the
 *   pointer, and letting go hands the new place to onMove; Esc while dragging puts it back.
 * - While calibrating, the points picked so far are marked and joined by a thin line.
 * - The page's sidewalk strip (Slice Y1.5), when shown: a red outline with a faint fill, its first edge (the property
 *   line) heavier. While drawing one (drawingStrip), a click anywhere, a flag included, adds a point (onStripPoint) and
 *   a double-click finishes it (onStripFinish); the points so far are joined by a dashed red line, on to the pointer,
 *   and the flags it would mark non-assessable (tintedIds) are tinted red.
 * - Bundles (Slice Y4a): each member's outline is stroked in violet over its own, and an "M1" label sits in the middle
 *   of the members' box; clicking the label opens the bundle (onSelectBundle).
 * - Ctrl- or Cmd-click on a flag adds it to the selection, or takes it out (onToggleSelect); a plain click selects it
 *   alone. Every flag in selectedIds is drawn selected; only a single selected flag (selectedId) is dragged.
 * - Curb runs take clicks (onSelectSegment) when nothing is being drawn; the selected one (selectedSegmentId) has an
 *   amber halo. While drawing a curb (drawingCurb), a click anywhere adds a point (onCurbPoint), a double-click
 *   finishes it (onCurbFinish), and the points so far are joined by a dashed line on to the pointer.
 * Pointer positions are turned into page pixels with toNativeCoords against the page's on-screen box.
 * Props: page, flags, areas, features and segments (this page's), selectedId, selectedIds, bundles ([{id, number,
 * flagIds}]), selectedBundleId, selectedSegmentId, drawingCurb, curbPoints, onCurbPoint, onCurbFinish,
 * onToggleSelect(id), onSelectBundle(id), onSelectSegment(id), activeShape, calibrating,
 * calibratePoints ([{x, y}]), writer, strip (the saved strip's points, or null), stripShown, drawingStrip,
 * stripPoints ([{x, y}]), tintedIds (flag ids), onStripPoint({x, y}), onStripFinish(),
 * onPlace({x, y}), onSelect(id or null), onMove(id, {x, y}), onCalibratePoint({x, y}), onOpenIdr(flag), onImageError, showCorners
 * (marks the overlay's corners (0, 0) and (width, height), to check its alignment by eye).
 */
export default function SketchCanvas({
  page, flags, areas = [], features = [], segments = [], selectedId = null, activeShape = null, calibrating = false, calibratePoints = [], writer = false,
  strip = null, stripShown = true, drawingStrip = false, stripPoints = [], tintedIds = [], onStripPoint, onStripFinish,
  onPlace, onSelect, onMove, onCalibratePoint, onOpenIdr, onImageError, showCorners = false,
  selectedIds = null, bundles = [], selectedBundleId = null, selectedSegmentId = null, drawingCurb = false, curbPoints = [],
  onCurbPoint, onCurbFinish, onToggleSelect, onSelectBundle, onSelectSegment,
}) {
  const boxRef = useRef(null)
  const [drag, setDrag] = useState(null) // {id, start, origin, at}: a selected flag being moved
  const [hover, setHover] = useState(null) // where the pointer is while drawing the strip
  const tinted = new Set(tintedIds)
  const chosen = new Set(selectedIds ?? (selectedId ? [selectedId] : []))
  const drawingLine = drawingStrip || drawingCurb
  const scale = page.scale_px_per_ft
  const patterns = `sketch-${useId().replace(/:/g, '')}`

  const native = (e) => toNativeCoords(e, boxRef.current.getBoundingClientRect(), page)

  // Esc puts a dragged flag back where it was
  useEffect(() => {
    if (!drag) return undefined
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setDrag(null)
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [drag])

  const pressPage = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    const point = native(e)
    if (drawingStrip) onStripPoint?.(point)
    else if (drawingCurb) onCurbPoint?.(point)
    else if (calibrating) onCalibratePoint?.(point)
    else if (activeShape) onPlace?.(point)
    else onSelect?.(null)
  }

  const pressFlag = (e, flag) => {
    if (calibrating || drawingLine) return // the page takes it as a calibration, strip or curb point
    e.stopPropagation()
    if (e.button !== undefined && e.button !== 0) return
    if ((e.ctrlKey || e.metaKey) && onToggleSelect) {
      onToggleSelect(flag.id)
      return
    }
    const wasSelected = flag.id === selectedId
    onSelect?.(flag.id)
    if (!writer || !wasSelected) return
    const start = native(e)
    const origin = { x: flag.sketch_x, y: flag.sketch_y }
    setDrag({ id: flag.id, start, origin, at: origin })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const movePointer = (e) => {
    if (drawingLine) setHover(native(e))
    if (!drag) return
    const point = native(e)
    setDrag(current => current && {
      ...current,
      at: { x: current.origin.x + point.x - current.start.x, y: current.origin.y + point.y - current.start.y },
    })
  }

  const release = () => {
    if (!drag) return
    const { id, origin, at } = drag
    setDrag(null)
    if (Math.hypot(at.x - origin.x, at.y - origin.y) >= DRAG_THRESHOLD) {
      onMove?.(id, { x: Math.round(at.x * 100) / 100, y: Math.round(at.y * 100) / 100 })
    }
  }

  const crosshair = activeShape || calibrating || drawingLine
  const text = labelSize(scale)
  // This page's flags as drawn: a dragged one at the pointer, and none that can't be drawn (no scale, no place)
  const drawn = flags
    .map(flag => {
      const moved = drag?.id === flag.id ? { ...flag, sketch_x: drag.at.x, sketch_y: drag.at.y } : flag
      return { flag: moved, outline: flagOutline(moved, scale) }
    })
    .filter(({ outline }) => outline.length > 0)
  const [first, second] = calibratePoints

  return (
    <RotatedPage ref={boxRef} page={page} onImageError={onImageError} frame={<SketchLegend />}>
      <svg
        data-testid="sketch-overlay"
        viewBox={`0 0 ${page.width_px} ${page.height_px}`}
        preserveAspectRatio="none"
        className={`absolute inset-0 h-full w-full touch-none ${crosshair ? 'cursor-crosshair' : ''}`}
        onPointerDown={pressPage}
        onPointerMove={movePointer}
        onPointerUp={release}
        onPointerCancel={() => setDrag(null)}
        onDoubleClick={() => {
          if (drawingStrip) onStripFinish?.()
          else if (drawingCurb) onCurbFinish?.()
        }}
      >
        <SketchPatterns prefix={patterns} unit={Math.max(4, (scale ?? 10) * 0.6)} />

        <g data-testid="segments" className={onSelectSegment && !drawingLine && !calibrating ? undefined : 'pointer-events-none'}>
          {segments.map(segment => {
            const style = segmentStyle(segment.segment_type)
            const picked = segment.segment_id === selectedSegmentId
            const line = (
              <polyline
                key={segment.segment_id}
                data-segment-type={segment.segment_type}
                points={svgPoints(segment.points)}
                fill="none"
                stroke={style.stroke}
                strokeWidth={style.width}
                strokeDasharray={style.dash}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              >
                <title>{segmentTypeLabel(segment.segment_type)}</title>
              </polyline>
            )
            // Without curb selection a run is drawn as it always was: one polyline
            if (!onSelectSegment) return line
            return (
              <g
                key={segment.segment_id}
                role="button"
                aria-label={`Curb: ${segmentTypeLabel(segment.segment_type)}`}
                aria-pressed={picked}
                data-segment-id={segment.segment_id}
                className="cursor-pointer"
                onPointerDown={(e) => {
                  if (drawingLine || calibrating) return
                  e.stopPropagation()
                  onSelectSegment(segment.segment_id)
                }}
              >
                {picked && (
                  <polyline points={svgPoints(segment.points)} fill="none" stroke={SEGMENT_SELECTED_INK} strokeOpacity="0.6"
                    strokeWidth={style.width + 6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                )}
                {line}
                <polyline points={svgPoints(segment.points)} fill="none" stroke="transparent" strokeWidth="12"
                  vectorEffect="non-scaling-stroke" />
              </g>
            )
          })}
        </g>

        {drawn.map(({ flag, outline }) => {
          const selected = chosen.has(flag.id)
          const color = thicknessColor(flag.surveyed_thickness)
          const box = boundsOf(outline)
          const centre = centreOf(outline)
          const arm = Math.min(box.maxX - box.minX, box.maxY - box.minY) * 0.3
          const fill = flagFill(flag)
          return (
            <g
              key={flag.id}
              role="button"
              aria-label={`Flag #${flag.display_order}`}
              aria-pressed={selected}
              data-flag-id={flag.id}
              data-fill={fill}
              data-would-flip={tinted.has(flag.id) || undefined}
              className={writer && selected && !calibrating ? 'cursor-move' : 'cursor-pointer'}
              onPointerDown={(e) => pressFlag(e, flag)}
            >
              <polygon
                points={svgPoints(outline)}
                fill={fillUrl(patterns, fill)}
                fillOpacity={selected ? 0.75 : 0.55}
                stroke={color}
                strokeWidth={selected ? 3 : 1.5}
                strokeDasharray={selected ? '6 3' : undefined}
                vectorEffect="non-scaling-stroke"
              />
              {tinted.has(flag.id) && (
                <polygon
                  points={svgPoints(outline)}
                  fill={STRIP_INK}
                  fillOpacity="0.35"
                  stroke={STRIP_INK}
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                  className="pointer-events-none"
                />
              )}
              {flag.surveyed_is_assessable === false && (
                <path
                  data-testid="non-assessable-cross"
                  d={`M${centre.x - arm} ${centre.y - arm} L${centre.x + arm} ${centre.y + arm} M${centre.x + arm} ${centre.y - arm} L${centre.x - arm} ${centre.y + arm}`}
                  stroke={NON_ASSESSABLE_INK}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  className="pointer-events-none"
                />
              )}
            </g>
          )
        })}

        <g data-testid="non-assessable-areas" className="pointer-events-none">
          {labelledAreas(areas, drawn.map(({ flag }) => flag)).map(({ area, label }) => {
            const outline = flagOutline(area, scale)
            if (outline.length === 0) return null
            const centre = centreOf(outline)
            return (
              <g key={area.non_assessable_area_id} data-area-label={label}>
                <title>{`${label}: ${areaReasonLabel(area.reason)}`}</title>
                <polygon
                  points={svgPoints(outline)}
                  fill={fillUrl(patterns, 'stripes')}
                  fillOpacity="0.8"
                  stroke={AREA_INK}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={centre.x}
                  y={centre.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={text * 0.8}
                  fontWeight="700"
                  fill={AREA_INK}
                  stroke="#ffffff"
                  strokeWidth={text / 8}
                  paintOrder="stroke"
                >
                  {label}
                </text>
              </g>
            )
          })}
        </g>

        <g data-testid="features">
          {features.map(feature => (
            <FeatureGlyph key={feature.feature_id} feature={feature} scale={scale} size={text * 1.4} />
          ))}
        </g>

        <g data-testid="flag-marks" className="pointer-events-none select-none">
          {drawn.map(({ flag, outline }) => {
            const box = boundsOf(outline)
            const centre = centreOf(outline)
            const r = text * 0.7
            const codes = flag.defect_codes ?? []
            return (
              <g key={flag.id} data-flag-marks={flag.id}>
                <circle cx={box.minX + r} cy={box.minY + r} r={r} fill={FLAG_NUMBER_COLOR} stroke="#ffffff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <text
                  x={box.minX + r}
                  y={box.minY + r}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={r * 1.15}
                  fontWeight="700"
                  fill="#ffffff"
                >
                  {flag.display_order}
                </text>
                {codes.length > 0 && (
                  <text
                    data-testid="defect-codes"
                    x={centre.x}
                    y={centre.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={text * 0.9}
                    fontWeight="700"
                    fill="#111827"
                    stroke="#ffffff"
                    strokeWidth={text / 8}
                    paintOrder="stroke"
                  >
                    {codes.join(' ')}
                  </text>
                )}
              </g>
            )
          })}
        </g>

        <g data-testid="group-labels" className="pointer-events-none select-none">
          {thicknessRuns(drawn.map(({ flag }) => flag), scale).map(run => (
            <text
              key={run.flagIds.join()}
              data-run={run.flagIds.join()}
              x={run.x}
              y={run.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={text}
              fontStyle="italic"
              fontWeight="600"
              fill="#111827"
              stroke="#ffffff"
              strokeWidth={text / 6}
              paintOrder="stroke"
            >
              {run.label}
            </text>
          ))}
        </g>

        <g data-testid="claim-badges" className="select-none">
          {drawn.filter(({ flag }) => flag.claimed_by_idr_id).map(({ flag, outline }) => {
            const box = boundsOf(outline)
            const label = claimBadgeText(flag)
            const size = text * 0.75
            const width = label.length * size * 0.62 + size
            const height = size * 1.5
            const open = () => onOpenIdr?.(flag)
            return (
              <g
                key={flag.id}
                role="link"
                tabIndex={0}
                aria-label={`Open ${label.replace('#', '')}, which claimed flag #${flag.display_order}`}
                data-claim-badge={flag.id}
                className="cursor-pointer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={open}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  open()
                }}
              >
                <title>{`${label}: constructed${flag.constructed_on ? ` ${flag.constructed_on}` : ''}`}</title>
                <rect x={box.maxX - width} y={box.minY - height / 2} width={width} height={height} rx={height / 2} fill={CLAIM_INK} />
                <text
                  x={box.maxX - width / 2}
                  y={box.minY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={size}
                  fontWeight="700"
                  fill="#ffffff"
                >
                  {label}
                </text>
              </g>
            )
          })}
        </g>

        <g data-testid="bundles" className="select-none">
          {bundles.map(bundle => {
            const members = drawn.filter(({ flag }) => bundle.flagIds.includes(flag.id))
            if (members.length === 0) return null
            const box = boundsOf(members.flatMap(({ outline }) => outline))
            const picked = bundle.id === selectedBundleId
            const size = text * 0.9
            const label = `M${bundle.number}`
            return (
              <g key={bundle.id} data-bundle-id={bundle.id}>
                {members.map(({ flag, outline }) => (
                  <polygon key={flag.id} points={svgPoints(outline)} fill="none" stroke={BUNDLE_INK}
                    strokeWidth={picked ? 4 : 2.5} strokeOpacity="0.85" vectorEffect="non-scaling-stroke"
                    className="pointer-events-none" />
                ))}
                <g
                  role={onSelectBundle ? 'button' : undefined}
                  aria-label={`Bundle ${label}`}
                  tabIndex={onSelectBundle ? 0 : undefined}
                  className={onSelectBundle ? 'cursor-pointer' : undefined}
                  onPointerDown={(e) => {
                    if (!onSelectBundle || drawingLine || calibrating) return
                    e.stopPropagation()
                    onSelectBundle(bundle.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !onSelectBundle) return
                    e.preventDefault()
                    onSelectBundle(bundle.id)
                  }}
                >
                  <title>{`Bundle ${label}: ${members.length} flags`}</title>
                  <rect x={(box.minX + box.maxX) / 2 - size * 1.3} y={(box.minY + box.maxY) / 2 - size * 0.8}
                    width={size * 2.6} height={size * 1.6} rx={size * 0.4} fill={BUNDLE_INK}
                    stroke="#ffffff" strokeWidth={picked ? 2 : 1} vectorEffect="non-scaling-stroke" />
                  <text x={(box.minX + box.maxX) / 2} y={(box.minY + box.maxY) / 2} textAnchor="middle"
                    dominantBaseline="central" fontSize={size} fontWeight="700" fill="#ffffff">{label}</text>
                </g>
              </g>
            )
          })}
        </g>

        {drawingCurb && curbPoints.length > 0 && (
          <g data-testid="curb-drawing-preview" className="pointer-events-none">
            <polyline points={svgPoints(hover ? [...curbPoints, hover] : curbPoints)} fill="none" stroke={CURB_DRAW_INK}
              strokeWidth="2.5" strokeDasharray="8 4" vectorEffect="non-scaling-stroke" />
            {curbPoints.map((point, index) => (
              <circle key={index} cx={point.x} cy={point.y} r="4" fill={CURB_DRAW_INK} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        )}

        {strip && stripShown && !drawingStrip && strip.length >= 3 && (
          <g data-testid="sidewalk-strip" className="pointer-events-none">
            <title>Sidewalk strip</title>
            <polygon points={svgPoints(strip)} fill={STRIP_INK} fillOpacity="0.06" stroke={STRIP_INK} strokeWidth="2"
              vectorEffect="non-scaling-stroke" />
            <line data-testid="property-line" x1={strip[0].x} y1={strip[0].y} x2={strip[1].x} y2={strip[1].y}
              stroke={STRIP_INK} strokeWidth="4" vectorEffect="non-scaling-stroke" />
          </g>
        )}

        {drawingStrip && stripPoints.length > 0 && (
          <g data-testid="strip-drawing-preview" className="pointer-events-none">
            <polyline
              points={svgPoints(hover ? [...stripPoints, hover] : stripPoints)}
              fill="none"
              stroke={STRIP_INK}
              strokeWidth="2"
              strokeDasharray="8 4"
              vectorEffect="non-scaling-stroke"
            />
            {stripPoints.length >= 2 && (
              <line x1={stripPoints[0].x} y1={stripPoints[0].y} x2={stripPoints[1].x} y2={stripPoints[1].y}
                stroke={STRIP_INK} strokeWidth="4" vectorEffect="non-scaling-stroke" />
            )}
            {stripPoints.map((point, index) => (
              <circle key={index} cx={point.x} cy={point.y} r="4" fill={STRIP_INK} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        )}

        {calibrating && first && (
          <g data-testid="calibration" className="pointer-events-none">
            {second && (
              <line x1={first.x} y1={first.y} x2={second.x} y2={second.y} stroke="#e47a0f" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            )}
            {[first, second].filter(Boolean).map((point, index) => (
              <circle key={index} cx={point.x} cy={point.y} r="4" fill="#e47a0f" vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        )}

        {showCorners && (
          <g data-testid="corner-marks" stroke="#dc2626" strokeWidth="2" vectorEffect="non-scaling-stroke" className="pointer-events-none">
            {[[0, 0], [page.width_px, page.height_px]].map(([x, y]) => (
              <g key={`${x},${y}`} data-corner={`${x},${y}`}>
                <line x1={x - 20} y1={y} x2={x + 20} y2={y} vectorEffect="non-scaling-stroke" />
                <line x1={x} y1={y - 20} x2={x} y2={y + 20} vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </g>
        )}
      </svg>
    </RotatedPage>
  )
}
