import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ChevronDown, ChevronRight, Files, Plus } from 'lucide-react'
import { rampTypeLabel } from '../data/propertyKinds'
import { downloadInspectionReport } from '../services/api'
import { BULK_UPLOAD_TOOLTIP, SiteStatus } from './SiteSection'
import DownloadFileButton from './DownloadFileButton'
import StatusBadge from './StatusBadge'

export const PED_RAMPS_TITLE = 'Pedestrian Ramps'
export const NO_PED_RAMPS = 'No pedestrian ramps added yet.'
export const PED_RAMP_HEADINGS = ['Intersection', 'Direction', 'Ramp type', 'Ramp label', 'Status', 'Actions']
export const NO_CORNER = 'No corner'
export const INSPECTION_FORM = 'As-Built Inspection Form'

/** A corner's As-Built Inspection Form; with a ramp, scrolled to that ramp's card. */
export const inspectionPath = (corner, propertyId) =>
  `/project/${corner.project_id}/ped-ramp-corners/${corner.corner_id}/inspection${propertyId ? `#ramp-${propertyId}` : ''}`

export const NEEDS_DIRECTION = "Set this corner's direction first (Edit one of its ramps)."

/** A corner's name: its two streets. */
export const cornerName = (corner) => `${corner.north_south_street} & ${corner.east_west_street}`

/** "1 ramp", "3 ramps". */
export const rampCount = (count) => `${count} ramp${count === 1 ? '' : 's'}`

/**
 * The ramps grouped by their corner, in the corners' order: each corner given (a live one with no ramps too, so a ramp
 * can be added to it), then, under a null corner, the ramps whose corner isn't in the list (none set, or one not read).
 * Takes the ped ramp sites and the corners. Returns [{corner, rows}].
 */
export function groupByCorner(rows, corners) {
  const known = new Set(corners.map(corner => corner.corner_id))
  const groups = corners
    .map(corner => ({ corner, rows: rows.filter(row => row.corner_id === corner.corner_id) }))
    .filter(group => group.rows.length > 0 || !group.corner.deleted_at)
  const loose = rows.filter(row => !known.has(row.corner_id))
  return loose.length > 0 ? [...groups, { corner: null, rows: loose }] : groups
}

const headingCell = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'

/**
 * The Site Info page's "Pedestrian Ramps" (Slice R): one section, folding as SiteSection does, where each row is a ped
 * ramp site and rows are stacked under their corner. A corner's heading row gives its streets, direction and borough,
 * how many live ramps it has, "As-Built Inspection Form" (the corner's inspection page, for everyone), its Inspection
 * Report (the PDF, for everyone) and, when onAddRamp is given and the corner
 * is live, "Add another ramp" (off, with a tooltip, for a corner without a direction). Ramp rows: Intersection (a link
 * to the site's page), Direction (the ramp's quadrant), Ramp type, Ramp label (its Ramp ID, from the corner's ramps),
 * Status (SiteStatus; Deleted for a deleted ramp) and Actions ("As-Built Inspection Form", opening the corner's form at
 * this ramp, on a live ramp at a corner; then renderActions(row, corner)). Ramps whose corner isn't
 * in the list come last, under "No corner". The header has the disabled Bulk Upload button and, when onAdd is given,
 * Add Pedramp; the empty state repeats it.
 * Props: rows (the project's ped ramp sites), corners, onAdd, addDisabled, onAddRamp(corner), renderActions(row, corner).
 */
