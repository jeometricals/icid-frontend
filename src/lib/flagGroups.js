// How the sketch dresses a page's flags as the DOT Construction Report does: each flag's fill, the "4" Conc." /
// "7" Conc." labels on runs of same-thickness flags, and the A-labels of the non-assessable areas
import { abut } from './bundleGeometry'
import { boundsOf, flagOutline } from './flagGeometry'

/**
 * A flag's fill on the sketch: 'hatch' (tan) for a flag that isn't assessable, 'white' for a new 7" flag, and
 * 'stipple' (light blue) for a new 4" one, a 7" assessed as 4" included.
 */
export function flagFill(flag) {
  if (flag.surveyed_is_assessable === false) return 'hatch'
  return flag.surveyed_thickness === '7in' ? 'white' : 'stipple'
}

// The slab a thickness is poured at, for the group labels: a 7" assessed as 4" is still a 7" slab
const SLAB = { '4in': '4', '7in': '7', '7in_as_4in': '7' }

export const groupLabel = (slab) => `${slab}" Conc.`

/**
 * The runs of a page's flags that share a slab thickness, in display order: consecutive flags of the same slab that
 * touch make one run (a flag joins the run when it shares an edge, within SLAB_TOLERANCE_FT, with a flag already in
 * it: lib/bundleGeometry.js's abut, as the Construction Report's slabs do), and a flag of another thickness, one that
 * can't be drawn, or one drawn apart from the run ends it. Each run is {slab, label, flagIds, x, y}: (x, y) is the
 * middle of the run's bounding box, in page pixels, or for a run of one flag just under it, so the label stays off the
 * flag's own number and defect codes. Returns [] without a scale.
 */
export function thicknessRuns(flags, scale) {
  const runs = []
  let current = null
  const ordered = [...flags].sort((a, b) => a.display_order - b.display_order)
  for (const flag of ordered) {
    const slab = SLAB[flag.surveyed_thickness]
    const outline = flagOutline(flag, scale)
    if (!slab || outline.length === 0) {
      current = null
      continue
    }
    const feet = outline.map(({ x, y }) => ({ x: x / scale, y: y / scale }))
    if (!current || current.slab !== slab || !current.outlines.some(other => abut(feet, other))) {
      current = { slab, flagIds: [], points: [], outlines: [] }
      runs.push(current)
    }
    current.flagIds.push(flag.id)
    current.points.push(...outline)
    current.outlines.push(feet)
  }
  return runs.map(({ slab, flagIds, points }) => {
    const box = boundsOf(points)
    const single = flagIds.length === 1
    return {
      slab,
      label: groupLabel(slab),
      flagIds,
      x: (box.minX + box.maxX) / 2,
      y: single ? box.maxY + labelSize(scale) : (box.minY + box.maxY) / 2,
    }
  })
}

/**
 * A page's non-assessable areas with the labels the sketch gives them (A1, A2, ...): numbered at render time, in
 * the display order of their flags and then their own. Areas of flags not given are left out.
 * Returns [{area, label}].
 */
export function labelledAreas(areas, flags) {
  const flagOrder = new Map(flags.map(flag => [flag.id, flag.display_order]))
  return areas
    .filter(area => flagOrder.has(area.flag_id))
    .sort((a, b) => flagOrder.get(a.flag_id) - flagOrder.get(b.flag_id) || a.display_order - b.display_order)
    .map((area, index) => ({ area, label: `A${index + 1}` }))
}

/** The height (page pixels) of the sketch's lettering: about a foot at the page's scale, never under 10. */
export const labelSize = (scale) => Math.max(10, (scale ?? 0) * 1.1)
