// The sketch's fills, as the DOT Construction Report draws them: light-blue stipple (a new 4" flag), white (a new 7"
// flag), tan hatch (a flag that isn't assessable) and yellow stripes (a non-assessable area)
export const SKETCH_FILLS = {
  stipple: { background: '#dbeafe', ink: '#3b82f6' },
  white: { background: '#ffffff', ink: null },
  hatch: { background: '#f3e3c3', ink: '#a8804a' },
  stripes: { background: '#fef9c3', ink: '#eab308' },
}

// The circle a flag's number sits in, and the cross over a flag that isn't assessable
export const FLAG_NUMBER_COLOR = '#ea580c'
export const NON_ASSESSABLE_INK = '#7c5a2e'

/** The `fill` that paints one of SKETCH_FILLS, given the prefix its SketchPatterns was rendered with. */
export const fillUrl = (prefix, fill) => (fill === 'white' ? SKETCH_FILLS.white.background : `url(#${prefix}-${fill})`)

/**
 * The SVG <defs> of the sketch's patterned fills (stipple, hatch and stripes; white is a plain colour), each with
 * the id `<prefix>-<fill>`. Render it inside the <svg> that uses them, and paint with fillUrl(prefix, fill).
 * Props: prefix (unique on the page), unit (the pattern's tile, in the svg's user units).
 */
export default function SketchPatterns({ prefix, unit }) {
  const { stipple, hatch, stripes } = SKETCH_FILLS
  return (
    <defs>
      <pattern id={`${prefix}-stipple`} patternUnits="userSpaceOnUse" width={unit} height={unit}>
        <rect width={unit} height={unit} fill={stipple.background} />
        <circle cx={unit / 4} cy={unit / 4} r={unit / 10} fill={stipple.ink} />
        <circle cx={(3 * unit) / 4} cy={(3 * unit) / 4} r={unit / 10} fill={stipple.ink} />
      </pattern>
      <pattern id={`${prefix}-hatch`} patternUnits="userSpaceOnUse" width={unit} height={unit} patternTransform="rotate(45)">
        <rect width={unit} height={unit} fill={hatch.background} />
        <line x1="0" y1="0" x2="0" y2={unit} stroke={hatch.ink} strokeWidth={unit / 6} />
      </pattern>
      <pattern id={`${prefix}-stripes`} patternUnits="userSpaceOnUse" width={unit} height={unit} patternTransform="rotate(-45)">
        <rect width={unit} height={unit} fill={stripes.background} />
        <rect width={unit / 2} height={unit} fill={stripes.ink} />
      </pattern>
    </defs>
  )
}
