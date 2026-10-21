import { Link, useLocation } from 'react-router-dom'
import { formatPayItemQuantity } from '../../lib/payItemFormat'
import { sitePagePath } from './ImportedSitesSection'

/**
 * The Pay Items card's read-only rows from the report's imported sites (Slice X): each pay item summed over the sites'
 * flags, curb segments and the pay items entered on them, with the sites behind it, each linking to its page in this
 * IDR's context, where its pay items are changed. Nothing here is edited.
 * Props: rows (useReportSitePayItems' siteRows), projectId, idrId, reportId.
 */
export default function SitePayItemRows({ rows, projectId, idrId, reportId }) {
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`

  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-1">From imported sites</h4>
      <p className="text-sm text-gray-600 mb-2">Summed over the sites' flags, curb segments and pay items; change them on each site's page.</p>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No pay items from imported sites.</p>
      ) : (
        <table className="min-w-full text-sm" aria-label="Pay items from imported sites">
          <thead>
            <tr className="text-left text-gray-600">
              <th className="py-1 pr-3">Item No.</th>
              <th className="py-1 pr-3">Budget Code</th>
              <th className="py-1 pr-3 text-right">Quantity</th>
              <th className="py-1 pr-3">Unit</th>
              <th className="py-1 pr-3">Description</th>
              <th className="py-1">Sites</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map(row => (
              <tr key={row.key}>
                <td className="py-2 pr-3 whitespace-nowrap">{row.pay_item_ref}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{row.budget_code}</td>
                <td className="py-2 pr-3 text-right whitespace-nowrap">{formatPayItemQuantity(row.amount)}</td>
                <td className="py-2 pr-3">{row.unit}</td>
                <td className="py-2 pr-3">{row.description}</td>
                <td className="py-2">
                  {row.sites.map(({ site, amount }, index) => (
                    <span key={site.id}>
                      {index > 0 && ', '}
                      <Link className="text-construction-700 underline"
                        to={sitePagePath(projectId, site, { returnTo, idrId, reportId })}>
                        {site.display_address}
                      </Link>
                      {row.sites.length > 1 && <span className="text-gray-500"> ({formatPayItemQuantity(amount)})</span>}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