export default function PedRampsSection({ rows, corners, onAdd, addDisabled = false, onAddRamp, renderActions }) {
  const [open, setOpen] = useState(true)
  const bodyId = useId()
  const Chevron = open ? ChevronDown : ChevronRight
  const live = rows.filter(row => !row.deleted_at).length
  const groups = groupByCorner(rows, corners)
  const addButton = (className) => onAdd && (
    <button type="button" onClick={onAdd} disabled={addDisabled} className={`${className} inline-flex items-center space-x-2`}>
      <Plus className="h-4 w-4" />
      <span>Add Pedramp</span>
    </button>
  )

  return (
    <section aria-label={PED_RAMPS_TITLE} className="bg-white rounded-lg shadow-sm mb-6">
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
            <span>{PED_RAMPS_TITLE} ({live})</span>
          </button>
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <span title={BULK_UPLOAD_TOOLTIP} className="inline-flex">
            <button type="button" disabled title={BULK_UPLOAD_TOOLTIP} className="btn-secondary inline-flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <Files className="h-4 w-4" />
              <span>Bulk Upload Ped Ramps</span>
            </button>
          </span>
          {addButton('btn-secondary')}
        </div>
      </div>

      {open && (
        <div id={bodyId} className="border-t border-gray-200">
          {groups.length === 0 ? (
            <div className="p-6 text-center text-gray-600 space-y-4">
              <p>{NO_PED_RAMPS}</p>
              {onAdd && <div className="flex justify-center">{addButton('btn-primary')}</div>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {PED_RAMP_HEADINGS.map(heading => <th key={heading} scope="col" className={headingCell}>{heading}</th>)}
                  </tr>
                </thead>
                {groups.map(({ corner, rows: cornerRows }) => (
                  <CornerGroup
                    key={corner?.corner_id ?? 'none'}
                    corner={corner}
                    rows={cornerRows}
                    onAddRamp={onAddRamp}
                    renderActions={renderActions}
                  />
                ))}
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** One corner's heading row and its ramps' rows, as a table body of its own. */
function CornerGroup({ corner, rows, onAddRamp, renderActions }) {
  const cornerDeleted = Boolean(corner?.deleted_at)
  const labels = Object.fromEntries((corner?.ramps ?? []).map(ramp => [ramp.property_id, ramp.ramp_id_label]))
  const liveRamps = rows.filter(row => !row.deleted_at).length
  const canAdd = corner && !cornerDeleted && onAddRamp

  return (
    <tbody className="divide-y divide-gray-200 border-t-2 border-gray-200">
      <tr className="bg-construction-50" data-corner={corner?.corner_id ?? 'none'}>
        <th scope="rowgroup" colSpan={PED_RAMP_HEADINGS.length} className="px-4 py-2 text-left">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-sm font-semibold ${cornerDeleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {corner ? (
                <>
                  {cornerName(corner)}
                  {corner.corner_direction ? ` — ${corner.corner_direction}` : ''}
                  <span className="font-normal text-gray-600"> · {corner.boro} · {rampCount(liveRamps)}</span>
                </>
              ) : NO_CORNER}
            </span>
            {corner && (
              <div className="flex flex-wrap items-start gap-2 font-normal">
                <Link to={inspectionPath(corner)} className="btn-secondary">{INSPECTION_FORM}</Link>
                <DownloadFileButton label="Inspection Report" download={() => downloadInspectionReport(corner.corner_id)} />
                {canAdd && (
                  <span title={corner.corner_direction ? undefined : NEEDS_DIRECTION} className="inline-flex">
                    <button
                      type="button"
                      onClick={() => onAddRamp(corner)}
                      disabled={!corner.corner_direction}
                      className="btn-secondary inline-flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add another ramp at this corner</span>
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
        </th>
      </tr>
      {rows.map(row => {
        const deleted = Boolean(row.deleted_at)
        return (
          <tr key={row.id} data-deleted={deleted || undefined} className={`text-sm ${deleted ? 'bg-gray-50 text-gray-400' : 'text-gray-900'}`}>
            <td className="px-4 py-3">
              <Link
                to={`/project/${row.project_id}/properties/${row.id}`}
                className={deleted ? 'line-through hover:underline' : 'text-construction-700 hover:underline'}
              >
                {row.intersection_street_1} & {row.intersection_street_2}
              </Link>
            </td>
            <td className="px-4 py-3 whitespace-nowrap">{row.quadrant}</td>
            <td className="px-4 py-3 whitespace-nowrap">{rampTypeLabel(row.ramp_type)}</td>
            <td className="px-4 py-3 whitespace-nowrap">{labels[row.id] || '—'}</td>
            <td className="px-4 py-3 whitespace-nowrap">
              {deleted ? (
                <span title={`Deleted ${format(parseISO(row.deleted_at), 'MMM d, yyyy')}`}>
                  <StatusBadge status="deleted" />
                </span>
              ) : <SiteStatus status={row.status} />}
            </td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap items-start gap-2">
                {corner && !deleted && (
                  <Link to={inspectionPath(corner, row.id)} className="btn-secondary">{INSPECTION_FORM}</Link>
                )}
                {renderActions(row, corner)}
              </div>
            </td>
          </tr>
        )
      })}
    </tbody>
  )
}
