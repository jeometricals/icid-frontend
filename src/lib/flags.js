// A new flag's starting values, and the colours flags are drawn in

/** The display order a new flag starts with: one past the highest of the PIR's flags, or 1 for its first. */
export function nextDisplayOrder(flags) {
  return flags.length === 0 ? 1 : Math.max(...flags.map(flag => flag.display_order)) + 1
}

// The dimensions (feet) a flag of each shape is placed with: a 5 ft piece, to be edited in the panel
export const DEFAULT_DIMENSIONS = {
  rectangle: { L: 5, W: 5 },
  trapezoid: { a: 4, b: 6, w: 5 },
  triangle: { a: 5, b: 5 },
  polygon: { vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }] },
  arc: { r: 5, theta: Math.PI },
}

/**
 * The body of a flag placed by a click: the next display order, the shape with its default dimensions, centred on
 * the clicked point (native page pixels) and unrotated, marked "number only", assessable, 4" thick.
 */
export function newFlagValues(shape, { x, y }, flags) {
  return {
    display_order: nextDisplayOrder(flags),
    shape,
    dimensions: structuredClone(DEFAULT_DIMENSIONS[shape]),
    sketch_x: Math.round(x * 100) / 100,
    sketch_y: Math.round(y * 100) / 100,
    rotation: 0,
    surveyed_mark: 'number_only',
    surveyed_is_assessable: true,
    surveyed_thickness: '4in',
    added_in_field: false,
  }
}

// A flag's colour on the sketch, by its surveyed thickness (the toolbar's legend); an unknown one is grey
export const THICKNESS_COLORS = {
  '4in': '#2563eb',
  '7in_as_4in': '#d97706',
  '7in': '#dc2626',
}

export const thicknessColor = (thickness) => THICKNESS_COLORS[thickness] ?? '#6b7280'
