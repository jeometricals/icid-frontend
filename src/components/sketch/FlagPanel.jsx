import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { updateFlag } from '../../services/api'
import { DEFAULT_DIMENSIONS } from '../../lib/flags'
import { degreesToRadians, formatArea, polygonArea, radiansToDegrees } from '../../lib/flagArea'
import {
  FLAG_MARKS, FLAG_NON_ASSESSABLE_REASONS, FLAG_SHAPES, FLAG_THICKNESSES, shapeLabel,
} from '../../data/flagEnums'
import { CORNER_QUADRANT_FIELDS, checkCornerQuadrant } from '../../lib/cornerQuadrant'
import ContractItemPicker from '../ContractItemPicker'
import CornerQuadrantCard from './CornerQuadrantCard'
import { shortDate } from '../../lib/shortDate'

// How long a change waits for the next before it is sent
export const SAVE_DELAY_MS = 300

// The marks a surveyed flag can carry; 'none' belongs to a flag added in the field, and goes with that box
const SURVEYED_MARKS = FLAG_MARKS.filter(mark => mark.value !== 'none')

// Each shape's dimension inputs: the key the backend stores, its label; an arc's angle is typed in degrees
const DIMENSION_FIELDS = {
  rectangle: [['L', 'Length (ft)'], ['W', 'Width (ft)']],
  trapezoid: [['a', 'Top edge a (ft)'], ['b', 'Bottom edge b (ft)'], ['w', 'Width between (ft)']],
  triangle: [['a', 'Leg a (ft)'], ['b', 'Leg b (ft)']],
  arc: [['r', 'Radius (ft)'], ['theta', 'Angle (°)']],
  corner_quadrant: CORNER_QUADRANT_FIELDS.map(([key, label]) => [key, label]),
}

// What a bundled flag can't become: it would have to leave its bundle (Slice Y5)
export const CORNER_QUADRANT_BUNDLED = 'Corner quadrant (not for a bundled flag)'

const text = (value) => (value === null || value === undefined ? '' : String(Number(Number(value).toFixed(4))))

// A shape's dimensions as the inputs hold them (text; an arc's angle in degrees)
function typedDimensions(shape, dimensions) {
  if (shape === 'polygon') return { vertices: dimensions.vertices.map(({ x, y }) => ({ x: text(x), y: text(y) })) }
  if (shape === 'arc') return { r: text(dimensions.r), theta: text(radiansToDegrees(dimensions.theta)) }
  return Object.fromEntries(DIMENSION_FIELDS[shape].map(([key]) => [key, text(dimensions[key])]))
}

const positive = (typed) => (typed.trim() !== '' && Number.isFinite(Number(typed)) && Number(typed) > 0 ? Number(typed) : null)
const finite = (typed) => (typed.trim() !== '' && Number.isFinite(Number(typed)) ? Number(typed) : null)

/** The dimensions as the backend takes them, from what is typed; null while any is missing or out of range. */
export function parseDimensions(shape, typed) {
  if (shape === 'polygon') {
    const vertices = typed.vertices.map(({ x, y }) => ({ x: finite(x), y: finite(y) }))
    if (vertices.length < 3 || vertices.some(({ x, y }) => x === null || y === null)) return null
    return polygonArea(vertices) > 0 ? { vertices } : null
  }
  if (shape === 'corner_quadrant') {
    const { worked, dimensions } = checkCornerQuadrant(typed)
    return worked && !worked.error ? dimensions : null
  }
  const values = Object.fromEntries(DIMENSION_FIELDS[shape].map(([key]) => [key, positive(typed[key])]))
  if (Object.values(values).some(value => value === null)) return null
  if (shape === 'arc') {
    if (values.theta > 360) return null
    return { r: values.r, theta: degreesToRadians(values.theta) }
  }
  return values
}

// What the panel's inputs hold for a flag
function draftOf(flag) {
  const dimensions = Object.fromEntries(Object.keys(DEFAULT_DIMENSIONS).map(shape => [shape, typedDimensions(shape, DEFAULT_DIMENSIONS[shape])]))
  dimensions[flag.shape] = typedDimensions(flag.shape, flag.dimensions)
  return {
    displayOrder: String(flag.display_order),
    shape: flag.shape,
    dimensions,
    rotation: text(flag.rotation ?? 0),
    mark: flag.surveyed_mark,
    addedInField: flag.added_in_field,
    assessable: flag.surveyed_is_assessable,
    reason: flag.surveyed_non_assessable_reason ?? '',
    thickness: flag.surveyed_thickness,
    payItemId: flag.pay_item_id ?? null,
    reported: text(flag.reported_quantity),
    deltaReason: flag.quantity_delta_reason ?? '',
  }
}

