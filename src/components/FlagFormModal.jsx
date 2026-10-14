import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import Modal from './Modal'
import ContractItemPicker from './ContractItemPicker'
import { formErrors } from '../lib/formErrors'
import { computeArea, degreesToRadians, formatArea, polygonArea, radiansToDegrees } from '../lib/flagArea'
import { FLAG_MARKS, FLAG_NON_ASSESSABLE_REASONS, FLAG_SHAPES, FLAG_THICKNESSES } from '../data/flagEnums'

export const MIN_VERTICES = 3

// The fields a 422 can name, so its message sits under the field
const KEYS = [
  'display_order', 'shape', 'dimensions', 'surveyed_mark', 'surveyed_is_assessable', 'surveyed_non_assessable_reason',
  'surveyed_thickness', 'added_in_field', 'pay_item_id', 'reported_quantity', 'quantity_delta_reason',
]

export const MARK_RULE = "Only a flag added in the field has the mark None, and such a flag always has it."

// Each shape's dimension inputs: the key the backend stores and the label the form shows. An arc's angle is typed
// in degrees and stored in radians.
export const SHAPE_FIELDS = {
  rectangle: [{ key: 'L', label: 'Length (ft)' }, { key: 'W', label: 'Width (ft)' }],
  trapezoid: [
    { key: 'a', label: 'Edge a (ft)' }, { key: 'b', label: 'Edge b (ft)' }, { key: 'w', label: 'Perpendicular width w (ft)' },
  ],
  triangle: [{ key: 'a', label: 'Leg a (ft)' }, { key: 'b', label: 'Leg b (ft)' }],
  arc: [{ key: 'r', label: 'Radius r (ft)' }, { key: 'thetaDegrees', label: 'Central angle θ (degrees)' }],
}

const blankVertex = () => ({ x: '', y: '' })

// The dimension inputs as typed, one set per shape, so switching shapes and back keeps what was typed
const blankDimensions = () => ({
  rectangle: { L: '', W: '' },
  trapezoid: { a: '', b: '', w: '' },
  triangle: { a: '', b: '' },
  polygon: { vertices: Array.from({ length: MIN_VERTICES }, blankVertex) },
  arc: { r: '', thetaDegrees: '' },
})

const asText = (value) => (value === null || value === undefined ? '' : String(value))

// What the form starts with: the flag being edited, or a new flag at the next display order
function startingValues(initial, nextDisplayOrder) {
  const dimensions = blankDimensions()
  if (initial) {
    const stored = initial.dimensions
    if (initial.shape === 'polygon') {
      dimensions.polygon = { vertices: stored.vertices.map(vertex => ({ x: asText(vertex.x), y: asText(vertex.y) })) }
    } else if (initial.shape === 'arc') {
      dimensions.arc = { r: asText(stored.r), thetaDegrees: asText(Number(radiansToDegrees(stored.theta).toFixed(4))) }
    } else {
      dimensions[initial.shape] = Object.fromEntries(Object.keys(dimensions[initial.shape]).map(key => [key, asText(stored[key])]))
    }
  }
  return {
    display_order: asText(initial ? initial.display_order : nextDisplayOrder),
    shape: initial?.shape ?? '',
    dimensions,
    surveyed_mark: initial?.surveyed_mark ?? '',
    added_in_field: initial?.added_in_field ?? false,
    surveyed_is_assessable: initial?.surveyed_is_assessable ?? true,
    surveyed_non_assessable_reason: initial?.surveyed_non_assessable_reason ?? '',
    surveyed_thickness: initial?.surveyed_thickness ?? '',
    pay_item_id: initial?.pay_item_id ?? null,
    reported_quantity: asText(initial?.reported_quantity),
    quantity_delta_reason: initial?.quantity_delta_reason ?? '',
  }
}

// A typed length is usable when it is a finite number above zero; a coordinate when it is any finite number
const length = (typed) => (typed.trim() !== '' && Number.isFinite(Number(typed)) && Number(typed) > 0 ? Number(typed) : null)
const coordinate = (typed) => (typed.trim() !== '' && Number.isFinite(Number(typed)) ? Number(typed) : null)

