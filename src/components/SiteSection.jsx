import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ChevronDown, ChevronRight, Files, Plus } from 'lucide-react'
import { facingStreetName, rampTypeLabel } from '../data/propertyKinds'
import { shortDate } from '../lib/shortDate'
import StatusBadge from './StatusBadge'

export const BULK_UPLOAD_TOOLTIP = 'AI import — coming soon'

/** The page of one property: under its project, open to anyone on it. */
const propertyPath = (property) => `/project/${property.project_id}/properties/${property.id}`

/**
 * A site's status, from the list's status ({state, date}): a dash for none, a "Task Ordered" pill, or "Constructed
 * YYYY-MM-DD" with the backend's date as sent.
 */
export function SiteStatus({ status }) {
  if (status?.state === 'task_ordered') {
    return <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">Task Ordered</span>
  }
  if (status?.state === 'constructed_on') {
    return (
      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 whitespace-nowrap">
        Constructed {status.date}
      </span>
    )
  }
  return <span aria-label="No status">—</span>
}

// The text in a site's identifying cell: a link to the site's page
const siteLink = (row, text) => (
  <Link to={propertyPath(row)} className={row.deleted_at ? 'line-through hover:underline' : 'text-construction-700 hover:underline'}>
    {text}
  </Link>
)

const dash = (value) => value || '—'

// The columns between Borough and Status, by kind
const KIND_COLUMNS = {
  sidewalk: [
    { heading: 'Block', cell: row => dash(row.block_display) },
    { heading: 'Lot', cell: row => dash(row.lot_display) },
    { heading: 'Address', cell: row => siteLink(row, row.address), wide: true },
    { heading: 'Violation No.', cell: row => dash(row.violation_no) },
  ],
  ped_ramp: [
    { heading: 'Intersection 1st Street', cell: row => siteLink(row, row.intersection_street_1), wide: true },
    { heading: 'Intersection 2nd Street', cell: row => row.intersection_street_2, wide: true },
    { heading: 'Quadrant', cell: row => row.quadrant },
    { heading: 'Facing', cell: row => dash(facingStreetName(row)) },
    { heading: 'Type', cell: row => rampTypeLabel(row.ramp_type) },
  ],
}

/** The headings of a kind's table, in order (Actions only when there is an actions cell). */
export const siteHeadings = (kind) => ['Borough', ...KIND_COLUMNS[kind].map(column => column.heading), 'Status', 'Added', 'Task Order No.', 'Actions']

/**
 * One kind of site on the Site Info page, as a section that folds: a header (a button with a chevron and the title
 * with its count of live sites, "Prior Notice Violation Sidewalks (12)", which folds the section; then the disabled
 * Bulk Upload button with its tooltip, for everyone; then Add, when onAdd is given), and under it the kind's table or
 * an empty state ("No sidewalks added yet." with a prominent Add when onAdd is given). Open when it mounts.
 * Columns: Borough, the kind's own (a sidewalk's Block, Lot, Address, Violation No.; a ped ramp's two intersection
 * streets, Quadrant, Facing by street name, Type), Status (SiteStatus; Deleted for a deleted row), Added, Task Order
 * No. and Actions (renderActions(row)). A sidewalk's address and a ped ramp's first street link to the site's page.
 * Block and lot are the backend's block_display / lot_display.
 * Props: kind ('sidewalk' | 'ped_ramp'), title, addLabel ('Add Sidewalk'), bulkLabel, emptyText, rows, onAdd
 * (leave it out for no Add), addDisabled, renderActions(row).
 */
export default function SiteSection({ kind, title, addLabel, bulkLabel, emptyText, rows, onAdd, addDisabled = false, renderActions }) {
  const [open, setOpen] = useState(true)
  const bodyId = useId()
  const live = rows.filter(row => !row.deleted_at).length
  const Chevron = open ? ChevronDown : ChevronRight
  const addButton = (className) => onAdd && (
    <button type="button" onClick={onAdd} disabled={addDisabled} className={`${className} inline-flex items-center space-x-2`}>
      <Plus className="h-4 w-4" />
      <span>{addLabel}</span>
    </button>
  )

  return (
    <section aria-label={title} className="bg-white rounded-lg shadow-sm mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900">
          <button
            type="button"
            onClick={() => setOpen(current => !current)}
            aria-expanded={open}
            aria-controls={bodyId}
            className="inline-flex items-center gap-2 hover:text-construction-700"
          >
            <Chevron className="h-5 w-5" aria-hidden="true" />
            <span>{title} ({live})</span>
          </button>
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          {/* The tooltip sits on a wrapper too: a disabled button shows none in some browsers */}
          <span title={BULK_UPLOAD_TOOLTIP} className="inline-flex">
            <button type="button" disabled title={BULK_UPLOAD_TOOLTIP} className="btn-secondary inline-flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Files className="h-4 w-4" />
              <span>{bulkLabel}</span>
            </button>
          </span>
          {addButton('btn-secondary')}
        </div>
      </div>

      {open && (
        <div id={bodyId} className="border-t border-gray-200">
          {rows.length === 0 ? (
            <div className="p-6 text-center text-gray-600 space-y-4">
              <p>{emptyText}</p>
              {onAdd && <div className="flex justify-center">{addButton('btn-primary')}</div>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {siteHeadings(kind).map(heading => (
                      <th key={heading} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.map(row => {
                    const deleted = Boolean(row.deleted_at)
                    return (
                      <tr key={row.id} data-deleted={deleted || undefined} className={`text-sm ${deleted ? 'bg-gray-50 text-gray-400' : 'text-gray-900'}`}>
                        <td className="px-4 py-3 whitespace-nowrap">{row.boro}</td>
                        {KIND_COLUMNS[kind].map(column => (
                          <td key={column.heading} className={`px-4 py-3 ${column.wide ? '' : 'whitespace-nowrap'}`}>{column.cell(row)}</td>
                        ))}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {deleted ? (
                            <span title={`Deleted ${format(parseISO(row.deleted_at), 'MMM d, yyyy')}`}>
                              <StatusBadge status="deleted" />
                            </span>
                          ) : <SiteStatus status={row.status} />}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{shortDate(row.created_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{dash(row.task_order_no)}</td>
                        <td className="px-4 py-3">{renderActions(row)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