/**
 * The selected flag's details, each saved as it changes: every change waits SAVE_DELAY_MS for the next and the
 * changes go together in one PATCH (a pending one is sent at once when another flag is selected). The area shown is
 * the backend's, from the flag it answers with (onSaved). The fields: display order; shape (a new shape starts from
 * its default dimensions, sent with them) and its dimensions (feet; an arc's angle in degrees; a polygon's vertices,
 * three at least; a corner quadrant's six on CornerQuadrantCard, sent together on its Save, and not offered to a
 * bundled flag: Slice Y5); the shape's rotation (degrees); the surveyed mark; "Added in field" (which takes the mark 'none',
 * and gives 'Number only' back when unticked); "Assessable" (unticked, the reason must be picked before anything is
 * sent); the thickness; the pay item (ContractItemPicker); the computed area; the reported quantity (an override,
 * with "Clear override") and the quantity delta reason. Nothing out of range is sent; a refusal shows at the top.
 * A reader sees it all disabled, without Delete.
 * A flag an approved IDR claimed (R1f) says so under its heading, "Claimed by IDR 042 · constructed Oct 3", the IDR
 * a button that opens it (onOpenIdr).
 * Props: flag, contractItems, writer, onSaved(flag), onDelete(flag), onOpenIdr(flag); render it with key={flag.id}.
 */
