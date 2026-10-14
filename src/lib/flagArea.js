// A flag's area from its shape and dimensions, in square feet: the same formulas the backend uses for
// computed_quantity (api/services/flag_area.py), so the form can preview what will be stored

/** Degrees to radians, for an arc's angle: the form takes degrees, the backend stores radians. */
export const degreesToRadians = (degrees) => (degrees * Math.PI) / 180

/** Radians to degrees, for showing a stored arc's angle in the form. */
export const radiansToDegrees = (radians) => (radians * 180) / Math.PI

/** The area a polygon encloses, by the shoelace formula, its vertices ({x, y}) taken in order; never negative. */
export function polygonArea(vertices) {
  let twice = 0
  vertices.forEach((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length]
    twice += vertex.x * next.y - next.x * vertex.y
  })
  return Math.abs(twice) / 2
}

// Rounded to the cent of a square foot, halves up, as the backend stores it
const toCents = (area) => Math.round((area + Number.EPSILON) * 100) / 100

/**
 * A flag's area: rectangle L × W; trapezoid (a + b) / 2 × w; right triangle a × b / 2; polygon by the shoelace
 * formula; arc the circular segment r² / 2 × (θ − sin θ), θ in radians.
 * Takes the shape and its dimensions as the backend stores them.
 * Returns the area in square feet to two decimals, or null for an unknown shape.
 */
export function computeArea(shape, dimensions) {
  switch (shape) {
    case 'rectangle': return toCents(dimensions.L * dimensions.W)
    case 'trapezoid': return toCents(((dimensions.a + dimensions.b) / 2) * dimensions.w)
    case 'triangle': return toCents((dimensions.a * dimensions.b) / 2)
    case 'polygon': return toCents(polygonArea(dimensions.vertices))
    case 'arc': return toCents(((dimensions.r * dimensions.r) / 2) * (dimensions.theta - Math.sin(dimensions.theta)))
    default: return null
  }
}

/** An area as the flag pages print it: "1,042.50 SF". */
export function formatArea(area) {
  return `${Number(area).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SF`
}
