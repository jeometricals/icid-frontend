// The corner-quadrant flag shape (Slice Y5): the OE sheet's area of a corner's sidewalk, an arc segment (A1) on a
// right triangle less a correction rectangle at its inner corner. The same rules as the backend's
// api/services/corner_quadrant.py, worked in whole hundredths and ten-thousandths so the figures are exact.

// The OE sheet's arc-segment coefficients by H/C, 0.01 to 0.50 (index 0 is 0.01): a segment's area is Coef × H × C
export const COEF_TABLE = [
  0.6667, 0.6669, 0.6671, 0.6675, 0.6680, 0.6686, 0.6693, 0.6701, 0.6710, 0.6720,
  0.6731, 0.6743, 0.6756, 0.6770, 0.6785, 0.6801, 0.6818, 0.6836, 0.6855, 0.6875,
  0.6896, 0.6918, 0.6941, 0.6965, 0.6989, 0.7014, 0.7041, 0.7068, 0.7096, 0.7125,
  0.7154, 0.7185, 0.7216, 0.7248, 0.7280, 0.7314, 0.7348, 0.7383, 0.7419, 0.7455,
  0.7492, 0.7530, 0.7568, 0.7607, 0.7647, 0.7687, 0.7728, 0.7769, 0.7811, 0.7854,
]

// The six inputs: the key the backend stores, its label, and whether 0 is allowed (the correction rectangle's)
export const CORNER_QUADRANT_FIELDS = [
  ['H', 'H (height)', false], ['C', 'C (chord)', false],
  ['R1', 'R1 (leg 1)', false], ['R2', 'R2 (leg 2)', false],
  ['A', 'A (length)', true], ['B', 'B (width)', true],
]

export const RATIO_RANGE_MESSAGE = 'H/C must come to between 0.01 and 0.50 (the coefficient table\'s range).'
export const CORRECTION_TOO_LARGE_MESSAGE = 'Correction rectangle exceeds arc + triangle - check inputs.'

// Points sampled along the drawn arc (as an arc flag's)
const ARC_STEPS = 32

/**
 * A typed length in hundredths of a foot: a number to at most two decimal places, above 0 (or 0 or more).
 * Returns the whole number of hundredths, or null when the text isn't such a length.
 */
export function hundredths(typed, zeroAllowed = false) {
  const text = String(typed ?? '').trim()
  if (!/^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  const value = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'))
  return value > 0 || (zeroAllowed && value === 0) ? value : null
}

/** What is wrong with one typed input, or null: "Above 0, at most two decimal places." and the like. */
export function fieldProblem(typed, zeroAllowed) {
  if (hundredths(typed, zeroAllowed) !== null) return null
  return zeroAllowed ? '0 or more, at most two decimal places.' : 'Above 0, at most two decimal places.'
}

// Divide whole numbers, halves up (both positive)
const divideHalfUp = (top, bottom) => Math.floor((2 * top + bottom) / (2 * bottom))

/**
 * Work a corner quadrant out from its dimensions in feet ({H, C, R1, R2, A, B}, each to at most two places):
 * H/C to the hundredth halves up, its coefficient, the arc segment, the triangle and the correction, and the area
 * (the exact sum, halves up to the cent).
 * Returns {ratio, coef, arc, triangle, correction, area, rows: {arc, triangle, correction}} (rows cut to the cent,
 * as the OE sheet prints them), or {error} when H/C is off the table or the area isn't above 0.
 */
export function cornerQuadrant(dimensions) {
  const [h, c, r1, r2, a, b] = ['H', 'C', 'R1', 'R2', 'A', 'B'].map(key => Math.round(Number(dimensions[key]) * 100))
  const ratio = divideHalfUp(h * 100, c) // hundredths of H/C
  if (ratio < 1 || ratio > 50) return { error: RATIO_RANGE_MESSAGE }
  const coef = Math.round(COEF_TABLE[ratio - 1] * 10000)
  // In hundred-millionths of a square foot: Coef (1e-4) × H (1e-2) × C (1e-2), and the others brought to the same
  const arc = coef * h * c
  const triangle = r1 * r2 * 5000
  const correction = a * b * 10000
  const total = arc + triangle - correction
  const area = divideHalfUp(total, 1000000) // cents
  if (total <= 0 || area <= 0) return { error: CORRECTION_TOO_LARGE_MESSAGE }
  const cut = (value) => Math.floor(value / 1000000) / 100
  return {
    ratio: ratio / 100,
    coef: coef / 10000,
    arc: arc / 1e8,
    triangle: triangle / 1e8,
    correction: correction / 1e8,
    area: area / 100,
    rows: { arc: cut(arc), triangle: cut(triangle), correction: cut(correction) },
  }
}

/**
 * Check what is typed into the six inputs and work it out.
 * Returns {problems: {key: message}, dimensions (numbers, or null while any input is wrong), worked (cornerQuadrant's,
 * or null)}; worked.error is set when the inputs are fine but the whole isn't.
 */
export function checkCornerQuadrant(typed) {
  const problems = {}
  for (const [key, , zeroAllowed] of CORNER_QUADRANT_FIELDS) {
    const problem = fieldProblem(typed[key], zeroAllowed)
    if (problem) problems[key] = problem
  }
  if (Object.keys(problems).length > 0) return { problems, dimensions: null, worked: null }
  const dimensions = Object.fromEntries(CORNER_QUADRANT_FIELDS.map(([key]) => [key, Number(typed[key])]))
  return { problems, dimensions, worked: cornerQuadrant(dimensions) }
}

/**
 * A corner quadrant's outline in feet, in its own frame (x right, y down), as api/services/corner_quadrant.py draws it:
 * the right angle at the bottom left, leg R1 along the bottom and R2 up the left side, an arc of height H bulging out of
 * the hypotenuse, and an A × B notch cut at the right angle. For drawing only: its area is the formula's.
 * Returns [{x, y}, ...].
 */
export function cornerQuadrantOutline({ H, R1, R2, A, B }) {
  const notchA = Math.min(A, R1)
  const notchB = Math.min(B, R2)
  const points = [{ x: 0, y: 0 }]
  if (notchA > 0 && notchB > 0) {
    points.push({ x: 0, y: R2 - notchB }, { x: notchA, y: R2 - notchB }, { x: notchA, y: R2 })
  } else {
    points.push({ x: 0, y: R2 })
  }
  points.push({ x: R1, y: R2 })
  // The arc from (R1, R2) back to (0, 0) over the hypotenuse, away from the right angle
  const chord = Math.hypot(R1, R2)
  const [ux, uy] = [R1 / chord, R2 / chord]
  const [nx, ny] = [R2 / chord, -R1 / chord]
  const radius = (chord * chord / 4 + H * H) / (2 * H)
  const half = Math.atan2(chord / 2, radius - H)
  const [cx, cy] = [R1 / 2 - nx * (radius - H), R2 / 2 - ny * (radius - H)]
  for (let step = 1; step < ARC_STEPS; step += 1) {
    const angle = half - (2 * half * step) / ARC_STEPS
    points.push({
      x: cx + radius * (nx * Math.cos(angle) + ux * Math.sin(angle)),
      y: cy + radius * (ny * Math.cos(angle) + uy * Math.sin(angle)),
    })
  }
  return points
}
