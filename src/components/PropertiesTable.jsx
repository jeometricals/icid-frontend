import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { propertyTypeLabel } from '../data/propertyTypes'
import { shortDate } from '../lib/shortDate'
import { rampTypeLabel } from '../data/propertyKinds'
import StatusBadge from './StatusBadge'

/** The page of one property: under its project, open to anyone on it. */
export const propertyPath = (property) => `/project/${property.project_id}/properties/${property.id}`

// What the BBL cell's link reads: a sidewalk's BBL; a ped ramp has none
const bblText = (row) => (row.kind === 'ped_ramp' ? 'Ped ramp' : row.bbl)

// The type: a sidewalk's property type, a ped ramp's ramp type
const typeText = (row) => (row.kind === 'ped_ramp' ? rampTypeLabel(row.ramp_type) : propertyTypeLabel(row.property_type))

/**
 * A table of properties (a task order's bundle): BBL (a link to the property's page; "Ped ramp" for a ped ramp,
 * which has none), address (the display_address, so a ped ramp's intersection; the notes as a tooltip), type (a
 * sidewalk's property type, a ped ramp's ramp type), added (when the property was added to the project) and, when
 * the caller gives renderActions, an Actions cell it fills. A soft-deleted property is muted, its BBL crossed out
 * beside a Deleted badge (the date as a tooltip). Rows are in the order given.
 * Props: properties, renderActions(property) (the Actions cell's content; leave it out for no Actions column, as for
 * a demo user).
 */
export default function PropertiesTable({ properties, renderActions }) {
  const headings = ['BBL', 'Address', 'Type', 'Added', ...(renderActions ? ['Actions'] : [])]
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
                      <Link to={propertyPath(row)} className="line-through hover:underline">{bblText(row)}</Link>
                      <span title={`Deleted ${format(parseISO(row.deleted_at), 'MMM d, yyyy')}`}>
                        <StatusBadge status="deleted" />
                      </span>
                    </span>
                  ) : (
                    <Link to={propertyPath(row)} className="text-construction-700 hover:underline">{bblText(row)}</Link>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <p title={row.notes || undefined}>{row.display_address}</p>
                </td>
                <td className={`px-6 py-4 text-sm whitespace-nowrap ${deleted ? '' : 'text-gray-600'}`}>
                  {typeText(row)}
                </td>
                <td className={`px-6 py-4 text-sm whitespace-nowrap ${deleted ? '' : 'text-gray-600'}`}>
                  {shortDate(row.created_at)}
                </td>
                {renderActions && <td className="px-6 py-4 text-sm">{renderActions(row)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
