import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { getPropertyPayItemSummary } from '../services/api'
import { formatPayItemQuantity } from '../lib/payItemFormat'

/** How many IDRs report a pay item, as its expand button reads: "1 IDR", "3 IDRs" (Slice W2). */
export function idrCountLabel(count) {
  return `${count} IDR${count === 1 ? '' : 's'}`
}

/**
 * A site's "Pay Items Reported" (Slice V5), read-only, under its PIR workspace: each pay item IDRs report here (from
 * the PIR's flags and curb segments, approved and in flight, and the pay items entered on the site), with its total
 * and unit, expanding from its IDR count ("3 IDRs") to each IDR's part ("IDR-005 · 10/20/26 · 40 SF · Jane Doe", newest first, each opening its
 * IDR). The data flows from the IDRs; nothing is entered here. Props: projectId, propertyId.
 */
export default function PayItemsReportedSection({ projectId, propertyId }) {
  const [state, setState] = useState({ status: 'loading', error: null, items: [] })
  const [open, setOpen] = useState({}) // contract item id → expanded

  useEffect(() => {
    let ignore = false
    setState({ status: 'loading', error: null, items: [] })
    getPropertyPayItemSummary(propertyId)
      .then(items => { if (!ignore) setState({ status: 'ready', error: null, items }) })
      .catch(err => { if (!ignore) setState({ status: 'error', error: err.message, items: [] }) })
    return () => { ignore = true }
  }, [propertyId])

  return (
    <section aria-labelledby="pay-items-reported-heading" className="bg-white rounded-lg shadow-sm p-6 mt-6">
      <h3 id="pay-items-reported-heading" className="text-lg font-semibold text-gray-900 mb-1">Pay Items Reported</h3>
      <p className="text-sm text-gray-600 mb-3">
        What IDRs report on this site, approved and in progress: its PIR flags and curb segments, and pay items entered on
        it.
      </p>
      {state.status === 'loading' ? (
        <p className="text-sm text-gray-500">Loading pay items…</p>
      ) : state.status === 'error' ? (
        <p className="text-sm text-red-600">Couldn't load the pay items: {state.error}</p>
      ) : state.items.length === 0 ? (
        <p className="text-sm text-gray-500">No IDR has reported pay items here yet.</p>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600">
              <th className="py-1 pr-3">Item</th>
              <th className="py-1 pr-3">Description</th>
              <th className="py-1 pr-3 text-right">Total</th>
              <th className="py-1"><span className="sr-only">IDRs</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {state.items.map(item => (
              <Fragment key={item.contract_item_id}>
                <tr>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {item.pay_item_ref} <span className="text-gray-500">({item.budget_code})</span>
                  </td>
                  <td className="py-2 pr-3">{item.description}</td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap font-semibold">
                    {formatPayItemQuantity(item.total)} {item.unit}
                  </td>
                  <td className="py-2 text-right">
                    <button type="button" className="text-construction-700 underline whitespace-nowrap"
                      aria-expanded={!!open[item.contract_item_id]}
                      onClick={() => setOpen(o => ({ ...o, [item.contract_item_id]: !o[item.contract_item_id] }))}>
                      {open[item.contract_item_id] ? 'Hide IDRs' : idrCountLabel(item.idrs.length)}
                    </button>
                  </td>
                </tr>
                {open[item.contract_item_id] && (
                  <tr>
                    <td colSpan={4} className="pb-3">
                      <ul className="ml-4 text-gray-700" aria-label={`IDRs reporting ${item.pay_item_ref}`}>
                        {item.idrs.map(entry => (
                          <li key={entry.idr_id}>
                            <Link className="text-construction-700 underline" to={`/project/${projectId}/idr/${entry.idr_id}`}>
                              {entry.idr_number ?? 'Draft'}
                            </Link>
                            {' · '}{format(parseISO(entry.report_date), 'M/d/yy')}
                            {' · '}{formatPayItemQuantity(entry.quantity)} {item.unit}
                            {' · '}{entry.inspector ?? 'Unknown inspector'}
                            {entry.status !== 'approved' && <span className="ml-2 text-amber-700">(in progress)</span>}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
