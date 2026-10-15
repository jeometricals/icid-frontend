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
 * - "4\" Conc." / "7\" Conc." on each run of consecutive same-thickness flags (`thicknessRuns`).
 * Only the flags take clicks; the rest is drawing. A legend (SketchLegend) sits in the page's lower-left corner.
 * - A click on empty page: places the armed shape there (onPlace), else a calibration point while calibrating
 *   (onCalibratePoint), else clears the selection (onSelect(null)).
 * - A click on a flag selects it (while calibrating it is a calibration point instead), armed shape or not. For a
 *   writer, dragging an already selected flag moves it, even with a shape armed: the overlay alone follows the
 *   pointer, and letting go hands the new place to onMove; Esc while dragging puts it back.
 * - While calibrating, the points picked so far are marked and joined by a thin line.
 * Pointer positions are turned into page pixels with toNativeCoords against the page's on-screen box.
 * Props: page, flags, areas, features and segments (this page's), selectedId, activeShape, calibrating,
 * calibratePoints ([{x, y}]), writer,
 * onPlace({x, y}), onSelect(id or null), onMove(id, {x, y}), onCalibratePoint({x, y}), onImageError, showCorners
 * (marks the overlay's corners (0, 0) and (width, height), to check its alignment by eye).
 */
export default function SketchCanvas({
  page, flags, areas = [], features = [], segments = [], selectedId = null, activeShape = null, calibrating = false, calibratePoints = [], writer = false,
  onPlace, onSelect, onMove, onCalibratePoint, onImageError, showCorners = false,
}) {
  const boxRef = useRef(null)
  const [drag, setDrag] = useState(null) // {id, start, origin, at}: a selected flag being moved
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
    if (calibrating) onCalibratePoint?.(point)
    else if (activeShape) onPlace?.(point)
    else onSelect?.(null)
  }

  const pressFlag = (e, flag) => {
    if (calibrating) return // the page takes it as a calibration point
    e.stopPropagation()
    if (e.button !== undefined && e.button !== 0) return
    const wasSelected = flag.id === selectedId
    onSelect?.(flag.id)
    if (!writer || !wasSelected) return
    const start = native(e)
    const origin = { x: flag.sketch_x, y: flag.sketch_y }
    setDrag({ id: flag.id, start, origin, at: origin })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const movePointer = (e) => {
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

  const crosshair = activeShape || calibrating
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
      >
        <SketchPatterns prefix={patterns} unit={Math.max(4, (scale ?? 10) * 0.6)} />

        <g data-testid="segments" className="pointer-events-none">
          {segments.map(segment => {
            const style = segmentStyle(segment.segment_type)
            return (
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
          })}
        </g>

        {drawn.map(({ flag, outline }) => {
          const selected = flag.id === selectedId
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
