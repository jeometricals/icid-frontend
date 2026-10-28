import { Plus, X } from 'lucide-react'
import { MAX_RECTANGLES, outerArea } from '../../lib/bundleGeometry'

const letter = (index) => String.fromCharCode(65 + index)

/** The rectangles as the backend takes them ([{L, W}] as numbers), from what is typed. */
export const parseRectangles = (typed) => typed.map(({ L, W }) => ({ L: Number(L), W: Number(W) }))

/** A blank rectangle, as the editor holds one. */
export const BLANK_RECTANGLE = { L: '', W: '' }

/**
 * A bundle's measured outline (Slices Y4a): 1 to 3 rectangles, each a length and a width in feet, with "Add rectangle"
 * and a remove button on each when there is more than one; each rectangle's area and the total underneath.
 * Props: rectangles ([{L, W}] as typed text), onChange(rectangles), disabled.
 */
export default function RectanglesEditor({ rectangles, onChange, disabled = false }) {
  const set = (index, key, value) => onChange(rectangles.map((r, i) => (i === index ? { ...r, [key]: value } : r)))
  const valid = rectangles.every(({ L, W }) => Number(L) > 0 && Number(W) > 0)
  return (
    <div className="space-y-2" data-testid="rectangles-editor">
      {rectangles.map((rectangle, index) => (
        <div key={index} className="flex items-end gap-2">
          <span className="w-6 pb-2 text-sm font-medium text-gray-700">{letter(index)}</span>
          {['L', 'W'].map(key => (
            <label key={key} className="flex-1 text-xs text-gray-600">
              {key === 'L' ? 'Length (ft)' : 'Width (ft)'}
              <input
                type="number"
                min="0"
                step="0.01"
                value={rectangle[key]}
                disabled={disabled}
                aria-label={`Rectangle ${letter(index)} ${key === 'L' ? 'length' : 'width'} (ft)`}
                onChange={(e) => set(index, key, e.target.value)}
                className="input-field mt-1 w-full"
              />
            </label>
          ))}
          <span className="w-20 pb-2 text-right text-sm text-gray-700">
            {Number(rectangle.L) > 0 && Number(rectangle.W) > 0 ? `${outerArea([rectangle]).toFixed(2)} SF` : '—'}
          </span>
          {rectangles.length > 1 && (
            <button type="button" disabled={disabled} aria-label={`Remove rectangle ${letter(index)}`}
              onClick={() => onChange(rectangles.filter((_, i) => i !== index))}
              className="mb-1.5 rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        {rectangles.length < MAX_RECTANGLES ? (
          <button type="button" disabled={disabled} onClick={() => onChange([...rectangles, BLANK_RECTANGLE])}
            className="inline-flex items-center gap-1 text-sm font-medium text-construction-700 hover:underline disabled:text-gray-400">
            <Plus className="h-4 w-4" />Add rectangle
          </button>
        ) : <span />}
        <span className="text-sm font-medium text-gray-900" data-testid="outline-total">
          Outline: {valid ? `${outerArea(rectangles).toFixed(2)} SF` : '—'}
        </span>
      </div>
    </div>
  )
}
