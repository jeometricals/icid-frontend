import { FLAG_SHAPES, FLAG_THICKNESSES } from '../../data/flagEnums'
import { thicknessColor } from '../../lib/flags'

// A small outline of each shape for its button, in a 20 × 20 box
const ICONS = {
  rectangle: <rect x="3" y="5" width="14" height="10" />,
  trapezoid: <polygon points="6,5 14,5 18,15 2,15" />,
  triangle: <polygon points="3,3 3,17 17,17" />,
  polygon: <polygon points="10,2 18,8 15,17 5,17 2,8" />,
  arc: <path d="M2 14 A9 9 0 0 1 18 14 Z" />,
}

/**
 * The sketch's shape tools and its colour legend. One toggle button per shape (rectangle, trapezoid, right
 * triangle, polygon, arc); picking one arms it (clicking the page then places that shape), picking it again or Esc
 * disarms it. The legend gives the colour each surveyed thickness is drawn in.
 * Props: activeShape (or null), onPick(shape or null), disabled, disabledReason (shown under the buttons).
 */
export default function ShapeToolbar({ activeShape, onPick, disabled = false, disabledReason = null }) {
  return (
    <div className="space-y-2">
      <div role="toolbar" aria-label="Shapes" className="flex flex-wrap items-center gap-2">
        {FLAG_SHAPES.map(({ value, label }) => {
          const active = activeShape === value
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onPick(active ? null : value)}
              title={`${label}: click the page to place one`}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                active
                  ? 'border-construction-600 bg-construction-50 text-construction-800'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                {ICONS[value]}
              </svg>
              <span>{label}</span>
            </button>
          )
        })}
        <ul aria-label="Thickness colours" className="flex flex-wrap items-center gap-3 ml-2 text-xs text-gray-600">
          {FLAG_THICKNESSES.map(({ value, label }) => (
            <li key={value} className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: thicknessColor(value) }} aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
      {disabled && disabledReason && <p className="text-xs text-gray-500">{disabledReason}</p>}
    </div>
  )
}