export default function FlagPanel({ flag, contractItems, writer, onSaved, onDelete, onOpenIdr }) {
  const [draft, setDraft] = useState(() => draftOf(flag))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // The changes waiting to be sent, and their timer; kept in refs so the last ones go out when the panel closes
  const pending = useRef({})
  const timer = useRef(null)
  const saved = useRef(onSaved)
  saved.current = onSaved

  const flush = () => {
    clearTimeout(timer.current)
    timer.current = null
    const body = pending.current
    pending.current = {}
    if (Object.keys(body).length === 0) return
    setSaving(true)
    updateFlag(flag.id, body)
      .then(answer => {
        saved.current(answer)
        setError(null)
      })
      .catch(err => setError(`Couldn't save the flag: ${err.message}`))
      .finally(() => setSaving(false))
  }
  const flushRef = useRef(flush)
  flushRef.current = flush

  useEffect(() => () => flushRef.current(), [])

  const queue = (changes) => {
    Object.assign(pending.current, changes)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => flushRef.current(), SAVE_DELAY_MS)
  }

  const set = (changes) => setDraft(current => ({ ...current, ...changes }))

  // Typed dimensions for the current shape: kept as typed, sent once all of them are in range (a corner quadrant's
  // only on its card's Save)
  const setDimensions = (typed) => {
    set({ dimensions: { ...draft.dimensions, [draft.shape]: typed } })
    if (draft.shape === 'corner_quadrant') return
    const parsed = parseDimensions(draft.shape, typed)
    if (parsed) queue({ shape: draft.shape, dimensions: parsed })
  }

  // A corner quadrant's six, sent at once from its card
  const saveCornerQuadrant = (dimensions) => {
    pending.current = { ...pending.current, shape: 'corner_quadrant', dimensions }
    flush()
  }

  const changeShape = (shape) => {
    const typed = typedDimensions(shape, DEFAULT_DIMENSIONS[shape])
    set({ shape, dimensions: { ...draft.dimensions, [shape]: typed } })
    queue({ shape, dimensions: parseDimensions(shape, typed) })
  }

  const typed = draft.dimensions[draft.shape]
  const dimensionsValid = parseDimensions(draft.shape, typed) !== null
  const orderValid = /^\d+$/.test(draft.displayOrder.trim())
  const rotationValid = finite(draft.rotation) !== null
  const reportedValid = draft.reported.trim() === '' || positive(draft.reported) !== null
  const overridden = flag.reported_quantity !== null && flag.reported_quantity !== undefined

  const hint = (shown, message) => shown && <p role="alert" className="text-xs text-red-600 mt-1">{message}</p>

  return (
    <aside aria-label={`Flag #${flag.display_order}`} className="space-y-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-base font-semibold text-gray-900">Flag #{flag.display_order}</h4>
        <span className="text-xs text-gray-500" aria-live="polite">{saving ? 'Saving...' : ''}</span>
      </div>
      {flag.claimed_by_idr_id && (
        <p className="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2">
          Claimed by{' '}
          <button type="button" onClick={() => onOpenIdr?.(flag)} className="font-semibold underline">
            IDR {flag.claimed_by_idr_number ?? ''}
          </button>
          {flag.constructed_on && ` · constructed ${shortDate(flag.constructed_on)}`}
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <fieldset disabled={!writer} className="space-y-4">
        <div>
          <label htmlFor="flag-order" className="input-label">Display order</label>
          <input
            id="flag-order"
            type="number"
            min="0"
            step="1"
            className="input-field w-28"
            value={draft.displayOrder}
            onChange={(e) => {
              set({ displayOrder: e.target.value })
              if (/^\d+$/.test(e.target.value.trim())) queue({ display_order: Number(e.target.value) })
            }}
          />
          {hint(!orderValid, 'A whole number, 0 or more.')}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="flag-shape" className="input-label">Shape</label>
            <select id="flag-shape" className="input-field" value={draft.shape} onChange={(e) => changeShape(e.target.value)}>
              {FLAG_SHAPES.map(({ value, label }) => {
                const barred = value === 'corner_quadrant' && flag.bundled && draft.shape !== value
                return <option key={value} value={value} disabled={barred}>{barred ? CORNER_QUADRANT_BUNDLED : label}</option>
              })}
            </select>
          </div>
          <div>
            <label htmlFor="flag-rotation" className="input-label">Rotation (°)</label>
            <input
              id="flag-rotation"
              type="number"
              step="any"
              className="input-field"
              value={draft.rotation}
              onChange={(e) => {
                set({ rotation: e.target.value })
                const value = finite(e.target.value)
                if (value !== null) queue({ rotation: value })
              }}
            />
            {hint(!rotationValid, 'A number of degrees.')}
          </div>
        </div>

        <fieldset>
          <legend className="input-label">{shapeLabel(draft.shape)} dimensions</legend>
          {draft.shape === 'corner_quadrant' ? (
            <CornerQuadrantCard typed={typed} onChange={setDimensions} onSave={saveCornerQuadrant} disabled={!writer}
              saving={saving} />
          ) : draft.shape === 'polygon' ? (
            <div className="space-y-2">
              {typed.vertices.map((vertex, index) => (
                <div key={index} className="flex items-center gap-2">
                  {['x', 'y'].map(axis => (
                    <input
                      key={axis}
                      type="number"
                      step="any"
                      aria-label={`Vertex ${index + 1} ${axis} (ft)`}
                      className="input-field w-24"
                      value={vertex[axis]}
                      onChange={(e) => setDimensions({
                        vertices: typed.vertices.map((found, at) => (at === index ? { ...found, [axis]: e.target.value } : found)),
                      })}
                    />
                  ))}
                  <button
                    type="button"
                    aria-label={`Remove vertex ${index + 1}`}
                    disabled={typed.vertices.length <= 3}
                    onClick={() => setDimensions({ vertices: typed.vertices.filter((_, at) => at !== index) })}
                    className="text-gray-400 hover:text-red-600 disabled:opacity-40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDimensions({ vertices: [...typed.vertices, { x: '', y: '' }] })}
                className="inline-flex items-center gap-1 text-construction-700 hover:text-construction-800"
              >
                <Plus className="h-4 w-4" />
                <span>Add vertex</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {DIMENSION_FIELDS[draft.shape].map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={`flag-dim-${key}`} className="text-xs text-gray-600">{label}</label>
                  <input
                    id={`flag-dim-${key}`}
                    type="number"
                    min="0"
                    step="any"
                    className="input-field"
                    value={typed[key]}
                    onChange={(e) => setDimensions({ ...typed, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}
          {draft.shape !== 'corner_quadrant' && hint(!dimensionsValid, draft.shape === 'polygon'
            ? 'Three or more vertices that enclose an area.'
            : draft.shape === 'arc' ? 'A radius above 0 and an angle above 0, at most 360°.' : 'Every length above 0.')}
        </fieldset>

        <p className="text-gray-700">
          Computed area: <span className="font-medium tabular-nums">{formatArea(flag.computed_quantity)}</span>
        </p>

        <fieldset>
          <legend className="input-label">Surveyed mark</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {SURVEYED_MARKS.map(({ value, label }) => (
              <label key={value} className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="flag-mark"
                  value={value}
                  checked={draft.mark === value}
                  disabled={draft.addedInField}
                  onChange={() => { set({ mark: value }); queue({ surveyed_mark: value }) }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <label className="inline-flex items-center gap-1.5 mt-2">
            <input
              type="checkbox"
              checked={draft.addedInField}
              onChange={(e) => {
                const mark = e.target.checked ? 'none' : 'number_only'
                set({ addedInField: e.target.checked, mark })
                queue({ added_in_field: e.target.checked, surveyed_mark: mark })
              }}
            />
            <span>Added in field</span>
          </label>
          {draft.addedInField && <p className="text-xs text-gray-500">A flag added in the field carries no mark.</p>}
        </fieldset>

        <div>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={draft.assessable}
              onChange={(e) => {
                set({ assessable: e.target.checked, reason: '' })
                if (e.target.checked) queue({ surveyed_is_assessable: true, surveyed_non_assessable_reason: null })
              }}
            />
            <span>Assessable</span>
          </label>
          {!draft.assessable && (
            <div className="mt-2">
              <label htmlFor="flag-reason" className="input-label">Non-assessable reason</label>
              <select
                id="flag-reason"
                className="input-field"
                value={draft.reason}
                onChange={(e) => {
                  set({ reason: e.target.value })
                  if (e.target.value) queue({ surveyed_is_assessable: false, surveyed_non_assessable_reason: e.target.value })
                }}
              >
                <option value="">Pick a reason...</option>
                {FLAG_NON_ASSESSABLE_REASONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
              {hint(!draft.reason, 'Pick a reason to save it as non-assessable.')}
            </div>
          )}
        </div>

        <fieldset>
          <legend className="input-label">Surveyed thickness</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {FLAG_THICKNESSES.map(({ value, label }) => (
              <label key={value} className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="flag-thickness"
                  value={value}
                  checked={draft.thickness === value}
                  onChange={() => { set({ thickness: value }); queue({ surveyed_thickness: value }) }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <span className="input-label" id="flag-pay-item-label">Pay item</span>
          <ContractItemPicker
            id="flag-pay-item"
            items={contractItems}
            value={draft.payItemId}
            disabled={!writer}
            onChange={(contractItemId) => { set({ payItemId: contractItemId }); queue({ pay_item_id: contractItemId }) }}
          />
        </div>

        <div>
          <label htmlFor="flag-reported" className="input-label">Reported quantity (SF)</label>
          <div className="flex items-center gap-3">
            <input
              id="flag-reported"
              type="number"
              min="0"
              step="any"
              className="input-field w-32"
              placeholder="Same as computed"
              value={draft.reported}
              onChange={(e) => {
                set({ reported: e.target.value })
                if (e.target.value.trim() === '') queue({ reported_quantity: null })
                else if (positive(e.target.value) !== null) queue({ reported_quantity: Number(e.target.value) })
              }}
            />
            {(overridden || draft.reported.trim() !== '') && (
              <button
                type="button"
                onClick={() => { set({ reported: '', deltaReason: '' }); queue({ reported_quantity: null }) }}
                className="text-construction-700 hover:text-construction-800 underline"
              >
                Clear override
              </button>
            )}
          </div>
          {hint(!reportedValid, 'A quantity above 0, or blank for the computed area.')}
        </div>

        <div>
          <label htmlFor="flag-delta-reason" className="input-label">Quantity delta reason</label>
          <textarea
            id="flag-delta-reason"
            rows={2}
            className="input-field"
            value={draft.deltaReason}
            onChange={(e) => {
              set({ deltaReason: e.target.value })
              queue({ quantity_delta_reason: e.target.value.trim() === '' ? null : e.target.value })
            }}
          />
        </div>
      </fieldset>

      {writer && (
        <button
          type="button"
          onClick={() => onDelete(flag)}
          className="btn-secondary inline-flex items-center space-x-2 text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete flag</span>
        </button>
      )}
    </aside>
  )
}
