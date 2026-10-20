// The badge for each kind a task order bundles: its short form, its words and its colours
const KINDS = [
  { count: 'sidewalk_count', short: 'SW', label: 'Sidewalks', tone: 'bg-amber-100 text-amber-800' },
  { count: 'ped_ramp_count', short: 'PR', label: 'Pedestrian ramps', tone: 'bg-sky-100 text-sky-800' },
]

/**
 * Which kinds of site a task order bundles, as small pills: "SW" when it has live sidewalks, "PR" when it has live
 * ped ramps, both for a mixed one, none for an empty one. Each has its count and kind as a tooltip.
 * Props: taskOrder (a row of the task order list, with sidewalk_count and ped_ramp_count).
 */
export default function SiteKindBadges({ taskOrder }) {
  const shown = KINDS.filter(kind => (taskOrder[kind.count] ?? 0) > 0)
  if (shown.length === 0) return null
  return (
    <span className="inline-flex gap-1">
      {shown.map(kind => (
        <span
          key={kind.short}
          title={`${kind.label}: ${taskOrder[kind.count]}`}
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${kind.tone}`}
        >
          {kind.short}
        </span>
      ))}
    </span>
  )
}
