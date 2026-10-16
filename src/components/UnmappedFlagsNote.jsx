/**
 * Under a Progress table: one line per site with live flags that add nothing to it (no pay item, or one in a unit a
 * flag can't measure), "3 unmapped flags on 350 Main St", linking to the site's PIR page to fix them. Renders
 * nothing when there are none. Props: projectId and entries (a rollup's unmapped_by_property).
 */
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

export default function UnmappedFlagsNote({ projectId, entries }) {
  if (!entries?.length) return null
  return (
    <ul aria-label="Unmapped flags" className="mt-3 space-y-1 text-sm">
      {entries.map(entry => (
        <li key={entry.property_id} className="flex items-center gap-2 text-gray-700">
          <AlertTriangle className="h-4 w-4 text-warn" aria-hidden="true" />
          <Link
            to={`/project/${projectId}/properties/${entry.property_id}/pir`}
            className="text-construction-700 hover:text-construction-800 underline"
          >
            {entry.flag_count} unmapped {entry.flag_count === 1 ? 'flag' : 'flags'} on {entry.display_address}
          </Link>
        </li>
      ))}
    </ul>
  )
}
