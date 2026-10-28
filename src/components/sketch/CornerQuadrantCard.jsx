import { useEffect, useState } from 'react'
import { CORNER_QUADRANT_FIELDS, checkCornerQuadrant } from '../../lib/cornerQuadrant'

// How long the preview waits for the next keystroke before it works the figures out again
export const PREVIEW_DELAY_MS = 150

// The inputs by row of the OE sheet: the arc, the triangle, the correction rectangle
const ROWS = [['Arc', ['H', 'C']], ['Triangle', ['R1', 'R2']], ['Correction', ['A', 'B']]]
const LABELS = Object.fromEntries(CORNER_QUADRANT_FIELDS.map(([key, label]) => [key, label]))

const feet = (value) => Number(value).toFixed(2)

/**
 * The OE sheet's corner-quadrant diagram, inline: the right triangle (legs R₁ and R₂), the arc segment A1 over its
 * hypotenuse (height H on chord C), and the correction rectangle A × B at its inner corner.
 */
export function CornerQuadrantDiagram() {
  return (
    <svg viewBox="0 0 220 150" role="img" aria-label="Corner quadrant: arc segment A1 (H, C), triangle legs R1 and R2, correction rectangle A by B"
      data-testid="corner-quadrant-diagram" className="w-full max-w-xs text-gray-700">
      <path d="M30 20 V100 H62 V130 H150 A105 105 0 0 0 30 20 Z" fill="#eff6ff" stroke="currentColor" strokeWidth="1.5" />
      <line x1="30" y1="20" x2="150" y2="130" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" />
      <line x1="90" y1="75" x2="122" y2="44" stroke="#2563eb" strokeWidth="1" />
      <rect x="30" y="100" width="32" height="30" fill="#fee2e2" stroke="#dc2626" strokeWidth="1" />
      <g fontSize="11" fontFamily="Arial, sans-serif" fill="currentColor">
        <text x="112" y="58" fontWeight="700">A1</text>
        <text x="96" y="66" fill="#2563eb">H</text>
        <text x="76" y="88" textAnchor="middle">C</text>
        <text x="100" y="144" textAnchor="middle">R₁</text>
        <text x="16" y="64">R₂</text>
        <text x="46" y="144" textAnchor="middle" fill="#dc2626">A</text>
        <text x="66" y="118" fill="#dc2626">B</text>
      </g>
    </svg>
  )
}

/**
 * A corner-quadrant flag's measure (Slice Y5): the OE sheet's diagram, its six inputs in a two-column grid (H and C,
 * the arc; R1 and R2, the triangle; A and B, the correction rectangle, "Enter 0 if none"), each checked as it is typed
 * (feet to two places; above 0, or 0 or more for A and B), and the working underneath, worked out again PREVIEW_DELAY_MS
 * after the last keystroke: H/C, its coefficient, the arc segment, the triangle and the correction (each cut to the cent,
 * as the OE sheet prints them) and the outer area (the exact sum, halves up). "Save measurement" stays off until all six
 * are right and the area comes to more than 0.
 * Props: typed ({H, C, R1, R2, A, B} as text), onChange(typed), onSave(dimensions), disabled, saving.
 */
export default function CornerQuadrantCard({ typed, onChange, onSave, disabled = false, saving = false }) {
  const now = checkCornerQuadrant(typed)
  const [preview, setPreview] = useState(now)

  const key = CORNER_QUADRANT_FIELDS.map(([field]) => typed[field]).join('|')
  useEffect(() => {
    const timer = setTimeout(() => setPreview(checkCornerQuadrant(typed)), PREVIEW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = !disabled && !saving && now.worked !== null && !now.worked.error
  const worked = preview.worked && !preview.worked.error ? preview.worked : null

  return (
    <div className="space-y-3" data-testid="corner-quadrant-card">
      <CornerQuadrantDiagram />
      <div className="space-y-2">
        {ROWS.map(([row, keys]) => (
          <div key={row}>
            <p className="text-xs font-medium text-gray-700">
              {row}{row === 'Correction' && <span className="font-normal text-gray-500"> · Enter 0 if none</span>}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {keys.map(field => (
                <div key={field}>
                  <label htmlFor={`cq-${field}`} className="text-xs text-gray-600">{LABELS[field]}</label>
                  <input
                    id={`cq-${field}`}
                    type="text"
                    inputMode="decimal"
                    className="input-field"
                    value={typed[field]}
                    disabled={disabled}
                    aria-invalid={Boolean(now.problems[field])}
                    onChange={(e) => onChange({ ...typed, [field]: e.target.value })}
                  />
                  {now.problems[field] && (
                    <p role="alert" className="text-xs text-red-600 mt-1">{now.problems[field]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {now.worked?.error && <p role="alert" className="text-xs text-red-600">{now.worked.error}</p>}

      <dl data-testid="corner-quadrant-preview" aria-live="polite"
        className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-0.5 whitespace-nowrap rounded-md bg-gray-50 px-2 py-2 text-[11px] tabular-nums text-gray-700">
        {worked ? (
          <>
            <dt>H / C</dt><dd>{feet(typed.H)} / {feet(typed.C)}</dd><dd className="text-right">{worked.ratio.toFixed(2)}</dd>
            <dt>Coef ({worked.ratio.toFixed(2)})</dt><dd /><dd className="text-right">{worked.coef.toFixed(4)}</dd>
            <dt>Arc segment</dt><dd>{worked.coef.toFixed(4)} × {feet(typed.C)} × {feet(typed.H)}</dd>
            <dd className="text-right">{worked.rows.arc.toFixed(2)}</dd>
            <dt>Triangle</dt><dd>0.5 × {feet(typed.R1)} × {feet(typed.R2)}</dd>
            <dd className="text-right">{worked.rows.triangle.toFixed(2)}</dd>
            <dt>Correction</dt><dd>{feet(typed.A)} × {feet(typed.B)}</dd>
            <dd className="text-right">−{worked.rows.correction.toFixed(2)}</dd>
            <dt className="col-span-2 border-t border-gray-300 pt-1 font-semibold">Outer area</dt>
            <dd className="border-t border-gray-300 pt-1 text-right font-semibold" data-testid="corner-quadrant-area">
              {worked.area.toFixed(2)} sq ft
            </dd>
          </>
        ) : (
          <dt className="col-span-3 text-gray-500">Enter all six to work out the area.</dt>
        )}
      </dl>

      {!disabled && (
        <button type="button" className="btn-primary text-sm" disabled={!canSave} onClick={() => onSave(now.dimensions)}>
          {saving ? 'Saving...' : 'Save measurement'}
        </button>
      )}
    </div>
  )
}
