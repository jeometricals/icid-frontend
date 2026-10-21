import { segmentTypeLabel } from '../../data/flagEnums'
import { contractItemLabel } from '../ContractItemPicker'

// A bid unit without its periods and spaces, in capitals ("L.F." and "LF" are both LF)
const bareUnit = (unit) => (unit ?? '').replace(/[.\s]/g, '').toUpperCase()

const feet = (value) => Number(value).toFixed(2)

/**
 * Every live curb segment of a PIR, across its pages, as a read-only table under the sketch workspace's flag list
 * (Slice X.1), titled "Curb segments": Page, Segment # (1..n in drawing order: by page, then as the PIR lists them),
 * Shape (the segment type in words), Dimensions ("34.25 ft · 3 runs", "no scale" while its page has none), Pay item
 * ("item no — description" from the project's contract items, "—" for none, "Not in the catalog") and Derived quantity
 * ("34.25 LF" when its pay item is in LF and it has a length, else "—"). Renders nothing without segments.
 * Props: segments, pages (for each segment's page number), contractItems.
 */
export default function SegmentsTable({ segments, pages, contractItems }) {
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
    return item && bareUnit(item.pay_unit) === 'LF' && segment.length_ft != null ? `${feet(segment.length_ft)} LF` : '—'
  }

  return (
    <section aria-labelledby="segments-list-heading" className="bg-white rounded-lg shadow-sm p-6 mt-8">
      <h3 id="segments-list-heading" className="text-lg font-semibold text-gray-900 mb-4">Curb segments</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200" aria-label="Curb segments">
          <thead className="bg-gray-50">
            <tr>
              {['Page', 'Segment #', 'Shape', 'Dimensions', 'Pay item', 'Derived quantity'].map(heading => (
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
                <td className="px-4 py-3 text-sm whitespace-nowrap tabular-nums">{derived(segment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
