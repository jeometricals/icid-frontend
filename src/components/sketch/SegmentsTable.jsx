import { useState } from 'react'
import { updateSegment } from '../../services/api'
import { segmentTypeLabel } from '../../data/flagEnums'
import { contractItemLabel } from '../ContractItemPicker'

// A bid unit without its periods and spaces, in capitals ("L.F." and "LF" are both LF)
const bareUnit = (unit) => (unit ?? '').replace(/[.\s]/g, '').toUpperCase()

const feet = (value) => Number(value).toFixed(2)

const text = (value) => (value === null || value === undefined ? '' : String(Number(Number(value).toFixed(4))))

// A reported length as typed: 0 or more (unlike a flag's, an override to 0 is allowed); null while it isn't one
const nonNegative = (typed) => (typed.trim() !== '' && Number.isFinite(Number(typed)) && Number(typed) >= 0 ? Number(typed) : null)

// What a segment's length counts as: its reported length, else its drawn one
const effectiveLength = (segment) => segment.effective_length_ft ?? segment.reported_length_ft ?? segment.length_ft

/**
 * One segment's Reported cell (Slice X.2): for a writer, an input holding its reported length in LF (blank: the drawn
 * length counts) with "Clear override", as a flag's panel has it. A change is saved when the input loses focus or on
 * Enter; blank clears the override (the backend clears its reason too). A value below 0 isn't sent; a refusal shows
 * under the input and the typed value stays. A reader sees the reported length, or "—".
 * Props: segment, writer, onSaved(segment).
 */
function ReportedCell({ segment, writer, onSaved }) {
  const [typed, setTyped] = useState(text(segment.reported_length_ft))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const overridden = segment.reported_length_ft !== null && segment.reported_length_ft !== undefined
  const valid = typed.trim() === '' || nonNegative(typed) !== null

  if (!writer) return overridden ? `${feet(segment.reported_length_ft)} LF` : '—'

  const save = async (value) => {
    if (value === (overridden ? Number(segment.reported_length_ft) : null)) return
    setSaving(true)
    setError(null)
    try {
      onSaved(await updateSegment(segment.segment_id, { reported_length_ft: value }))
    } catch (err) {
      setError(`Couldn't save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }
  const commit = () => {
    if (typed.trim() === '') save(null)
    else if (valid) save(nonNegative(typed))
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min="0"
          step="any"
          className="input-field w-28"
          placeholder="Same as drawn"
          aria-label="Reported length (LF)"
          value={typed}
          disabled={saving}
          onChange={e => setTyped(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
        {(overridden || typed.trim() !== '') && (
          <button
            type="button"
            disabled={saving}
            onClick={() => { setTyped(''); save(null) }}
            className="text-construction-700 hover:text-construction-800 underline"
          >
            Clear override
          </button>
        )}
      </div>
      {!valid && <p role="alert" className="text-xs text-red-600 mt-1">A length of 0 or more, or blank for the drawn length.</p>}
      {error && <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

/**
 * Every live curb segment of a PIR, across its pages, as a table under the sketch workspace's flag list (Slice X.1),
 * titled "Curb segments": Page, Segment # (1..n in drawing order: by page, then as the PIR lists them), Shape (the
 * segment type in words), Dimensions ("34.25 ft · 3 runs" as drawn, "no scale" while its page has none), Pay item
 * ("item no — description" from the project's contract items, "—" for none, "Not in the catalog"), Reported (Slice
 * X.2: a reported length overriding the drawn one, set by a writer, with "Clear override"; ReportedCell) and Derived
 * quantity ("34.25 LF" when its pay item is in LF and it has a length, the reported one over the drawn, else "—").
 * Renders nothing without segments.
 * Props: segments, pages (for each segment's page number), contractItems, writer (may set reported lengths),
 * onSaved(segment) (a segment as saved).
 */
export default function SegmentsTable({ segments, pages, contractItems, writer = false, onSaved = () => {} }) {
  if (!segments?.length) return null

  const pageNumberOf = (segment) => pages.find(page => page.pir_page_id === segment.pir_page_id)?.page_number ?? null
  const rows = segments
    .map((segment, index) => ({ segment, index, pageNumber: pageNumberOf(segment) }))
    .sort((a, b) => (a.pageNumber ?? Infinity) - (b.pageNumber ?? Infinity) || a.index - b.index)

  const itemOf = (segment) => contractItems.find(found => found.contract_item_id === segment.pay_item_id) ?? null
  const payItemText = (segment) => {
    if (!segment.pay_item_id) return '—'
    const item = itemOf(segment)
    return item ? contractItemLabel(item) : 'Not in the catalog'
  }
  const dimensions = (segment) => {
    const runs = Math.max((segment.points?.length ?? 0) - 1, 0)
    const length = segment.length_ft == null ? 'no scale' : `${feet(segment.length_ft)} ft`
    return `${length} · ${runs} ${runs === 1 ? 'run' : 'runs'}`
  }
  const derived = (segment) => {
    const item = itemOf(segment)
    const length = effectiveLength(segment)
    return item && bareUnit(item.pay_unit) === 'LF' && length != null ? `${feet(length)} LF` : '—'
  }

  return (
    <section aria-labelledby="segments-list-heading" className="bg-white rounded-lg shadow-sm p-6 mt-8">
      <h3 id="segments-list-heading" className="text-lg font-semibold text-gray-900 mb-4">Curb segments</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200" aria-label="Curb segments">
          <thead className="bg-gray-50">
            <tr>
              {['Page', 'Segment #', 'Shape', 'Dimensions', 'Pay item', 'Reported (LF)', 'Derived quantity'].map(heading => (
                <th key={heading} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map(({ segment, pageNumber }, number) => (
              <tr key={segment.segment_id} className="text-gray-900">
                <td className="px-4 py-3 text-sm whitespace-nowrap">{pageNumber ?? '—'}</td>
                <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">{number + 1}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">{segmentTypeLabel(segment.segment_type)}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap tabular-nums">{dimensions(segment)}</td>
                <td className="px-4 py-3 text-sm">
                  <p className="line-clamp-2 max-w-xs" title={payItemText(segment)}>{payItemText(segment)}</p>
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap tabular-nums">
                  {/* Keyed by the saved value, so a save (or a refusal's retry) starts the input from what is stored */}
                  <ReportedCell key={`${segment.segment_id}:${segment.reported_length_ft ?? ''}`} segment={segment}
                    writer={writer} onSaved={onSaved} />
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap tabular-nums">{derived(segment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
