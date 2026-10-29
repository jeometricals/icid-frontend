import { describe, it, expect } from 'vitest'
import { flagFill, labelSize, labelledAreas, thicknessRuns } from '../flagGroups'

// 5 × 5 ft squares at 10 px/ft, side by side along a row
const flag = (id, order, thickness, extra = {}) => ({
  id, display_order: order, shape: 'rectangle', dimensions: { L: 5, W: 5 }, sketch_x: 100 + 50 * (order - 1),
  sketch_y: 100, rotation: 0, surveyed_thickness: thickness, surveyed_is_assessable: true, ...extra,
})

describe('flagFill', () => {
  it('stipples a new 4" flag and a 7" assessed as 4", whitens a new 7" and hatches one that isn\'t assessable', () => {
    expect(flagFill(flag('a', 1, '4in'))).toBe('stipple')
    expect(flagFill(flag('b', 1, '7in_as_4in'))).toBe('stipple')
    expect(flagFill(flag('c', 1, '7in'))).toBe('white')
    expect(flagFill(flag('d', 1, '7in', { surveyed_is_assessable: false }))).toBe('hatch')
    expect(flagFill(flag('e', 1, '4in', { surveyed_is_assessable: false }))).toBe('hatch')
  })
})

describe('thicknessRuns', () => {
  it('groups consecutive flags of one slab, in display order, and labels each run', () => {
    // Given out of order: 1, 2 are 4"; 3 is 7"; 4 is 7" as 4" (a 7" slab); 5 is 4"
    const flags = [flag('f5', 5, '4in'), flag('f1', 1, '4in'), flag('f3', 3, '7in'), flag('f2', 2, '4in'), flag('f4', 4, '7in_as_4in')]
    const runs = thicknessRuns(flags, 10)
    expect(runs.map(run => [run.label, run.flagIds])).toEqual([
      ['4" Conc.', ['f1', 'f2']],
      ['7" Conc.', ['f3', 'f4']],
      ['4" Conc.', ['f5']],
    ])
  })

  it("puts a run's label in the middle of its bounding box, and a lone flag's just under it", () => {
    const runs = thicknessRuns([flag('f1', 1, '4in'), flag('f2', 2, '4in'), flag('f3', 3, '7in')], 10)
    // f1 spans x 75..125, f2 125..175, both y 75..125
    expect(runs[0]).toMatchObject({ x: 125, y: 100 })
    // f3 spans x 175..225, y 75..125: the label sits a line under it
    expect(runs[1]).toMatchObject({ x: 200, y: 125 + labelSize(10) })
  })

  it('breaks a run at a flag that cannot be drawn, and draws nothing without a scale', () => {
    const flags = [flag('f1', 1, '4in'), flag('f2', 2, '4in', { sketch_x: null }), flag('f3', 3, '4in')]
    expect(thicknessRuns(flags, 10).map(run => run.flagIds)).toEqual([['f1'], ['f3']])
    expect(thicknessRuns(flags, null)).toEqual([])
  })

  // The label drift fix (U1): a run is flags that touch, as the Construction Report's slabs are
  it('labels two flags of one thickness drawn apart separately, so a new far-away flag pulls no label', () => {
    const far = flag('f2', 2, '4in', { sketch_x: 900, sketch_y: 600 })
    const runs = thicknessRuns([flag('f1', 1, '4in'), far], 10)
    expect(runs.map(run => run.flagIds)).toEqual([['f1'], ['f2']])
    // f1's label stays where it was alone: under f1 (x 75..125, y 75..125)
    expect(runs[0]).toMatchObject({ x: 100, y: 125 + labelSize(10) })
  })

  it('keeps two abutting flags of one thickness in one run, labelled between them', () => {
    const runs = thicknessRuns([flag('f1', 1, '4in'), flag('f2', 2, '4in')], 10)
    expect(runs.map(run => run.flagIds)).toEqual([['f1', 'f2']])
    expect(runs[0]).toMatchObject({ x: 125, y: 100 })
  })

  it('chains a run through a flag that touches one already in it', () => {
    // A (x 75..125) touches B (125..175), B touches C (175..225); A doesn't touch C
    const runs = thicknessRuns([flag('a', 1, '4in'), flag('b', 2, '4in'), flag('c', 3, '4in')], 10)
    expect(runs.map(run => run.flagIds)).toEqual([['a', 'b', 'c']])
    // A fourth flag below the first (y 125..175) touches A, two flags back: it still joins
    const under = flag('d', 4, '4in', { sketch_x: 100, sketch_y: 150 })
    expect(thicknessRuns([flag('a', 1, '4in'), flag('b', 2, '4in'), flag('c', 3, '4in'), under], 10)
      .map(run => run.flagIds)).toEqual([['a', 'b', 'c', 'd']])
  })

  it('never joins flags of another slab, touching or not', () => {
    const runs = thicknessRuns([flag('f1', 1, '4in'), flag('f2', 2, '7in'), flag('f3', 3, '7in_as_4in')], 10)
    expect(runs.map(run => [run.label, run.flagIds])).toEqual([['4" Conc.', ['f1']], ['7" Conc.', ['f2', 'f3']]])
  })
})

describe('labelledAreas', () => {
  it("numbers the areas A1, A2, ... by their flag's display order, then their own, leaving out other flags' areas", () => {
    const flags = [flag('f1', 1, '4in'), flag('f2', 2, '4in')]
    const area = (id, flagId, order) => ({ non_assessable_area_id: id, flag_id: flagId, display_order: order })
    const areas = [area('a', 'f2', 1), area('b', 'f1', 2), area('c', 'f1', 1), area('d', 'elsewhere', 1)]
    expect(labelledAreas(areas, flags).map(({ area: found, label }) => [found.non_assessable_area_id, label])).toEqual([
      ['c', 'A1'], ['b', 'A2'], ['a', 'A3'],
    ])
  })
})
