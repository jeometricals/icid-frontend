import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SketchWorkspace, {
  AI_DETECT_TOOLTIP, NO_SCALE_REASON, PANEL_EMPTY_WRITER_TEXT,
} from '../SketchWorkspace'
import { EMPTY_TEXT } from '../FlagsFallbackList'
import * as api from '../../../services/api'
import { MOCK_CONTRACT_ITEMS } from '../../../test/contractItems'

vi.mock('../../../services/api', () => ({
  listFlags: vi.fn(), getContractItems: vi.fn(), createFlagOnPage: vi.fn(), updateFlag: vi.fn(), deleteFlag: vi.fn(),
  setPirPageScale: vi.fn(), listPirFeatures: vi.fn(), listPirSegments: vi.fn(), listFlagNonAssessableAreas: vi.fn(),
  updateSegment: vi.fn(),
}))

const PIR = { id: 'pir-1', project_id: 'HWS0023' }
const page = (number, extra = {}) => ({
  pir_page_id: `page-${number}`, pir_id: PIR.id, page_number: number, image_url: `https://s/p${number}.png`,
  width_px: 1200, height_px: 800, scale_px_per_ft: 10, rotation_deg: 0, ...extra,
})
const PAGES = [page(1), page(2)]
const flag = (id, extra = {}) => ({
  id, pir_id: PIR.id, pir_page_id: 'page-1', display_order: 1, shape: 'rectangle', dimensions: { L: 5, W: 5 },
  sketch_x: 300, sketch_y: 200, rotation: 0, surveyed_mark: 'number_only', surveyed_is_assessable: true,
  surveyed_non_assessable_reason: null, surveyed_thickness: '4in', added_in_field: false, pay_item_id: null,
  computed_quantity: 25, reported_quantity: null, quantity: 25, quantity_delta_reason: null, ...extra,
})

let flags

beforeEach(() => {
  vi.clearAllMocks()
  flags = [flag('f1'), flag('f2', { display_order: 2, sketch_x: 800, sketch_y: 500, surveyed_thickness: '7in' }),
    flag('f3', { display_order: 3, pir_page_id: 'page-2', pay_item_id: 'ci-1', reported_quantity: 30 })]
  api.listFlags.mockImplementation(async () => structuredClone(flags))
  api.getContractItems.mockResolvedValue(MOCK_CONTRACT_ITEMS)
  api.listPirFeatures.mockResolvedValue([])
  api.listPirSegments.mockResolvedValue([])
  api.listFlagNonAssessableAreas.mockResolvedValue([])
  api.createFlagOnPage.mockImplementation(async (pageId, body) => ({ ...flag('new'), ...body, pir_page_id: pageId }))
  api.updateFlag.mockImplementation(async (id, body) => ({ ...flags.find(found => found.id === id), ...body }))
  api.deleteFlag.mockResolvedValue(undefined)
  api.setPirPageScale.mockImplementation(async (id, scale) => ({ ...PAGES.find(found => found.pir_page_id === id), scale_px_per_ft: scale }))
  // The page's box on screen: the rotated page at its own size, at the screen's origin (one screen pixel per page pixel)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    if (this.dataset?.testid !== 'rotated-page') return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }
    const width = Number(this.dataset.width)
    const height = Number(this.dataset.height)
    return { left: 0, top: 0, width, height, right: width, bottom: height }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderWorkspace(props = {}) {
  const handlers = { onPageSaved: vi.fn(), onJump: vi.fn(), onImageError: vi.fn() }
  const view = render(<SketchWorkspace pir={PIR} page={PAGES[0]} pages={PAGES} writer {...handlers} {...props} />)
  return { ...handlers, ...view }
}

async function renderLoaded(props) {
  const result = renderWorkspace(props)
  await screen.findByRole('heading', { name: 'All flags' })
  return result
}

const overlay = () => screen.getByTestId('sketch-overlay')
const flagShape = (number) => screen.getByRole('button', { name: `Flag #${number}` })
const press = (target, x, y) => fireEvent.pointerDown(target, { clientX: x, clientY: y, button: 0, pointerId: 1 })
const moveTo = (x, y) => fireEvent.pointerMove(overlay(), { clientX: x, clientY: y, pointerId: 1 })
const release = (x, y) => fireEvent.pointerUp(overlay(), { clientX: x, clientY: y, pointerId: 1 })
const click = (target, x, y) => { press(target, x, y); release(x, y) }

describe('SketchWorkspace — the sketch', () => {
  it("reads the PIR's flags and contract items, and draws this page's flags in their thickness colours", async () => {
    await renderLoaded()
    expect(api.listFlags).toHaveBeenCalledWith(PIR.id)
    expect(api.getContractItems).toHaveBeenCalledWith('HWS0023')
    expect(flagShape(1).querySelector('polygon')).toHaveAttribute('stroke', '#2563eb')
    expect(flagShape(2).querySelector('polygon')).toHaveAttribute('stroke', '#dc2626')
    expect(screen.queryByRole('button', { name: 'Flag #3' })).not.toBeInTheDocument()
    // A 5 ft square at 10 px/ft, centred on (300, 200)
    expect(flagShape(1).querySelector('polygon')).toHaveAttribute('points', '275.00,175.00 325.00,175.00 325.00,225.00 275.00,225.00')
  })

  it('shows a failed read with Retry', async () => {
    api.listFlags.mockRejectedValueOnce(new Error('Not a member of this project'))
    renderWorkspace()
    expect(await screen.findByText("Couldn't load the flags: Not a member of this project")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'All flags' })).toBeInTheDocument()
  })
})

