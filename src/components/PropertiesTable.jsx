import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { propertyTypeLabel } from '../data/propertyTypes'
import { shortDate } from '../lib/shortDate'
import StatusBadge from './StatusBadge'

/**
 * A table of properties: BBL (a link to the property's page), address (the notes as a tooltip), type (its
 * label), added (when the property was added to the project) and an Actions cell the caller fills. A soft-deleted property is muted, its BBL crossed
 * out beside a Deleted badge (the date as a tooltip). Rows are in the order given.
 * Props: properties, renderActions(property) (the Actions cell's content).
 */
export default function PropertiesTable({ properties, renderActions }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {['BBL', 'Address', 'Type', 'Added', 'Actions'].map(heading => (
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
                      <Link to={`/admin/properties/${row.id}`} className="line-through hover:underline">{row.bbl}</Link>
                      <span title={`Deleted ${format(parseISO(row.deleted_at), 'MMM d, yyyy')}`}>
                        <StatusBadge status="deleted" />
                      </span>
                    </span>
                  ) : (
                    <Link to={`/admin/properties/${row.id}`} className="text-construction-700 hover:underline">{row.bbl}</Link>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <p title={row.notes || undefined}>{row.address}</p>
                </td>
                <td className={`px-6 py-4 text-sm whitespace-nowrap ${deleted ? '' : 'text-gray-600'}`}>
                  {propertyTypeLabel(row.property_type)}
                </td>
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