/**
 * A shape's dimensions as the backend stores them, from what was typed: lengths above zero; a polygon of at least
 * three vertices enclosing an area; an arc's angle above 0° and at most 360°, in radians. Null when any is missing
 * or doesn't fit.
 */
export function storedDimensions(shape, typed) {
  if (shape === 'polygon') {
    const vertices = typed.vertices.map(vertex => ({ x: coordinate(vertex.x), y: coordinate(vertex.y) }))
    if (vertices.length < MIN_VERTICES || vertices.some(vertex => vertex.x === null || vertex.y === null)) return null
    return polygonArea(vertices) > 0 ? { vertices } : null
  }
  if (shape === 'arc') {
    const r = length(typed.r)
    const degrees = length(typed.thetaDegrees)
    if (r === null || degrees === null || degrees > 360) return null
    return { r, theta: degreesToRadians(degrees) }
  }
  if (!SHAPE_FIELDS[shape]) return null
  const dimensions = Object.fromEntries(SHAPE_FIELDS[shape].map(({ key }) => [key, length(typed[key])]))
  return Object.values(dimensions).some(value => value === null) ? null : dimensions
}

// The flag as it would be sent, from the form; null where a required value is missing
function payloadOf(values) {
  const dimensions = storedDimensions(values.shape, values.dimensions[values.shape] ?? {})
  const reported = values.reported_quantity.trim()
  return {
    display_order: /^\d+$/.test(values.display_order.trim()) ? Number(values.display_order.trim()) : null,
    shape: values.shape || null,
    dimensions,
    surveyed_mark: values.surveyed_mark || null,
    surveyed_is_assessable: values.surveyed_is_assessable,
    surveyed_non_assessable_reason: values.surveyed_is_assessable ? null : (values.surveyed_non_assessable_reason || null),
    surveyed_thickness: values.surveyed_thickness || null,
    added_in_field: values.added_in_field,
    pay_item_id: values.pay_item_id,
    reported_quantity: reported === '' ? null : Number(reported),
    quantity_delta_reason: values.quantity_delta_reason.trim() || null,
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Lets a project member add a flag to a PIR, or edit one. Display order (the next one, to start), shape and the
 * shape's dimensions in feet (rectangle L × W; trapezoid edges a, b and width w; right triangle legs a, b; polygon
 * three or more vertices x, y, rows added and removed; arc radius r and central angle θ in degrees), with the
 * computed area previewed as they change. Then the surveyed mark, "Added in field" (the backend's rule: the mark
 * is None exactly when the flag was added in the field), Assessable, and when it isn't, the reason; thickness; the
 * pay item (optional, from the project's catalog); and a reported quantity (optional, an override of the computed
 * area) with, when it differs, the reason for the difference. Save is off until every required value is in and
 * fits and, when editing, something changed. Adding sends the whole flag; editing only what changed (a new shape
 * goes with its dimensions; a cleared reported quantity reverts to the computed area). The caller runs the save:
 * it sets busy while it works and error (the thrown error) if it failed, and the form keeps what was typed; a
 * 422's messages sit under the fields they name, anything else below the form.
 * Props: mode ('add' | 'edit'), initial (the flag being edited), nextDisplayOrder (for a new flag), contractItems
 * (the project's, for the pay-item picker), onSave(values), onCancel, busy, error.
 */
export default function FlagFormModal({
  mode = 'add', initial, nextDisplayOrder = 1, contractItems = [], onSave, onCancel, busy = false, error = null,
}) {
  const [values, setValues] = useState(() => startingValues(initial, nextDisplayOrder))
  const [before] = useState(() => payloadOf(startingValues(initial, nextDisplayOrder)))

  const set = (key, value) => setValues(current => ({ ...current, [key]: value }))
  const setDimension = (key, value) => setValues(current => ({
    ...current,
    dimensions: { ...current.dimensions, [current.shape]: { ...current.dimensions[current.shape], [key]: value } },
  }))
  const setVertices = (change) => setValues(current => ({
    ...current,
    dimensions: { ...current.dimensions, polygon: { vertices: change(current.dimensions.polygon.vertices) } },
  }))

  const adding = mode === 'add'
  const payload = payloadOf(values)
  const area = payload.dimensions ? computeArea(payload.shape, payload.dimensions) : null
  const markBroken = Boolean(payload.surveyed_mark) && (payload.surveyed_mark === 'none') !== payload.added_in_field
  const reportedTyped = values.reported_quantity.trim() !== ''
  const reportedFits = !reportedTyped || (Number.isFinite(payload.reported_quantity) && payload.reported_quantity > 0)
  const differs = reportedTyped && reportedFits && area !== null && payload.reported_quantity !== area
  if (!differs) payload.quantity_delta_reason = null

  const changes = Object.fromEntries(Object.keys(payload).filter(key => !same(payload[key], before[key])).map(key => [key, payload[key]]))
  if ('shape' in changes) changes.dimensions = payload.dimensions
  const ready = payload.display_order !== null && payload.shape && payload.dimensions && payload.surveyed_mark
    && !markBroken && (payload.surveyed_is_assessable || payload.surveyed_non_assessable_reason)
    && payload.surveyed_thickness && reportedFits && (adding || Object.keys(changes).length > 0)

  const { fields, general } = formErrors(error, KEYS, { field: null, message: error?.message })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (busy || !ready) return
    onSave(adding ? payload : changes)
  }

  const fieldError = (key) => fields[key] && (
    <p id={`flag-${key}-error`} role="alert" className="text-sm text-red-600 mt-1">{fields[key]}</p>
  )

  const typed = values.dimensions[values.shape]

  return (
    <Modal
      title={adding ? 'Add flag' : 'Edit flag'}
      onClose={onCancel}
      busy={busy}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Cancel</button>
          <button type="submit" form="flag-form" disabled={busy || !ready} className="btn-primary">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="flag-form" onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="flag-display-order" className="input-label">Display order</label>
            <input
              id="flag-display-order"
              type="number"
              min="0"
              step="1"
              className="input-field"
              value={values.display_order}
              disabled={busy}
              onChange={(e) => set('display_order', e.target.value)}
            />
            {fieldError('display_order')}
          </div>
          <div>
            <label htmlFor="flag-shape" className="input-label">Shape</label>
            <select
              id="flag-shape"
              className="input-field"
              value={values.shape}
              disabled={busy}
              onChange={(e) => set('shape', e.target.value)}
            >
              <option value="" disabled>Choose a shape</option>
              {FLAG_SHAPES.map(shape => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
            </select>
            {fieldError('shape')}
          </div>
        </div>

        {values.shape && (
          <fieldset className="border border-gray-200 rounded-md p-3 space-y-3">
            <legend className="text-sm font-medium text-gray-700 px-1">Dimensions</legend>
            {values.shape === 'polygon' ? (
              <>
                {typed.vertices.map((vertex, index) => (
                  // A vertex has no identity but its place
                  <div key={index} className="flex flex-wrap items-end gap-3">
                    <span className="text-sm text-gray-700 w-20 pb-2">Vertex {index + 1}</span>
                    {['x', 'y'].map(axis => (
                      <div key={axis}>
                        <label htmlFor={`flag-vertex-${index}-${axis}`} className="input-label">{axis} (ft)</label>
                        <input
                          id={`flag-vertex-${index}-${axis}`}
                          type="number"
                          step="any"
                          className="input-field w-28"
                          value={vertex[axis]}
                          disabled={busy}
                          onChange={(e) => setVertices(vertices => vertices.map((found, at) => (
                            at === index ? { ...found, [axis]: e.target.value } : found
                          )))}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setVertices(vertices => vertices.filter((_, at) => at !== index))}
                      disabled={busy || typed.vertices.length <= MIN_VERTICES}
                      aria-label={`Remove vertex ${index + 1}`}
                      className="btn-secondary p-2 mb-0.5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setVertices(vertices => [...vertices, blankVertex()])}
                  disabled={busy}
                  className="btn-secondary inline-flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add vertex</span>
                </button>
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SHAPE_FIELDS[values.shape].map(({ key, label }) => (
                  <div key={key}>
                    <label htmlFor={`flag-dimension-${key}`} className="input-label">{label}</label>
                    <input
                      id={`flag-dimension-${key}`}
                      type="number"
                      min="0"
                      step="any"
                      className="input-field"
                      value={typed[key]}
                      disabled={busy}
                      onChange={(e) => setDimension(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
            <p aria-live="polite" className="text-sm text-gray-700">
              Computed area: <span className="font-medium">{area === null ? '—' : formatArea(area)}</span>
            </p>
            {fieldError('dimensions')}
          </fieldset>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="flag-mark" className="input-label">Surveyed mark</label>
            <select
              id="flag-mark"
              className="input-field"
              value={values.surveyed_mark}
              disabled={busy}
              aria-describedby={markBroken ? 'flag-mark-rule' : undefined}
              onChange={(e) => set('surveyed_mark', e.target.value)}
            >
              <option value="" disabled>Choose a mark</option>
              {FLAG_MARKS.map(mark => <option key={mark.value} value={mark.value}>{mark.label}</option>)}
            </select>
            {fieldError('surveyed_mark')}
          </div>
          <div>
            <label htmlFor="flag-thickness" className="input-label">Thickness</label>
            <select
              id="flag-thickness"
              className="input-field"
              value={values.surveyed_thickness}
              disabled={busy}
              onChange={(e) => set('surveyed_thickness', e.target.value)}
            >
              <option value="" disabled>Choose a thickness</option>
              {FLAG_THICKNESSES.map(thickness => <option key={thickness.value} value={thickness.value}>{thickness.label}</option>)}
            </select>
            {fieldError('surveyed_thickness')}
          </div>
        </div>

        <div className="space-y-2">
          <label className="inline-flex items-center space-x-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={values.added_in_field}
              disabled={busy}
              onChange={(e) => set('added_in_field', e.target.checked)}
            />
            <span>Added in field</span>
          </label>
          {markBroken && <p id="flag-mark-rule" role="alert" className="text-sm text-red-600">{MARK_RULE}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <label className="inline-flex items-center space-x-2 text-sm text-gray-700 sm:pt-7">
            <input
              type="checkbox"
              checked={values.surveyed_is_assessable}
              disabled={busy}
              onChange={(e) => set('surveyed_is_assessable', e.target.checked)}
            />
            <span>Assessable</span>
          </label>
          {!values.surveyed_is_assessable && (
            <div>
              <label htmlFor="flag-reason" className="input-label">Non-assessable reason</label>
              <select
                id="flag-reason"
                className="input-field"
                value={values.surveyed_non_assessable_reason}
                disabled={busy}
                onChange={(e) => set('surveyed_non_assessable_reason', e.target.value)}
              >
                <option value="" disabled>Choose a reason</option>
                {FLAG_NON_ASSESSABLE_REASONS.map(reason => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
              </select>
              {fieldError('surveyed_non_assessable_reason')}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="flag-pay-item" className="input-label">Pay item <span className="text-gray-500 font-normal">(optional)</span></label>
          <ContractItemPicker
            id="flag-pay-item"
            items={contractItems}
            value={values.pay_item_id}
            onChange={(contractItemId) => set('pay_item_id', contractItemId)}
            disabled={busy}
          />
          {fieldError('pay_item_id')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="flag-reported" className="input-label">
              Reported quantity (SF) <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              id="flag-reported"
              type="number"
              min="0"
              step="0.01"
              className="input-field"
              placeholder="Same as computed"
              value={values.reported_quantity}
              disabled={busy}
              onChange={(e) => set('reported_quantity', e.target.value)}
            />
            {!reportedFits && <p role="alert" className="text-sm text-red-600 mt-1">A reported quantity is above zero.</p>}
            {fieldError('reported_quantity')}
          </div>
          {differs && (
            <div>
              <label htmlFor="flag-delta-reason" className="input-label">
                Quantity delta reason <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                id="flag-delta-reason"
                type="text"
                className="input-field"
                value={values.quantity_delta_reason}
                disabled={busy}
                onChange={(e) => set('quantity_delta_reason', e.target.value)}
              />
              {fieldError('quantity_delta_reason')}
            </div>
          )}
        </div>

        {general && <p role="alert" className="text-sm text-red-600">{general}</p>}
      </form>
    </Modal>
  )
}
