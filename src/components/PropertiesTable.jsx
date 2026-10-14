import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { propertyTypeLabel } from '../data/propertyTypes'
import { shortDate } from '../lib/shortDate'
import { pirStatusFromApi } from '../lib/pirs'
import StatusBadge from './StatusBadge'
import PirStatusBadge from './PirStatusBadge'

/**
 * A table of properties: BBL (a link to the property's admin page, unless linkToProperty is false), address (the
 * notes as a tooltip), type (its label), PIR (when asked for: the row's pir_status as a PirStatusBadge), added (when the property was added to the
 * project) and an Actions cell the caller fills. A soft-deleted property is muted, its BBL crossed out beside a
 * Deleted badge (the date as a tooltip). Rows are in the order given.
 * Props: properties, renderActions(property) (the Actions cell's content), showPirStatus (off by default: only the
 * project's property list carries pir_status), linkToProperty (on by default; off for anyone but an admin, since
 * the property page is admin only).
 */
export default function PropertiesTable({ properties, renderActions, showPirStatus = false, linkToProperty = true }) {
  const headings = ['BBL', 'Address', 'Type', ...(showPirStatus ? ['PIR'] : []), 'Added', 'Actions']
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {headings.map(heading => (
              <th
                key={heading}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {properties.map(row => {
            const deleted = Boolean(row.deleted_at)
            return (
              <tr key={row.id} data-deleted={deleted || undefined} className={deleted ? 'bg-gray-50 text-gray-400' : 'text-gray-900'}>
                <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                  {deleted ? (
                    <span className="inline-flex items-center gap-2">
                      {linkToProperty
                        ? <Link to={`/admin/properties/${row.id}`} className="line-through hover:underline">{row.bbl}</Link>
                        : <span className="line-through">{row.bbl}</span>}
                      <span title={`Deleted ${format(parseISO(row.deleted_at), 'MMM d, yyyy')}`}>
                        <StatusBadge status="deleted" />
                      </span>
                    </span>
                  ) : (
                    linkToProperty
                      ? <Link to={`/admin/properties/${row.id}`} className="text-construction-700 hover:underline">{row.bbl}</Link>
                      : row.bbl
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <p title={row.notes || undefined}>{row.address}</p>
                </td>
                <td className={`px-6 py-4 text-sm whitespace-nowrap ${deleted ? '' : 'text-gray-600'}`}>
                  {propertyTypeLabel(row.property_type)}
                </td>
                {showPirStatus && (
                  <td className="px-6 py-4 text-sm whitespace-nowrap">
                    <PirStatusBadge status={pirStatusFromApi(row.pir_status)} />
                  </td>
                )}
                <td className={`px-6 py-4 text-sm whitespace-nowrap ${deleted ? '' : 'text-gray-600'}`}>
                  {shortDate(row.created_at)}
                </td>
                <td className="px-6 py-4 text-sm">{renderActions(row)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
