import SketchPatterns, { FLAG_NUMBER_COLOR, NON_ASSESSABLE_INK, fillUrl } from './SketchPatterns'

const FILLS = [
  { fill: 'stipple', label: 'New 4" (assessable)' },
  { fill: 'white', label: 'New 7" (assessable)' },
  { fill: 'hatch', label: 'Existing / non-assessable' },
  { fill: 'stripes', label: 'Non-assessable area (A1, A2, ...)' },
]

const PREFIX = 'sketch-legend'

// A 14 × 14 swatch, drawn in its own svg
function Swatch({ children }) {
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      {children}
    </svg>
  )
}

/**
 * The sketch's key, a small box always shown in the lower-left of the page (unturned, and taking no clicks): the
 * four fills, the cross on a non-assessable flag, the flag-number circle and the north marker. No props.
 */
export default function SketchLegend() {
  return (
    <div
      aria-label="Sketch legend"
      role="note"
      className="pointer-events-none absolute bottom-2 left-2 rounded border border-gray-300 bg-white/90 px-2 py-1.5 text-[10px] leading-tight text-gray-700 shadow-sm"
    >
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <SketchPatterns prefix={PREFIX} unit={4} />
      </svg>
      <ul className="space-y-0.5">
        {FILLS.map(({ fill, label }) => (
          <li key={fill} className="flex items-center gap-1.5">
            <Swatch>
              <rect x="0.5" y="0.5" width="13" height="13" fill={fillUrl(PREFIX, fill)} stroke="#6b7280" />
            </Swatch>
            <span>{label}</span>
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <Swatch>
            <path d="M3 3 L11 11 M11 3 L3 11" stroke={NON_ASSESSABLE_INK} strokeWidth="1.5" />
          </Swatch>
          <span>Non-assessable</span>
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch>
            <circle cx="7" cy="7" r="6" fill={FLAG_NUMBER_COLOR} />
            <text x="7" y="7.5" textAnchor="middle" dominantBaseline="central" fontSize="8" fill="#ffffff">1</text>
          </Swatch>
          <span>Flag number</span>
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch>
            <path d="M7 1 L7 13 M1 7 L13 7" stroke="#1f2937" strokeWidth="1.5" />
          </Swatch>
          <span>North</span>
        </li>
      </ul>
    </div>
  )
}
