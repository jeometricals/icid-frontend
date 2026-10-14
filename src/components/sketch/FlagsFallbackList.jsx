import { formatArea } from '../../lib/flagArea'
import { shapeLabel, thicknessLabel } from '../../data/flagEnums'
import { contractItemLabel } from '../ContractItemPicker'

export const EMPTY_TEXT = 'No flags yet.'

/**
 * Every flag of a PIR, across all its pages, as a read-only table under the sketch workspace: page, #, shape,
 * thickness, pay item ("item no — description" from the project's contract items), area (computed) and reported
 * (the override, or a dash). Clicking a row (or Enter on it) jumps to the flag's page and selects it there; the
 * selected flag's row is highlighted. Nothing here is edited.
 * Props: flags, pages (for each flag's page number), contractItems, selectedId, onPick(flag, pageNumber).
 */
export default function FlagsFallbackList({ flags, pages, contractItems, selectedId = null, onPick }) {
  const pageNumberOf = (flag) => pages.find(page => page.pir_page_id === flag.pir_page_id)?.page_number ?? null

  const payItemText = (flag) => {
    if (!flag.pay_item_id) return '—'
    const item = contractItems.find(found => found.contract_item_id === flag.pay_item_id)
    return item ? contractItemLabel(item) : 'Not in the catalog'
  }

  const rows = flags
    .map(flag => ({ flag, pageNumber: pageNumberOf(flag) }))
    .sort((a, b) => (a.pageNumber ?? Infinity) - (b.pageNumber ?? Infinity) || a.flag.display_order - b.flag.display_order)

  return (
    <section aria-labelledby="flags-list-heading" className="bg-white rounded-lg shadow-sm p-6 mt-8">
      <h3 id="flags-list-heading" className="text-lg font-semibold text-gray-900 mb-4">All flags</h3>
      {rows.length === 0 ? (
        <p className="text-gray-600">{EMPTY_TEXT}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Page', '#', 'Shape', 'Thickness', 'Pay item', 'Area (computed)', 'Reported'].map(heading => (
                  <th key={heading} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map(({ flag, pageNumber }) => (
                <tr
                  key={flag.id}
                  tabIndex={0}
                  aria-selected={flag.id === selectedId}
                  onClick={() => onPick(flag, pageNumber)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onPick(flag, pageNumber) }}
                  className={`cursor-pointer text-gray-900 hover:bg-construction-50 focus:outline-none focus:bg-construction-50 ${
                    flag.id === selectedId ? 'bg-construction-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm whitespace-nowrap">{pageNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">{flag.display_order}</td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">{shapeLabel(flag.shape)}</td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">{thicknessLabel(flag.surveyed_thickness)}</td>
                  <td className="px-4 py-3 text-sm">
                    <p className="line-clamp-2 max-w-xs" title={payItemText(flag)}>{payItemText(flag)}</p>
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap tabular-nums">{formatArea(flag.computed_quantity)}</td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap tabular-nums">
                    {flag.reported_quantity == null ? '—' : formatArea(flag.reported_quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
