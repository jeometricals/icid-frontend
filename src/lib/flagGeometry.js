// Where a flag sits on its page. A flag's dimensions are in feet; its page's scale (px/ft) turns them into page
// pixels. sketch_x / sketch_y (native, unrotated page pixels; see lib/pageGeometry.js) is the centre of the shape's
// bounding box, and rotation is the shape's own turn about that point, in degrees clockwise.

// Points sampled along an arc's curve
const ARC_STEPS = 32

/**
 * A shape's outline in feet, in its own frame (x right, y down), before centring:
 * - rectangle {L, W}: L wide, W tall
 * - trapezoid {a, b, w}: a along the top, b along the bottom, w between them, both centred
 * - triangle {a, b}: a right triangle, the right angle at the bottom left, legs a (along the bottom) and b (up)
 * - polygon {vertices}: its vertices as given
 * - arc {r, theta}: a circular segment, the chord at the bottom and the curve above it (theta in radians)
 * - circle {r} (a feature's only): the circle about its centre
 * Returns [{x, y}, ...], or [] for an unknown shape or missing dimensions.
 */
export function shapeOutline(shape, dimensions) {
  if (!dimensions) return []
  switch (shape) {
    case 'rectangle': {
      const { L, W } = dimensions
      return [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L, y: W }, { x: 0, y: W }]
    }
    case 'trapezoid': {
      const { a, b, w } = dimensions
      const half = Math.max(a, b) / 2
      return [{ x: half - a / 2, y: 0 }, { x: half + a / 2, y: 0 }, { x: half + b / 2, y: w }, { x: half - b / 2, y: w }]
    }
    case 'triangle': {
      const { a, b } = dimensions
      return [{ x: 0, y: 0 }, { x: a, y: b }, { x: 0, y: b }]
    }
    case 'polygon':
      return (dimensions.vertices ?? []).map(({ x, y }) => ({ x, y }))
    case 'arc': {
      const { r, theta } = dimensions
      // The curve from -theta / 2 to theta / 2, measured from straight up about the circle's centre
      return Array.from({ length: ARC_STEPS + 1 }, (_, step) => {
        const angle = -theta / 2 + (theta * step) / ARC_STEPS
        return { x: r * Math.sin(angle), y: -r * Math.cos(angle) }
      })
    }
    case 'circle': {
      const { r } = dimensions
      return Array.from({ length: ARC_STEPS }, (_, step) => {
        const angle = (2 * Math.PI * step) / ARC_STEPS
        return { x: r * Math.cos(angle), y: r * Math.sin(angle) }
      })
    }
    default:
      return []
  }
}

/** The bounding box of some points: {minX, minY, maxX, maxY}. */
export function boundsOf(points) {
  return points.reduce(
    (box, { x, y }) => ({
      minX: Math.min(box.minX, x), minY: Math.min(box.minY, y), maxX: Math.max(box.maxX, x), maxY: Math.max(box.maxY, y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )
}

/**
 * A flag's outline on its page, in native page pixels: the shape's outline in feet, centred on its bounding box,
 * scaled by the page's px/ft, turned by the flag's rotation and moved to (sketch_x, sketch_y). Takes the flag (or
 * just {shape, dimensions, sketch_x, sketch_y, rotation}) and the scale; an `at` of {x, y} stands in for the
 * flag's own place (a drag in progress). Returns [] without a scale, a place or a drawable shape.
 */
export function flagOutline(flag, scale, at = null) {
  const x = at?.x ?? flag.sketch_x
  const y = at?.y ?? flag.sketch_y
  if (!scale || x == null || y == null) return []
  const outline = shapeOutline(flag.shape, flag.dimensions)
  if (outline.length === 0) return []
  const box = boundsOf(outline)
  const cx = (box.minX + box.maxX) / 2
  const cy = (box.minY + box.maxY) / 2
  const turn = ((flag.rotation ?? 0) * Math.PI) / 180
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  return outline.map(point => {
    const dx = (point.x - cx) * scale
    const dy = (point.y - cy) * scale
    return { x: x + dx * cos - dy * sin, y: y + dx * sin + dy * cos }
  })
}

/** The middle of some points' bounding box: {x, y}. */
export function centreOf(points) {
  const box = boundsOf(points)
  return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 }
}

/** Points as an SVG polygon's `points` attribute. */
export const svgPoints = (points) => points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
