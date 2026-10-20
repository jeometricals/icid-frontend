import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { propertyTypeLabel } from '../data/propertyTypes'
import { shortDate } from '../lib/shortDate'
import { facingStreetName, rampTypeLabel } from '../data/propertyKinds'
import StatusBadge from './StatusBadge'
import { siteLabel } from '../lib/properties'

/** The page of one property: under its project, open to anyone on it. */
export const propertyPath = (property) => `/project/${property.project_id}/properties/${property.id}`

// The type: a sidewalk's property type, a ped ramp's ramp type
const typeText = (row) => (row.kind === 'ped_ramp' ? rampTypeLabel(row.ramp_type) : propertyTypeLabel(row.property_type))

/**
 * A table of properties (a task order's bundle): Site (a link to the property's page: a sidewalk's "Queens Block 123 Lot 45",
 * "Ped ramp" for a ped ramp), CB (its community_board, a dash for none), address (the display_address, so a ped ramp's intersection; the notes as a tooltip), type (a
 * sidewalk's property type, a ped ramp's ramp type), added (when the property was added to the project) and, when
 * the caller gives renderActions, an Actions cell it fills. A soft-deleted property is muted, its Site crossed out
 * beside a Deleted badge (the date as a tooltip). Rows are in the order given.
 * With kind 'ped_ramp' (a task order's ped ramps) the columns are a ped ramp's own instead: Intersection (the link),
 * Quadrant, Facing (the street, by name), Ramp type, Added.
 * Props: properties, kind (leave it out for the mixed columns above), renderActions(property) (the Actions cell's
 * content; leave it out for no Actions column, as for a demo user).
 */
export default function PropertiesTable({ properties, kind, renderActions }) {
  const ramps = kind === 'ped_ramp'
  const headings = [
    ...(ramps ? ['Intersection', 'Quadrant', 'Facing', 'Ramp type'] : ['Site', 'CB', 'Address', 'Type']),
    'Added', ...(renderActions ? ['Actions'] : []),
  ]
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
            const muted = `px-6 py-4 text-sm whitespace-nowrap ${deleted ? '' : 'text-gray-600'}`
            if (ramps) {
              return (
                <tr key={row.id} className="text-gray-900">
                  <td className="px-6 py-4 text-sm font-medium">
                    <Link to={propertyPath(row)} title={row.notes || undefined} className="text-construction-700 hover:underline">
                      {row.intersection_street_1} & {row.intersection_street_2}
                    </Link>
                  </td>
                  <td className={muted}>{row.quadrant}</td>
                  <td className={muted}>{facingStreetName(row) || '—'}</td>
                  <td className={muted}>{rampTypeLabel(row.ramp_type)}</td>
                  <td className={muted}>{shortDate(row.created_at)}</td>
                  {renderActions && <td className="px-6 py-4 text-sm">{renderActions(row)}</td>}
                </tr>
              )
            }
            return (
              <tr key={row.id} data-deleted={deleted || undefined} className={deleted ? 'bg-gray-50 text-gray-400' : 'text-gray-900'}>
                <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                  {deleted ? (
                    <span className="inline-flex items-center gap-2">
                      <Link to={propertyPath(row)} className="line-through hover:underline">{siteLabel(row)}</Link>
                      <span title={`Deleted ${format(parseISO(row.deleted_at), 'MMM d, yyyy')}`}>
                        <StatusBadge status="deleted" />
                      </span>
                    </span>
                  ) : (
                    <Link to={propertyPath(row)} className="text-construction-700 hover:underline">{siteLabel(row)}</Link>
                  )}
                </td>
                <td className={`px-6 py-4 text-sm whitespace-nowrap ${deleted ? '' : 'text-gray-600'}`}>
                  {row.community_board || '—'}
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
