import { useState } from 'react'
import Modal from './Modal'
import { updatePirTitleBlock } from '../services/api'

export const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
export const FIELDS = ['contract_no', 'date_notice_issued', 'date_excavated', 'date_constructed', 'north_bearing',
  'cross_street_left', 'cross_street_right', 'frontage_street', 'tax_map_width_ft', 'cc_curb_to_curb_ft']
// The streets round the Construction Report's sketch (R1h.3): up the left and right sides, and the frontage under it
export const STREET_FIELDS = [
  ['cross_street_left', 'Left street'], ['cross_street_right', 'Right street'], ['frontage_street', 'Frontage street (bottom)'],
]
// The widths the sketch draws at scale: the lot between the PLs along the top, the curb-to-curb along the bottom
export const WIDTH_FIELDS = [['tax_map_width_ft', 'Tax map width (ft)'], ['cc_curb_to_curb_ft', 'Curb to curb, CC (ft)']]
export const MAX_STREET_LENGTH = 60
export const DEMO_TITLE = 'Demo mode: PIRs are read-only'
export const ORDER_WARNING = 'Date Excavated is after Date Constructed. Saving is still allowed.'

// The form's values from a title block: text for the inputs (a width as its number's text), '' for a field not set
const valuesOf = (block) => Object.fromEntries(FIELDS.map(field => [field, block?.[field] == null ? '' : String(block[field])]))

/**
 * The title-block editor (R1h.2), a dialog: "Title block — Page 1" with the fields the Construction Report prints
 * (Contract No., the three dates, North Bearing, and R1h.3's Streets group: the left, right and frontage streets and
 * the tax-map and curb-to-curb widths, sent as typed for the backend to check). Save sends only the fields changed ('' as null, which clears
 * one) and hands the saved block to onSaved; it is off until something changes. A refusal shows under Save and the
 * dialog stays open; a 404 (the PIR is gone) goes to onGone instead. A soft warning shows when Date Excavated is after
 * Date Constructed. A reader (a demo user, or anyone the page doesn't let write) sees the fields disabled and no Save.
 * Props: pirId, titleBlock (the current values), canEdit, onSaved(block), onGone(message), onClose.
 */
export default function TitleBlockEditor({ pirId, titleBlock, canEdit, onSaved, onGone, onClose }) {
  const initial = valuesOf(titleBlock)
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const changes = Object.fromEntries(FIELDS.filter(field => values[field].trim() !== initial[field])
    .map(field => [field, values[field].trim() === '' ? null : values[field].trim()]))
  const changed = Object.keys(changes).length > 0
  const outOfOrder = values.date_excavated && values.date_constructed && values.date_excavated > values.date_constructed

  const set = (field) => (e) => setValues(current => ({ ...current, [field]: e.target.value }))

  const save = async () => {
    if (busy || !changed || !canEdit) return
    setBusy(true)
    setError(null)
    try {
      onSaved(await updatePirTitleBlock(pirId, changes))
    } catch (err) {
      if (err.status === 404) {
        onGone('PIR not found')
        return
      }
      setError(err.message)
      setBusy(false)
    }
  }

  const disabled = busy || !canEdit
  const dateField = (field, label) => (
    <div>
      <label htmlFor={`title-block-${field}`} className="input-label">{label}</label>
      <input id={`title-block-${field}`} type="date" className="input-field" value={values[field]} disabled={disabled}
        onChange={set(field)} />
    </div>
  )

  return (
    <Modal
      title="Title block — Page 1"
      onClose={onClose}
      busy={busy}
      footer={
        <div className="flex flex-col items-end gap-2 w-full">
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
              {canEdit ? 'Cancel' : 'Close'}
            </button>
            {canEdit && (
              <button type="button" onClick={save} disabled={busy || !changed} className="btn-primary">
                {busy ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
          {error && <p role="alert" className="text-sm text-red-600 text-right">{error}</p>}
        </div>
      }
    >
      <div className="space-y-4">
        {!canEdit && <p className="text-sm text-gray-600">{DEMO_TITLE}</p>}
        <div>
          <label htmlFor="title-block-contract_no" className="input-label">Contract No.</label>
          <input id="title-block-contract_no" type="text" maxLength={200} className="input-field"
            value={values.contract_no} disabled={disabled} onChange={set('contract_no')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {dateField('date_notice_issued', 'Date Notice Issued')}
          {dateField('date_excavated', 'Date Excavated')}
          {dateField('date_constructed', 'Date Constructed')}
        </div>
        {outOfOrder && <p className="text-sm text-amber-700">{ORDER_WARNING}</p>}
        <div>
          <label htmlFor="title-block-north_bearing" className="input-label">North Bearing</label>
          <select id="title-block-north_bearing" className="input-field w-40" value={values.north_bearing}
            disabled={disabled} onChange={set('north_bearing')}>
            <option value="">—</option>
            {COMPASS_POINTS.map(point => <option key={point} value={point}>{point}</option>)}
          </select>
        </div>
        <fieldset className="space-y-3">
          <legend className="input-label">Streets</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            {STREET_FIELDS.map(([field, label]) => (
              <div key={field}>
                <label htmlFor={`title-block-${field}`} className="input-label">
                  {label} <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <input id={`title-block-${field}`} type="text" maxLength={MAX_STREET_LENGTH} className="input-field"
                  value={values[field]} disabled={disabled} onChange={set(field)} />
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {WIDTH_FIELDS.map(([field, label]) => (
              <div key={field}>
                <label htmlFor={`title-block-${field}`} className="input-label">
                  {label} <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <input id={`title-block-${field}`} type="text" inputMode="decimal" className="input-field"
                  value={values[field]} disabled={disabled} onChange={set(field)} />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">The top of the sketch is the property line (PL).</p>
        </fieldset>
      </div>
    </Modal>
  )
}
