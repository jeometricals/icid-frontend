// Measurement bundles (Slices Y3b-2, Y4a): several flags of one page, of one classification, sharing edges in one
// chain, measured as one outline of 1 to 3 rectangles. The checks mirror the backend's bundle route (its 400 messages
// and order) so the modal can refuse what the server would; the edge test is a port of the backend's
// api/services/construction_slabs.py (`abut`, within SLAB_TOLERANCE_FT).

import { flagOutline } from './flagGeometry'

// How close two edges must lie to count as one, in feet (the backend's SLAB_TOLERANCE_FT)
export const SLAB_TOLERANCE_FT = 0.1
// How many rectangles an outline takes
export const MAX_RECTANGLES = 3

// A polygon's edges, each [from, to], the last closing it
const edges = (points) => points.map((point, i) => [point, points[(i + 1) % points.length]])

// Whether another edge runs along an edge: both its ends within the tolerance of the edge's line, covering more than it
function along([a, b], other) {
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  if (length < 1e-9) return false
  const ux = (b.x - a.x) / length
  const uy = (b.y - a.y) / length
  if (other.some(q => Math.abs((q.x - a.x) * uy - (q.y - a.y) * ux) > SLAB_TOLERANCE_FT)) return false
  const [t0, t1] = other.map(q => (q.x - a.x) * ux + (q.y - a.y) * uy).sort((p, q) => p - q)
  return Math.min(t1, length) - Math.max(t0, 0) > SLAB_TOLERANCE_FT
}

/** Whether two outlines (in feet) share an edge: an edge of one runs along an edge of the other. */
export function abut(a, b) {
  const others = edges(b)
  return edges(a).some(edge => others.some(other => along(edge, other)))
}

// A flag's outline on its page, in feet
const outlineFt = (flag, scale) => flagOutline(flag, scale).map(({ x, y }) => ({ x: x / scale, y: y / scale }))

/** The flags a chain starting from the first doesn't reach (each reached flag reaching those sharing an edge with it). */
export function unconnected(flags, scale) {
  const outlines = flags.map(flag => outlineFt(flag, scale))
  const reached = new Set([0])
  const frontier = [0]
  while (frontier.length) {
    const current = frontier.pop()
    outlines.forEach((outline, index) => {
      if (!reached.has(index) && abut(outlines[current], outline)) {
        reached.add(index)
        frontier.push(index)
      }
    })
  }
  return flags.filter((_, index) => !reached.has(index))
}

/** A flag's classification, as a bundle's members share it: thickness, assessment and pay item. */
export const classificationKey = (flag) => `${flag.surveyed_thickness}|${flag.surveyed_is_assessable}|${flag.pay_item_id ?? ''}`

const flagName = (flag) => `Flag ${flag.display_order}`

/**
 * Why flags can't be bundled, as the backend's route says it, in its order; null when they can.
 * Takes the selected flags (all on one page) and the page's px/ft.
 */
export function bundleProblem(flags, scale) {
  if (flags.length < 2) return 'A bundle takes at least two flags'
  if (!scale) return "Set this page's scale first"
  for (const flag of flags) {
    if (flag.claimed_by_idr_id) return `${flagName(flag)} is claimed by IDR ${flag.claimed_by_idr_number ?? ''}`.trim()
    if (flag.bundled) return `${flagName(flag)} is already in a bundle`
    if (flagOutline(flag, scale).length === 0) return `${flagName(flag)} has no place on the page`
  }
  const odd = flags.filter(flag => classificationKey(flag) !== classificationKey(flags[0]))
  if (odd.length) {
    return `The flags differ in thickness, assessment or pay item: ${odd.map(flagName).join(', ')} differ from ${flagName(flags[0])}`
  }
  const apart = unconnected(flags, scale)
  if (apart.length) return `${apart.map(flagName).join(', ')} ${apart.length === 1 ? "doesn't" : "don't"} abut the rest`
  return null
}

/** Why rectangles ([{L, W}] as typed) aren't an outline: 1 to 3 of them, each length a number above 0; null when they are. */
export function rectanglesProblem(rectangles) {
  if (rectangles.length < 1 || rectangles.length > MAX_RECTANGLES) return 'An outline takes 1 to 3 rectangles'
  const bad = rectangles.findIndex(({ L, W }) => !(Number(L) > 0) || !(Number(W) > 0))
  return bad >= 0 ? `Rectangle ${String.fromCharCode(65 + bad)} needs a length and a width above 0` : null
}

// Square feet to the cent, halves up (as the backend's Decimal rounding)
const cents = (value) => Math.round((value + Number.EPSILON) * 100) / 100

/** An outline's area: each rectangle's L x W to the cent, summed (the backend's outer_area). */
export const outerArea = (rectangles) => cents(rectangles.reduce((sum, { L, W }) => sum + cents(Number(L) * Number(W)), 0))

/**
 * The workspace's bundle numbers: M1, M2, ... per PIR, by each bundle's lowest flag number (display_order). A report
 * numbers its own bundles per IDR, so the two can differ.
 * Takes the PIR's flags; returns {measurement_id: number}.
 */
export function bundleNumbers(flags) {
  const lowest = {}
  for (const flag of flags) {
    if (!flag.bundled || !flag.measurement_id) continue
    lowest[flag.measurement_id] = Math.min(lowest[flag.measurement_id] ?? Infinity, flag.display_order)
  }
  return Object.fromEntries(Object.keys(lowest)
    .sort((a, b) => lowest[a] - lowest[b] || a.localeCompare(b))
    .map((id, index) => [id, index + 1]))
}
