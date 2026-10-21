import { Fragment, useState } from 'react'
import { formatPayItemQuantity } from '../../lib/payItemFormat'
import DisclosureToggle from './DisclosureToggle'

// A pay item's sources, in the order the breakdown lists them
const SOURCES = [
  { key: 'flags', label: 'PIR flags' },
  { key: 'segments', label: 'Curb segments' },
  { key: 'sites', label: 'Imported sites' },
  { key: 'manual', label: 'Entered on this report' },
]

/**
 * The SWCB's pay-item totals (Slice V1), display only: one row per pay item with its total over every source (the
 * IDR's PIR flags and curb segments, the pay items entered on its imported sites, and this report's own pay items),
 * each row expanding to its source breakdown, the sites named. Approval bills each source as it stands here.
 * Props: sources (usePayItemSources' {status, error, data}).
 */
export default function PayItemTotalsSection({ sources }) {
  const [open, setOpen] = useState({}) // pay item key → expanded
  const items = sources.data?.pay_items ?? []

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="form-section">
        <h3 className="form-section-title">Pay item totals</h3>
        <p className="text-sm text-gray-600 mb-3">
          Each pay item summed over the IDR's PIR flags and curb segments, the pay items entered on its imported sites
          and this report's own pay items below, as saved.
        </p>
        {sources.status === 'loading' ? (
          <p className="text-sm text-gray-500">Loading totals…</p>
        ) : sources.status === 'error' ? (
          <p className="text-sm text-red-600">Couldn't load the pay-item totals: {sources.error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">No pay items yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-1 pr-3">Item</th>
                <th className="py-1 pr-3">Budget code</th>
                <th className="py-1 pr-3">Description</th>
                <th className="py-1 pr-3 text-right">Total</th>
                <th className="py-1"><span className="sr-only">Source breakdown</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map(item => {
                const key = `${item.pay_item_ref}|${item.budget_code}`
                const unit = item.unit ? ` ${item.unit}` : ''
                return (
                  <Fragment key={key}>
                    <tr>
                      <td className="py-2 pr-3 whitespace-nowrap">{item.pay_item_ref ?? '—'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{item.budget_code ?? '—'}</td>
                      <td className="py-2 pr-3">{item.description}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap font-semibold">{formatPayItemQuantity(item.total)}{unit}</td>
                      <td className="py-2 text-right">
                        <DisclosureToggle expanded={!!open[key]} onToggle={() => setOpen(o => ({ ...o, [key]: !o[key] }))}>
                          {open[key] ? 'Hide sources' : 'Source breakdown'}
                        </DisclosureToggle>
                      </td>
                    </tr>
                    {open[key] && (
                      <tr>
                        <td colSpan={5} className="pb-3">
                          <ul className="ml-4 text-gray-700" aria-label={`Sources of ${item.pay_item_ref ?? item.description}`}>
                            {SOURCES.filter(source => item[source.key]).map(source => (
                              <li key={source.key}>
                                {source.label}: {formatPayItemQuantity(item[source.key])}{unit}
                                {source.key === 'sites' && (
                                  <ul className="ml-4 text-gray-600">
                                    {item.site_lines.map((line, i) => (
                                      <li key={`${line.site_id}-${i}`}>{line.label}: {formatPayItemQuantity(line.amount)}{unit}</li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
