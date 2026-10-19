import { useId, useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { rampTypeLabel } from '../data/propertyKinds'
import { downloadInspectionReport } from '../services/api'
import DownloadFileButton from './DownloadFileButton'

export const CORNERS_TITLE = 'Ped Ramp Corners'
export const NO_CORNERS = 'No ped ramp corners added yet.'
export const CORNER_HEADINGS = ['Intersection', 'Borough', 'Direction', 'Corner No.', 'Ramps', 'Inspected', 'Actions']

/** A corner's name: its two streets. */
export const cornerName = (corner) => `${corner.north_south_street} & ${corner.east_west_street}`

/** How a corner's ramps read in its row: each one's type and its Ramp ID, when it has one. */
export const rampSummary = (corner) => corner.ramps
  .map(ramp => rampTypeLabel(ramp.ramp_type) + (ramp.ramp_id_label ? ` (${ramp.ramp_id_label})` : ''))
  .join(', ')

/**
 * A project's ped ramp corners on the Site Info page, a section that folds like SiteSection, beside "Pedestrian Ramps":
 * a header (the title with its count of live corners, which folds the section; then Add, when onAdd is given) and the
 * corners' table, or an empty state. Columns: Intersection, Borough, Direction, Corner No., Ramps (the ramp sites placed
 * at it, by type and Ramp ID, or a dash), Inspected (the inspection date) and Actions: "Inspection Report" (the PDF, for
 * everyone), then Edit (onEdit) and Delete (onDelete) when given, on a live corner. A deleted corner's row is muted.
 * Props: corners, onAdd, addDisabled, onEdit(corner), onDelete(corner).
 */
export default function PedRampCornersSection({ corners, onAdd, addDisabled = false, onEdit, onDelete }) {
  const [open, setOpen] = useState(true)
  const bodyId = useId()
  const Chevron = open ? ChevronDown : ChevronRight
  const live = corners.filter(corner => !corner.deleted_at).length
  const addButton = (className) => onAdd && (
    <button type="button" onClick={onAdd} disabled={addDisabled} className={`${className} inline-flex items-center space-x-2`}>
      <Plus className="h-4 w-4" />
      <span>Add Corner</span>
    </button>
  )

  return (
    <section aria-label={CORNERS_TITLE} className="bg-white rounded-lg shadow-sm mb-6">
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
            <span>{CORNERS_TITLE} ({live})</span>
          </button>
        </h3>
        {addButton('btn-secondary')}
      </div>

      {open && (
        <div id={bodyId} className="border-t border-gray-200">
          {corners.length === 0 ? (
            <div className="p-6 text-center text-gray-600 space-y-4">
              <p>{NO_CORNERS}</p>
              {onAdd && <div className="flex justify-center">{addButton('btn-primary')}</div>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {CORNER_HEADINGS.map(heading => (
                      <th key={heading} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {corners.map(corner => {
                    const deleted = Boolean(corner.deleted_at)
                    return (
                      <tr key={corner.corner_id} data-deleted={deleted || undefined} className={`text-sm ${deleted ? 'bg-gray-50 text-gray-400' : 'text-gray-900'}`}>
                        <td className={`px-4 py-3 ${deleted ? 'line-through' : ''}`}>{cornerName(corner)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{corner.boro}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{corner.corner_direction || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{corner.corner_number || '—'}</td>
                        <td className="px-4 py-3">{rampSummary(corner) || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{corner.inspection_date || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-start gap-2">
                            <DownloadFileButton
                              label="Inspection Report"
                              download={() => downloadInspectionReport(corner.corner_id)}
                            />
                            {!deleted && onEdit && (
                              <button type="button" onClick={() => onEdit(corner)} className="btn-secondary">Edit</button>
                            )}
                            {!deleted && onDelete && (
                              <button type="button" onClick={() => onDelete(corner)} className="btn-secondary text-red-600 hover:text-red-700">
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
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