describe('SketchWorkspace — placing flags', () => {
  it('arms a shape (a crosshair over the page) and Esc disarms it', async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Trapezoid' }))
    expect(screen.getByRole('button', { name: 'Trapezoid' })).toHaveAttribute('aria-pressed', 'true')
    expect(overlay()).toHaveClass('cursor-crosshair')
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Trapezoid' })).toHaveAttribute('aria-pressed', 'false')
    expect(overlay()).not.toHaveClass('cursor-crosshair')
  })

  it('places the armed shape where the page is clicked, with the defaults, and selects it', async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle' }))
    click(overlay(), 640, 410)
    await waitFor(() => expect(api.createFlagOnPage).toHaveBeenCalled())
    expect(api.createFlagOnPage).toHaveBeenCalledWith('page-1', {
      display_order: 4, shape: 'rectangle', dimensions: { L: 5, W: 5 }, sketch_x: 640, sketch_y: 410, rotation: 0,
      surveyed_mark: 'number_only', surveyed_is_assessable: true, surveyed_thickness: '4in', added_in_field: false,
    })
    expect(await screen.findByRole('button', { name: 'Flag #4' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('complementary', { name: 'Flag #4' })).toBeInTheDocument()
    // The shape stays armed for the next one
    expect(screen.getByRole('button', { name: 'Rectangle' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('stores the place in native page pixels on a turned page', async () => {
    const turned = { ...PAGES[0], rotation_deg: 90 }
    await renderLoaded({ page: turned })
    await userEvent.click(screen.getByRole('button', { name: 'Arc' }))
    // Turned a quarter clockwise, the page's top-left corner (0, 0) shows at the box's top right (800, 0)
    click(overlay(), 800, 0)
    await waitFor(() => expect(api.createFlagOnPage).toHaveBeenCalled())
    const [, body] = api.createFlagOnPage.mock.calls[0]
    expect(body.sketch_x).toBeCloseTo(0)
    expect(body.sketch_y).toBeCloseTo(0)
  })

  it('says why nothing can be drawn on a page without a scale', async () => {
    await renderLoaded({ page: { ...PAGES[0], scale_px_per_ft: null } })
    expect(screen.getByRole('button', { name: 'Rectangle' })).toBeDisabled()
    expect(screen.getByText(NO_SCALE_REASON)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calibrate' })).toBeEnabled()
  })

  it('shows a refused placement', async () => {
    api.createFlagOnPage.mockRejectedValue(Object.assign(new Error('Page is deleted'), { status: 400 }))
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle' }))
    click(overlay(), 100, 100)
    expect(await screen.findByText("Couldn't add the flag: Page is deleted")).toBeInTheDocument()
  })
})

describe('SketchWorkspace — selecting and deleting', () => {
  it('selects a flag by clicking it and clears the selection on empty page', async () => {
    await renderLoaded()
    expect(screen.getByText(PANEL_EMPTY_WRITER_TEXT)).toBeInTheDocument()
    click(flagShape(2), 800, 500)
    expect(flagShape(2)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('complementary', { name: 'Flag #2' })).toBeInTheDocument()
    click(overlay(), 50, 50)
    expect(flagShape(2)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(PANEL_EMPTY_WRITER_TEXT)).toBeInTheDocument()
  })

  it('deletes the selected flag with the Delete key', async () => {
    await renderLoaded()
    click(flagShape(1), 300, 200)
    await userEvent.keyboard('{Delete}')
    await waitFor(() => expect(api.deleteFlag).toHaveBeenCalledWith('f1'))
    expect(screen.queryByRole('button', { name: 'Flag #1' })).not.toBeInTheDocument()
    expect(screen.getByText('Flag #1 deleted.')).toBeInTheDocument()
  })

  it("deletes with the panel's button, and keeps the flag when refused", async () => {
    api.deleteFlag.mockRejectedValueOnce(new Error('Demo mode: flags are read-only'))
    await renderLoaded()
    click(flagShape(1), 300, 200)
    await userEvent.click(screen.getByRole('button', { name: 'Delete flag' }))
    expect(await screen.findByText("Couldn't delete flag #1: Demo mode: flags are read-only")).toBeInTheDocument()
    expect(flagShape(1)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete flag' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Flag #1' })).not.toBeInTheDocument())
  })

  it("updates the drawing from the panel's saved answer", async () => {
    await renderLoaded()
    click(flagShape(1), 300, 200)
    await userEvent.click(screen.getByRole('radio', { name: '7" as 4"' }))
    await waitFor(() => expect(flagShape(1).querySelector('polygon')).toHaveAttribute('stroke', '#d97706'))
  })
})

describe('SketchWorkspace — dragging', () => {
  it('moves a selected flag with the pointer and saves its new place on release', async () => {
    await renderLoaded()
    click(flagShape(1), 300, 200) // select it first
    press(flagShape(1), 300, 200)
    moveTo(330, 240)
    // The overlay follows the pointer before anything is saved
    expect(flagShape(1).querySelector('polygon')).toHaveAttribute('points', '305.00,215.00 355.00,215.00 355.00,265.00 305.00,265.00')
    expect(api.updateFlag).not.toHaveBeenCalled()
    release(330, 240)
    await waitFor(() => expect(api.updateFlag).toHaveBeenCalledWith('f1', { sketch_x: 330, sketch_y: 240 }))
  })

  it('puts the flag back on Esc', async () => {
    await renderLoaded()
    click(flagShape(1), 300, 200)
    press(flagShape(1), 300, 200)
    moveTo(400, 400)
    await userEvent.keyboard('{Escape}')
    release(400, 400)
    expect(api.updateFlag).not.toHaveBeenCalled()
    expect(flagShape(1).querySelector('polygon')).toHaveAttribute('points', '275.00,175.00 325.00,175.00 325.00,225.00 275.00,225.00')
  })

  it("doesn't drag a flag that wasn't selected yet, and puts a refused move back", async () => {
    api.updateFlag.mockRejectedValue(new Error('Flag is deleted'))
    await renderLoaded()
    press(flagShape(1), 300, 200)
    moveTo(400, 400)
    release(400, 400)
    expect(api.updateFlag).not.toHaveBeenCalled()

    press(flagShape(1), 300, 200)
    moveTo(310, 210)
    release(310, 210)
    expect(await screen.findByText("Couldn't move flag #1: Flag is deleted")).toBeInTheDocument()
    expect(flagShape(1).querySelector('polygon')).toHaveAttribute('points', '275.00,175.00 325.00,175.00 325.00,225.00 275.00,225.00')
  })

  it('drags a just-placed flag while its shape is still armed', async () => {
    api.updateFlag.mockImplementation(async (id, body) => ({ ...flag(id, { display_order: 4, sketch_x: 640, sketch_y: 410 }), ...body }))
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle' }))
    click(overlay(), 640, 410)
    expect(await screen.findByRole('button', { name: 'Flag #4' })).toHaveAttribute('aria-pressed', 'true')

    // A press on the new flag drags it rather than placing another
    press(flagShape(4), 640, 410)
    moveTo(700, 450)
    release(700, 450)
    await waitFor(() => expect(api.updateFlag).toHaveBeenCalledWith('new', { sketch_x: 700, sketch_y: 450 }))
    expect(api.createFlagOnPage).toHaveBeenCalledTimes(1)
    // Its anchor is the new place: a 5 ft square at 10 px/ft, centred on (700, 450)
    await waitFor(() => expect(flagShape(4).querySelector('polygon'))
      .toHaveAttribute('points', '675.00,425.00 725.00,425.00 725.00,475.00 675.00,475.00'))
    // The shape stays armed, and the empty page still places
    expect(screen.getByRole('button', { name: 'Rectangle' })).toHaveAttribute('aria-pressed', 'true')
    click(overlay(), 100, 100)
    await waitFor(() => expect(api.createFlagOnPage).toHaveBeenCalledTimes(2))
  })
})

describe('SketchWorkspace — calibrating', () => {
  it('takes two clicks, asks for the distance and sets the page scale to pixels / feet', async () => {
    const { onPageSaved } = await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Calibrate' }))
    expect(screen.getByRole('button', { name: 'Calibrate' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Click the first point/)).toBeInTheDocument()
    click(overlay(), 100, 100)
    // A click on a flag counts as a point while calibrating
    click(flagShape(1), 400, 500)
    expect(screen.getByTestId('calibration').querySelector('line')).toHaveAttribute('x2', '400')
    const dialog = screen.getByRole('dialog', { name: 'Calibrate scale' })
    expect(dialog).toHaveTextContent('The points are 500.0 px apart on page 1.')
    await userEvent.type(within(dialog).getByLabelText('Distance between them (ft)'), '25')
    expect(dialog).toHaveTextContent('Scale: 20.00 px/ft')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Set scale' }))
    expect(api.setPirPageScale).toHaveBeenCalledWith('page-1', 20)
    await waitFor(() => expect(onPageSaved).toHaveBeenCalledWith(expect.objectContaining({ scale_px_per_ft: 20 })))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calibrate' })).toHaveAttribute('aria-pressed', 'false')
    expect(api.createFlagOnPage).not.toHaveBeenCalled()
  })

  it('cancels on Esc before the second click', async () => {
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Calibrate' }))
    click(overlay(), 100, 100)
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Calibrate' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('calibration')).not.toBeInTheDocument()
  })

  it('keeps a refused scale in its dialog', async () => {
    api.setPirPageScale.mockRejectedValue(new Error('scale must be a positive number'))
    await renderLoaded()
    await userEvent.click(screen.getByRole('button', { name: 'Calibrate' }))
    click(overlay(), 0, 0)
    click(overlay(), 30, 40)
    const dialog = screen.getByRole('dialog', { name: 'Calibrate scale' })
    await userEvent.type(within(dialog).getByLabelText('Distance between them (ft)'), '5')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Set scale' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('scale must be a positive number')
  })
})

describe('SketchWorkspace — the fallback list', () => {
  it('lists every flag across the pages, read-only', async () => {
    await renderLoaded()
    const list = screen.getByRole('region', { name: 'All flags' })
    const rows = within(list).getAllByRole('row').slice(1)
    expect(rows.map(row => row.textContent)).toEqual([
      '11Rectangle4"—25.00 SF—',
      '12Rectangle7"—25.00 SF—',
      `23Rectangle4"${MOCK_CONTRACT_ITEMS[0].item_no} — ${MOCK_CONTRACT_ITEMS[0].description}25.00 SF30.00 SF`,
    ])
    expect(within(list).queryByRole('button')).not.toBeInTheDocument()
    expect(within(list).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it("jumps to a flag's page and selects it there", async () => {
    const { onJump, rerender } = await renderLoaded()
    const list = screen.getByRole('region', { name: 'All flags' })
    await userEvent.click(within(list).getAllByRole('row')[3])
    expect(onJump).toHaveBeenCalledWith(2)
    rerender(<SketchWorkspace pir={PIR} page={PAGES[1]} pages={PAGES} writer onPageSaved={vi.fn()} onJump={onJump} onImageError={vi.fn()} />)
    expect(flagShape(3)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('complementary', { name: 'Flag #3' })).toBeInTheDocument()
  })

  it('says so when there are no flags', async () => {
    flags = []
    await renderLoaded()
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument()
  })
})

describe('SketchWorkspace — a reader (a demo user)', () => {
  it('disables the toolbar, Calibrate and the panel, and neither drags nor deletes', async () => {
    await renderLoaded({ writer: false })
    expect(screen.getByRole('button', { name: 'Rectangle' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Calibrate' })).toBeDisabled()
    expect(screen.queryByText(NO_SCALE_REASON)).not.toBeInTheDocument()

    click(flagShape(1), 300, 200)
    const panel = screen.getByRole('complementary', { name: 'Flag #1' })
    expect(within(panel).getByLabelText('Length (ft)')).toBeDisabled()
    expect(within(panel).queryByRole('button', { name: 'Delete flag' })).not.toBeInTheDocument()

    press(flagShape(1), 300, 200)
    moveTo(400, 400)
    release(400, 400)
    await userEvent.keyboard('{Delete}')
    expect(api.updateFlag).not.toHaveBeenCalled()
    expect(api.deleteFlag).not.toHaveBeenCalled()
  })
})

describe('SketchWorkspace — features, segments and non-assessable areas', () => {
  const feature = (id, pageId, extra = {}) => ({
    feature_id: id, pir_page_id: pageId, feature_type: 'hydrant', area_impact: 'marker_only', sketch_x: 50, sketch_y: 60, ...extra,
  })
  const segment = (id, pageId) => ({
    segment_id: id, pir_page_id: pageId, segment_type: 'curb_concrete', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
  })
  const area = (id, flagId, order) => ({
    non_assessable_area_id: id, flag_id: flagId, display_order: order, shape: 'rectangle', dimensions: { L: 1, W: 1 },
    sketch_x: 300, sketch_y: 200, rotation: 0, reason: 'driveway',
  })

  beforeEach(() => {
    flags[0].non_assessable_areas_count = 2
    api.listPirFeatures.mockResolvedValue([feature('ft-1', 'page-1'), feature('ft-2', 'page-2', { feature_type: 'pole' })])
    api.listPirSegments.mockResolvedValue([segment('sg-1', 'page-1'), segment('sg-2', 'page-2')])
    api.listFlagNonAssessableAreas.mockResolvedValue([area('na-1', 'f1', 1), area('na-2', 'f1', 2)])
  })

  it("reads the PIR's features and segments, and the areas of each flag that has some, and draws this page's", async () => {
    await renderLoaded()
    expect(api.listPirFeatures).toHaveBeenCalledWith(PIR.id)
    expect(api.listPirSegments).toHaveBeenCalledWith(PIR.id)
    expect(api.listFlagNonAssessableAreas).toHaveBeenCalledTimes(1)
    expect(api.listFlagNonAssessableAreas).toHaveBeenCalledWith('f1')
    const features = [...screen.getByTestId('features').querySelectorAll('[data-testid="feature"]')]
    expect(features.map(found => found.dataset.featureType)).toEqual(['hydrant'])
    expect(screen.getByTestId('segments').querySelectorAll('polyline')).toHaveLength(1)
    const labels = [...screen.getByTestId('non-assessable-areas').querySelectorAll('[data-area-label]')]
    expect(labels.map(found => found.dataset.areaLabel)).toEqual(['A1', 'A2'])
  })

  it("shows a failed read of a flag's areas as the load error, with Retry", async () => {
    api.listFlagNonAssessableAreas.mockRejectedValueOnce(new Error('Flag not found'))
    renderWorkspace()
    expect(await screen.findByText("Couldn't load the flags: Flag not found")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('heading', { name: 'All flags' })
    expect(screen.getByTestId('non-assessable-areas').querySelectorAll('[data-area-label]')).toHaveLength(2)
  })

  it("lists the PIR's curb segments under the flags, every page's (Slice X.1)", async () => {
    await renderLoaded()
    const table = screen.getByRole('table', { name: 'Curb segments' })
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getAllByRole('row')[2]).toHaveTextContent(/^22Concrete curb/)
  })

  it("lets a writer report a segment's length in the table, and shows what it now counts (Slice X.2)", async () => {
    api.updateSegment.mockImplementation(async (id, body) => ({
      ...segment(id, 'page-1'), length_ft: 10, pay_item_id: null, reported_length_ft: body.reported_length_ft,
      effective_length_ft: body.reported_length_ft, is_overridden: true,
    }))
    await renderLoaded()
    const table = screen.getByRole('table', { name: 'Curb segments' })
    const [first] = within(table).getAllByRole('spinbutton', { name: 'Reported length (LF)' })
    await userEvent.type(first, '12.5')
    await userEvent.tab()
    await waitFor(() => expect(api.updateSegment).toHaveBeenCalledWith('sg-1', { reported_length_ft: 12.5 }))
    expect(await within(table).findByRole('button', { name: 'Clear override' })).toBeInTheDocument()
    expect(within(table).getAllByRole('spinbutton', { name: 'Reported length (LF)' })[0]).toHaveValue(12.5)
  })

  it('shows reported lengths read-only to a reader', async () => {
    api.listPirSegments.mockResolvedValue([{ ...segment('sg-1', 'page-1'), reported_length_ft: 7 }])
    await renderLoaded({ writer: false })
    const table = screen.getByRole('table', { name: 'Curb segments' })
    expect(within(table).queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('7.00 LF')
  })

  it('has no Curb segments table without segments', async () => {
    api.listPirSegments.mockResolvedValue([])
    await renderLoaded()
    expect(screen.queryByRole('heading', { name: 'Curb segments' })).not.toBeInTheDocument()
  })

  it("drops a deleted flag's areas from the page", async () => {
    await renderLoaded()
    await userEvent.click(flagShape(1))
    await userEvent.click(screen.getByRole('button', { name: 'Delete flag' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Flag #1' })).not.toBeInTheDocument())
    expect(screen.getByTestId('non-assessable-areas').querySelectorAll('[data-area-label]')).toHaveLength(0)
  })
})

describe('SketchWorkspace — the coming tool', () => {
  it('has Auto-detect with AI disabled, its tooltip saying when it comes, and no import or bulk upload', async () => {
    await renderLoaded()
    const ai = screen.getByRole('button', { name: 'Auto-detect with AI' })
    expect(ai).toBeDisabled()
    expect(ai).toHaveAttribute('title', AI_DETECT_TOOLTIP)
    expect(ai.parentElement).toHaveAttribute('title', 'Available when Vercel Pro is enabled (R1k).')
    // The JSON importer is the admin's page now, and bulk upload sits on Site Info
    expect(screen.queryByRole('button', { name: 'Import SMART PIR' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bulk upload PIRs' })).not.toBeInTheDocument()
  })
})

describe('SketchWorkspace — R1f: the flag to start with, and claims', () => {
  it('starts with the flag the URL names selected', async () => {
    await renderLoaded({ initialFlagId: 'f2' })
    expect(flagShape(2)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('complementary', { name: 'Flag #2' })).toBeInTheDocument()
  })

  it('opens the IDR that claimed a flag from its badge and from its panel', async () => {
    flags[0] = { ...flags[0], claimed_by_idr_id: 'idr-9', claimed_by_idr_number: '042', constructed_on: '2026-10-03' }
    const onOpenIdr = vi.fn()
    await renderLoaded({ onOpenIdr, initialFlagId: 'f1' })
    await userEvent.click(screen.getByRole('link', { name: /Open IDR 042/ }))
    expect(onOpenIdr).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1' }))
    await userEvent.click(within(screen.getByRole('complementary', { name: 'Flag #1' })).getByRole('button', { name: 'IDR 042' }))
    expect(onOpenIdr).toHaveBeenCalledTimes(2)
  })
})
