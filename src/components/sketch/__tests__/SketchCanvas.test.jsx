import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SketchCanvas from '../SketchCanvas'

const PAGE = { pir_page_id: 'p1', page_number: 1, image_url: 'https://s/p1.png', width_px: 1200, height_px: 800, scale_px_per_ft: 10 }

describe('SketchCanvas — alignment', () => {
  it.each([0, 90, 180, 270])('lays the overlay over the image in native pixels at %i°, inside the turned box', (rotation) => {
    render(<SketchCanvas page={{ ...PAGE, rotation_deg: rotation }} flags={[]} showCorners />)
    const overlay = screen.getByTestId('sketch-overlay')
    const box = screen.getByTestId('page-box')
    // The overlay and the image share the box that is turned, so they turn together
    expect(box).toContainElement(overlay)
    expect(box).toContainElement(screen.getByRole('img', { name: 'PIR page 1' }))
    expect(box.style.transform).toContain(`rotate(${rotation}deg)`)
    expect(overlay).toHaveAttribute('viewBox', '0 0 1200 800')
    // The corner marks sit at (0, 0) and (width, height) of the page
    const corners = [...screen.getByTestId('corner-marks').querySelectorAll('[data-corner]')].map(mark => mark.dataset.corner)
    expect(corners).toEqual(['0,0', '1200,800'])
  })

  it('draws no corner marks unless asked, and no flag without a scale', () => {
    render(<SketchCanvas page={{ ...PAGE, rotation_deg: 0, scale_px_per_ft: null }} flags={[{
      id: 'f1', display_order: 1, shape: 'rectangle', dimensions: { L: 5, W: 5 }, sketch_x: 10, sketch_y: 10, surveyed_thickness: '4in',
    }]} />)
    expect(screen.queryByTestId('corner-marks')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Flag #1' })).not.toBeInTheDocument()
  })
})

// A tiny SMART PIR page at 10 px/ft: three flags in a row (4", 4", then 7" not assessable), two areas on flag 1, a
// feature of each kind of symbol and two curb runs
const FLAGS = [
  { id: 'f1', display_order: 1, shape: 'rectangle', dimensions: { L: 5, W: 5 }, sketch_x: 100, sketch_y: 100, rotation: 0,
    surveyed_thickness: '4in', surveyed_is_assessable: true, defect_codes: ['1', '6A'] },
  { id: 'f2', display_order: 2, shape: 'rectangle', dimensions: { L: 5, W: 5 }, sketch_x: 150, sketch_y: 100, rotation: 0,
    surveyed_thickness: '4in', surveyed_is_assessable: true, defect_codes: [] },
  { id: 'f3', display_order: 3, shape: 'rectangle', dimensions: { L: 5, W: 5 }, sketch_x: 200, sketch_y: 100, rotation: 0,
    surveyed_thickness: '7in', surveyed_is_assessable: false, surveyed_non_assessable_reason: 'scaffolding' },
]
const AREAS = [
  { non_assessable_area_id: 'na-2', flag_id: 'f1', display_order: 2, shape: 'triangle', dimensions: { a: 2, b: 1 },
    sketch_x: 110, sketch_y: 110, rotation: 0, reason: 'grass' },
  { non_assessable_area_id: 'na-1', flag_id: 'f1', display_order: 1, shape: 'rectangle', dimensions: { L: 1, W: 2 },
    sketch_x: 90, sketch_y: 90, rotation: 0, reason: 'driveway' },
]
const FEATURES = [
  { feature_id: 'ft-1', feature_type: 'hydrant', area_impact: 'marker_only', sketch_x: 50, sketch_y: 60, label: 'H1' },
  { feature_id: 'ft-2', feature_type: 'tree_pit', area_impact: 'subtract', shape: 'circle', dimensions: { r: 1 }, sketch_x: 101, sketch_y: 101, flag_id: 'f1' },
  { feature_id: 'ft-3', feature_type: 'cellar_door', area_impact: 'sits_on_top', shape: 'rectangle', dimensions: { L: 3, W: 2 }, sketch_x: 210, sketch_y: 105 },
  { feature_id: 'ft-4', feature_type: 'detectable_warning', area_impact: 'marker_only', sketch_x: 300, sketch_y: 60 },
  { feature_id: 'ft-5', feature_type: 'pole', area_impact: 'marker_only', sketch_x: 320, sketch_y: 60 },
  { feature_id: 'ft-6', feature_type: 'grate', area_impact: 'marker_only', sketch_x: 340, sketch_y: 60 },
  { feature_id: 'ft-7', feature_type: 'telephone', area_impact: 'marker_only', sketch_x: 360, sketch_y: 60 },
]
const SEGMENTS = [
  { segment_id: 'sg-1', segment_type: 'curb_concrete', points: [{ x: 0, y: 150 }, { x: 250, y: 150 }] },
  { segment_id: 'sg-2', segment_type: 'curb_granite', points: [{ x: 250, y: 150 }, { x: 280, y: 190 }] },
]

function renderSmart(props = {}) {
  return render(
    <SketchCanvas page={{ ...PAGE, rotation_deg: 0 }} flags={FLAGS} areas={AREAS} features={FEATURES} segments={SEGMENTS} {...props} />,
  )
}

const layer = (name) => screen.getByTestId(name)

describe('SketchCanvas — the SMART PIR layers', () => {
  it("fills each flag as the DOT report does, and crosses the one that isn't assessable", () => {
    renderSmart()
    const fills = ['1', '2', '3'].map(n => screen.getByRole('button', { name: `Flag #${n}` }).dataset.fill)
    expect(fills).toEqual(['stipple', 'stipple', 'hatch'])
    // The patterned fills point at the overlay's own patterns
    const fill = screen.getByRole('button', { name: 'Flag #1' }).querySelector('polygon').getAttribute('fill')
    expect(fill).toMatch(/^url\(#sketch-.+-stipple\)$/)
    expect(layer('sketch-overlay').querySelector(`pattern[id="${fill.slice(5, -1)}"]`)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Flag #3' }).querySelector('[data-testid="non-assessable-cross"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Flag #1' }).querySelector('[data-testid="non-assessable-cross"]')).toBeNull()
  })

  it('draws a new 7" flag white', () => {
    render(<SketchCanvas page={{ ...PAGE, rotation_deg: 0 }} flags={[{ ...FLAGS[2], surveyed_is_assessable: true }]} />)
    expect(screen.getByRole('button', { name: 'Flag #3' }).querySelector('polygon')).toHaveAttribute('fill', '#ffffff')
  })

  it('labels the non-assessable areas A1, A2 in display order, in yellow stripes', () => {
    renderSmart()
    const areas = [...layer('non-assessable-areas').querySelectorAll('[data-area-label]')]
    expect(areas.map(area => [area.dataset.areaLabel, area.querySelector('title').textContent])).toEqual([
      ['A1', 'A1: Driveway'], ['A2', 'A2: Grass'],
    ])
    expect(areas[0].querySelector('polygon').getAttribute('fill')).toMatch(/-stripes\)$/)
    // A 1 × 2 ft rectangle centred on (90, 90)
    expect(areas[0].querySelector('polygon')).toHaveAttribute('points', '85.00,80.00 95.00,80.00 95.00,100.00 85.00,100.00')
    expect(areas[0].querySelector('text')).toHaveTextContent('A1')
  })

  it("leaves out an area whose flag isn't on the page", () => {
    renderSmart({ flags: FLAGS.slice(1) })
    expect(layer('non-assessable-areas').querySelectorAll('[data-area-label]')).toHaveLength(0)
  })

  it('draws each feature by its key symbol', () => {
    renderSmart()
    const features = [...layer('features').querySelectorAll('[data-testid="feature"]')]
    expect(features.map(feature => feature.dataset.featureType)).toEqual(
      ['hydrant', 'tree_pit', 'cellar_door', 'detectable_warning', 'pole', 'grate', 'telephone'],
    )
    const glyph = (type) => layer('features').querySelector(`[data-glyph="${type}"]`)
    expect(glyph('hydrant').tagName).toBe('circle')
    expect(glyph('tree_pit')).toHaveTextContent('T')
    expect(glyph('cellar_door')).toHaveTextContent('CD')
    expect(glyph('telephone')).toHaveTextContent('TEL')
    expect(glyph('detectable_warning').querySelectorAll('circle')).toHaveLength(9)
    expect(features[0].querySelector('title')).toHaveTextContent('Hydrant H1')
    expect(features[0]).toHaveTextContent('H1')
    // A sized feature has its outline: dashed where it comes off a flag, solid where it sits on top
    expect(features[1].querySelector('polygon')).toHaveAttribute('stroke-dasharray', '4 3')
    expect(features[2].querySelector('polygon')).not.toHaveAttribute('stroke-dasharray')
    expect(features[0].querySelector('polygon')).toBeNull()
  })

  it('strokes each curb run by its type', () => {
    renderSmart()
    const lines = [...layer('segments').querySelectorAll('polyline')]
    expect(lines.map(line => [line.dataset.segmentType, line.getAttribute('points')])).toEqual([
      ['curb_concrete', '0.00,150.00 250.00,150.00'],
      ['curb_granite', '250.00,150.00 280.00,190.00'],
    ])
    expect(lines[0]).not.toHaveAttribute('stroke-dasharray')
    expect(lines[1]).toHaveAttribute('stroke-dasharray', '2 3')
    expect(lines[1].querySelector('title')).toHaveTextContent('Granite curb')
  })

  it("puts each flag's number in an orange circle and its defect codes in its middle", () => {
    renderSmart()
    const marks = layer('flag-marks')
    const first = marks.querySelector('[data-flag-marks="f1"]')
    expect(first.querySelector('circle')).toHaveAttribute('fill', '#ea580c')
    expect(first.querySelector('text')).toHaveTextContent('1')
    const codes = first.querySelector('[data-testid="defect-codes"]')
    expect(codes).toHaveTextContent('1 6A')
    expect(codes).toHaveAttribute('x', '100')
    expect(codes).toHaveAttribute('y', '100')
    expect(marks.querySelector('[data-flag-marks="f2"] [data-testid="defect-codes"]')).toBeNull()
  })

  it('labels each run of same-thickness flags', () => {
    renderSmart()
    const labels = [...layer('group-labels').querySelectorAll('text')]
    expect(labels.map(label => [label.textContent, label.dataset.run, label.getAttribute('x')])).toEqual([
      ['4" Conc.', 'f1,f2', '125'],
      ['7" Conc.', 'f3', '200'],
    ])
  })

  it('keeps the drawing out of the way of clicks', () => {
    renderSmart()
    for (const name of ['segments', 'non-assessable-areas', 'flag-marks', 'group-labels']) {
      expect(layer(name)).toHaveClass('pointer-events-none')
    }
    layer('features').querySelectorAll('[data-testid="feature"]').forEach(feature => expect(feature).toHaveClass('pointer-events-none'))
  })

  it('shows the legend in the lower-left, unturned, on every page', () => {
    renderSmart({ page: { ...PAGE, rotation_deg: 90 } })
    const legend = screen.getByRole('note', { name: 'Sketch legend' })
    expect(screen.getByTestId('page-box')).not.toContainElement(legend)
    expect(screen.getByTestId('rotated-page')).toContainElement(legend)
    expect(legend).toHaveClass('bottom-2', 'left-2')
    expect(legend).toHaveTextContent('New 4" (assessable)')
    expect(legend).toHaveTextContent('New 7" (assessable)')
    expect(legend).toHaveTextContent('Existing / non-assessable')
    expect(legend).toHaveTextContent('Non-assessable area')
    expect(legend).toHaveTextContent('North')
  })

  it.each(['segments', 'features', 'flag-marks', 'group-labels'])('draws the %s layer of the fixture as before', (name) => {
    renderSmart()
    expect(layer(name)).toMatchSnapshot()
  })
})
