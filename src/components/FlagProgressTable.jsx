/**
 * The Progress pages' pay-item table from PIR flags: one row per pay item of a rollup (getProjectProgress /
 * getTaskOrderProgress), in the backend's order, with its Approved, In flight, Unclaimed and Live total quantities
 * (two decimals, with their flag counts) and the approved share. A state with nothing in it reads "—".
 * Props: payItems (a rollup's pay_items) and label (the table's accessible name).
 */
import { formatFlagQuantity, formatPercent } from '../lib/payItemFormat'

const STATES = [
  ['approved', 'Approved'],
  ['in_flight', 'In flight'],
  ['unclaimed', 'Unclaimed'],
  ['live_total', 'Live total'],
]

const dash = <span className="text-gray-400">—</span>

// "1 flag", "10 flags"
export function flagCount(count) {
  return `${count} ${count === 1 ? 'flag' : 'flags'}`
}

// A state's cell: its quantity and how many flags make it up, or a dash when it has none
function BucketCell({ bucket }) {
  if (!bucket.flag_count && !bucket.quantity) return dash
  return (
    <>
      <span className="text-gray-900">{formatFlagQuantity(bucket.quantity)}</span>
      <span className="ml-1 text-xs text-gray-500">({flagCount(bucket.flag_count)})</span>
    </>
  )
}

export default function FlagProgressTable({ payItems, label }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
      <table aria-label={label} className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th scope="col" className="px-4 py-3">Pay Item</th>
            <th scope="col" className="px-4 py-3">Description</th>
            {STATES.map(([key, title]) => (
              <th key={key} scope="col" className="px-4 py-3 text-right">{title}</th>
            ))}
            <th scope="col" className="px-4 py-3 text-right">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {payItems.map(item => (
            <tr key={item.pay_item_id}>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="font-semibold text-gray-900">{item.item_no} ({item.unit})</span>
                <span className="block text-xs text-gray-500">{item.budget_code}</span>
              </td>
              <td className="px-4 py-3 text-gray-700">{item.description}</td>
              {STATES.map(([key]) => (
                <td key={key} className="px-4 py-3 whitespace-nowrap text-right tabular-nums">
                  <BucketCell bucket={item[key]} />
                </td>
              ))}
              <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums text-gray-900">
                {item.approved_pct === null ? dash : formatPercent(item.approved_pct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
