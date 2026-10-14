import { useEffect, useRef, useState } from 'react'
import RotatedPage from './RotatedPage'
import { boundsOf, flagOutline, svgPoints } from '../../lib/flagGeometry'
import { thicknessColor } from '../../lib/flags'
import { toNativeCoords } from '../../lib/pageGeometry'

// How far (page pixels) a pointer must travel on a selected flag before it counts as a drag rather than a click
const DRAG_THRESHOLD = 1

/**
 * One PIR page with its sketch: the page's image (RotatedPage) and an SVG overlay over it in the page's native
 * pixels (viewBox 0 0 width height), turned with it, so a flag's stored place (sketch_x / sketch_y) is right at every
 * rotation. Each flag on the page is drawn as its outline (lib/flagGeometry.js) in its thickness's colour, with its
 * display order; the selected one is drawn heavier.
 * - A click on empty page: places the armed shape there (onPlace), else a calibration point while calibrating
 *   (onCalibratePoint), else clears the selection (onSelect(null)).
 * - A click on a flag selects it (while calibrating it is a calibration point instead). For a writer, dragging an
 *   already selected flag moves it: the overlay alone follows the pointer, and letting go hands the new place to
 *   onMove; Esc while dragging puts it back.
 * - While calibrating, the points picked so far are marked and joined by a thin line.
 * Pointer positions are turned into page pixels with toNativeCoords against the page's on-screen box.
 * Props: page, flags (this page's), selectedId, activeShape, calibrating, calibratePoints ([{x, y}]), writer,
 * onPlace({x, y}), onSelect(id or null), onMove(id, {x, y}), onCalibratePoint({x, y}), onImageError, showCorners
 * (marks the overlay's corners (0, 0) and (width, height), to check its alignment by eye).
 */
export default function SketchCanvas({
  page, flags, selectedId = null, activeShape = null, calibrating = false, calibratePoints = [], writer = false,
  onPlace, onSelect, onMove, onCalibratePoint, onImageError, showCorners = false,
}) {
  const boxRef = useRef(null)
  const [drag, setDrag] = useState(null) // {id, start, origin, at}: a selected flag being moved
  const scale = page.scale_px_per_ft

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
    if (!writer || !wasSelected || activeShape) return
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
  const [first, second] = calibratePoints

  return (
    <RotatedPage ref={boxRef} page={page} onImageError={onImageError}>
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
        {flags.map(flag => {
          const at = drag?.id === flag.id ? drag.at : null
          const outline = flagOutline(flag, scale, at)
          if (outline.length === 0) return null
          const selected = flag.id === selectedId
          const color = thicknessColor(flag.surveyed_thickness)
          const box = boundsOf(outline)
          return (
            <g
              key={flag.id}
              role="button"
              aria-label={`Flag #${flag.display_order}`}
              aria-pressed={selected}
              data-flag-id={flag.id}
              className={writer && selected && !crosshair ? 'cursor-move' : 'cursor-pointer'}
              onPointerDown={(e) => pressFlag(e, flag)}
            >
              <polygon
                points={svgPoints(outline)}
                fill={color}
                fillOpacity={selected ? 0.35 : 0.2}
                stroke={color}
                strokeWidth={selected ? 3 : 1.5}
                strokeDasharray={selected ? '6 3' : undefined}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={(box.minX + box.maxX) / 2}
                y={(box.minY + box.maxY) / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.max(10, Math.min(box.maxX - box.minX, box.maxY - box.minY) / 3)}
                fill={color}
                className="select-none pointer-events-none font-semibold"
              >
                {flag.display_order}
              </text>
            </g>
          )
        })}

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
