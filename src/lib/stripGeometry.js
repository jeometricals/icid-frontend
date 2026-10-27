// A page's sidewalk strip (Slice Y1.5): the sidewalk in front of the lot, a closed polygon of {x, y} points in the
// page's native pixels, the property line first (points 0 -> 1). A flag whose outline lies wholly outside it is outside
// the property line, and saving the strip marks it non-assessable. The overlap test is a port of the backend's
// api/services/area_containment.py (ear clipping, then Sutherland-Hodgman), so the preview and the save agree.

import { flagOutline } from './flagGeometry'

// Most points a strip may have (the backend's MAX_STRIP_POINTS)
export const MAX_STRIP_POINTS = 200
// Overlap at or below this (square feet) is no overlap: a flag that only touches the strip is outside it
export const OUTSIDE_TOLERANCE_SF = 0.01

// A polygon's signed area (shoelace): positive when its points run anticlockwise with y up
function signedArea(points) {
  return points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length]
    return sum + p.x * q.y - q.x * p.y
  }, 0) / 2
}

const anticlockwise = (points) => (signedArea(points) >= 0 ? points : [...points].reverse())

// The turn from o to a to b: positive anticlockwise
const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

const insideTriangle = (p, a, b, c) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0

/** Cuts a simple polygon into anticlockwise triangles by ear clipping (collinear corners dropped). */
export function triangles(points) {
  const left = anticlockwise([...points])
  const found = []
  while (left.length > 3) {
    let cut = false
    for (let index = 0; index < left.length; index += 1) {
      const a = left[(index - 1 + left.length) % left.length]
      const b = left[index]
      const c = left[(index + 1) % left.length]
      const turn = cross(a, b, c)
      if (Math.abs(turn) < 1e-12) {
        left.splice(index, 1) // a corner on a straight line
        cut = true
        break
      }
      if (turn < 0) continue // a reflex corner is not an ear
      if (left.some(p => p !== a && p !== b && p !== c && insideTriangle(p, a, b, c))) continue
      found.push([a, b, c])
      left.splice(index, 1)
      cut = true
      break
    }
    if (!cut) return found // nothing more to cut (a degenerate remainder)
  }
  if (left.length === 3 && Math.abs(signedArea(left)) > 1e-12) found.push([left[0], left[1], left[2]])
  return found
}

// The part of a polygon inside an anticlockwise triangle (Sutherland-Hodgman, one edge at a time)
function clip(subject, triangle) {
  let output = subject
  for (let e = 0; e < 3 && output.length; e += 1) {
    const a = triangle[e]
    const b = triangle[(e + 1) % 3]
    const source = output
    output = []
    source.forEach((p, i) => {
      const q = source[(i + 1) % source.length]
      const pIn = cross(a, b, p) >= 0
      const qIn = cross(a, b, q) >= 0
      if (pIn !== qIn) {
        const dx = q.x - p.x
        const dy = q.y - p.y
        const ex = b.x - a.x
        const ey = b.y - a.y
        const t = ((a.x - p.x) * ey - (a.y - p.y) * ex) / (dx * ey - dy * ex)
        output.push({ x: p.x + t * dx, y: p.y + t * dy })
      }
      if (qIn) output.push(q)
    })
  }
  return output
}

/** How much of one polygon lies inside another, in their units squared (either may be concave, either way round). */
export function overlapArea(subject, container) {
  const ccw = anticlockwise([...subject])
  return triangles(container).reduce((sum, triangle) => {
    const piece = clip(ccw, triangle)
    return piece.length >= 3 ? sum + Math.abs(signedArea(piece)) : sum
  }, 0)
}

/**
 * The flags wholly outside a strip: their outline on the page overlaps it by OUTSIDE_TOLERANCE_SF or less. A flag with
 * no place or no drawable shape can't be told and isn't one. Takes the strip's points, the flags and the page's px/ft.
 */
export function outsideFlags(points, flags, scale) {
  if (!scale || points.length < 3) return []
  return flags.filter(flag => {
    const outline = flagOutline(flag, scale)
    return outline.length >= 3 && overlapArea(outline, points) / (scale * scale) <= OUTSIDE_TOLERANCE_SF
  })
}

/** The flags saving a strip would mark non-assessable: outside it, assessable and not claimed by an approved IDR. */
export const flagsToFlip = (points, flags, scale) => outsideFlags(points, flags, scale)
  .filter(flag => flag.surveyed_is_assessable && !flag.claimed_by_idr_id)

/** The strip's frontage: its first edge, the property line, in feet at the page's scale (null without one). */
export function stripFrontageFt(points, scale) {
  if (!scale || points.length < 2) return null
  return Math.round((Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) / scale) * 100) / 100
}

// Whether two segments meet, touching included
function segmentsMeet(a, b, c, d) {
  const d1 = cross(c, d, a)
  const d2 = cross(c, d, b)
  const d3 = cross(a, b, c)
  const d4 = cross(a, b, d)
  if (((d1 > 0) !== (d2 > 0)) && d1 !== 0 && d2 !== 0 && ((d3 > 0) !== (d4 > 0)) && d3 !== 0 && d4 !== 0) return true
  const within = (p, q, r) => Math.min(p.x, q.x) <= r.x && r.x <= Math.max(p.x, q.x)
    && Math.min(p.y, q.y) <= r.y && r.y <= Math.max(p.y, q.y)
  return (d1 === 0 && within(c, d, a)) || (d2 === 0 && within(c, d, b))
    || (d3 === 0 && within(a, b, c)) || (d4 === 0 && within(a, b, d))
}

/**
 * Why a strip can't be saved, as the backend words it, or null when it can: 3 to MAX_STRIP_POINTS points, a first edge
 * with some length, some area, and no edge meeting another but its neighbours.
 */
export function stripProblem(points) {
  if (points.length < 3 || points.length > MAX_STRIP_POINTS) return `A sidewalk strip has 3 to ${MAX_STRIP_POINTS} points`
  if (points[0].x === points[1].x && points[0].y === points[1].y) {
    return "A sidewalk strip's first edge, the property line, has no length"
  }
  if (Math.abs(signedArea(points)) < 1e-6) return 'A sidewalk strip must enclose some area'
  const edges = points.map((p, i) => [p, points[(i + 1) % points.length]])
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 2; j < edges.length; j += 1) {
      if (i === 0 && j === edges.length - 1) continue // the first and last edges share the first point
      if (segmentsMeet(...edges[i], ...edges[j])) return "A sidewalk strip's edges must not cross"
    }
  }
  return null
}
