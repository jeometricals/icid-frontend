import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BundleModal from '../BundleModal'
import BundlePanel, { FROZEN_UNBUNDLE } from '../BundlePanel'
import CurbControl, { CURB_HINT } from '../CurbControl'
import SegmentPanel from '../SegmentPanel'
import * as api from '../../../services/api'

vi.mock('../../../services/api', () => ({
  bundleFlags: vi.fn(), getMeasurement: vi.fn(), updateMeasurement: vi.fn(), unbundleMeasurement: vi.fn(),
  updateSegment: vi.fn(), deleteSegment: vi.fn(),
}))

const PAGE = { pir_page_id: 'page-1', scale_px_per_ft: 10 }
const flag = (n, x, extra = {}) => ({
  id: `f${n}`, display_order: n, shape: 'rectangle', dimensions: { L: 5, W: 5 }, sketch_x: x, sketch_y: 100,
  rotation: 0, surveyed_thickness: '4in', surveyed_is_assessable: true, pay_item_id: null, computed_quantity: 25, ...extra,
})
const A = flag(1, 100)
const B = flag(2, 150)
const C = flag(3, 200)
const bundle = (extra = {}) => ({
  measurement_id: 'm1', outer_dimensions: { rectangles: [{ L: 10, W: 5 }] }, outer_area: 50, deductions: [],
  needs_remeasure: false, surveyed_thickness: '4in', surveyed_is_assessable: true, frozen: false,
  claimed_by_idr_number: null, created_at: '2026-10-29T10:00:00Z', created_by_name: 'Reza Mousavian',
  members: [{ flag_id: 'f1', display_order: 1, area_share_fraction: 0.5, quantity: 25, claimed_by_idr_id: null },
    { flag_id: 'f2', display_order: 2, area_share_fraction: 0.5, quantity: 25, claimed_by_idr_id: null }],
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BundleModal (Slice Y4a)', () => {
  it('bundles the selected flags with the outline typed', async () => {
    const onBundled = vi.fn()
    api.bundleFlags.mockResolvedValue(bundle())
    render(<BundleModal page={PAGE} flags={[B, A]} onClose={vi.fn()} onBundled={onBundled} />)
    const bundleButton = screen.getByRole('button', { name: 'Bundle' })
    expect(bundleButton).toBeDisabled() // no outline yet
    expect(screen.getByTestId('bundle-problem')).toHaveTextContent('Rectangle A needs a length and a width above 0')
    await userEvent.type(screen.getByLabelText('Rectangle A length (ft)'), '10')
    await userEvent.type(screen.getByLabelText('Rectangle A width (ft)'), '5')
    expect(screen.getByTestId('outline-total')).toHaveTextContent('Outline: 50.00 SF')
    expect(screen.queryByTestId('outline-differs')).not.toBeInTheDocument() // 50 = 25 + 25
    await userEvent.click(bundleButton)
    expect(api.bundleFlags).toHaveBeenCalledWith('page-1', ['f1', 'f2'], [{ L: 10, W: 5 }])
    await waitFor(() => expect(onBundled).toHaveBeenCalledWith(bundle()))
  })

  it("says why it can't bundle, as the server would, and says when the outline differs", async () => {
    render(<BundleModal page={PAGE} flags={[A, C]} onClose={vi.fn()} onBundled={vi.fn()} />)
    expect(screen.getByTestId('bundle-problem')).toHaveTextContent("Flag 3 doesn't abut the rest")
    expect(screen.getByRole('button', { name: 'Bundle' })).toBeDisabled()
  })

  it('takes up to three rectangles and shows the server\'s refusal', async () => {
    api.bundleFlags.mockRejectedValue(new Error('The flags changed meanwhile; read them again'))
    render(<BundleModal page={PAGE} flags={[A, B]} onClose={vi.fn()} onBundled={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Add rectangle/ }))
    await userEvent.click(screen.getByRole('button', { name: /Add rectangle/ }))
    expect(screen.queryByRole('button', { name: /Add rectangle/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove rectangle C' }))
    await userEvent.type(screen.getByLabelText('Rectangle A length (ft)'), '8')
    await userEvent.type(screen.getByLabelText('Rectangle A width (ft)'), '5')
    await userEvent.type(screen.getByLabelText('Rectangle B length (ft)'), '2')
    await userEvent.type(screen.getByLabelText('Rectangle B width (ft)'), '4')
    expect(screen.getByTestId('outline-differs')).toHaveTextContent('-2.00 SF')
    await userEvent.click(screen.getByRole('button', { name: 'Bundle' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('read them again')
  })
})

describe('BundlePanel (Slice Y4a)', () => {
  it('shows the bundle and marks it re-measured', async () => {
    api.getMeasurement.mockResolvedValue(bundle({ needs_remeasure: true,
      deductions: [{ type: 'non_ass_area', area_sf: 2, source_flag_id: 'f1' }] }))
    api.updateMeasurement.mockResolvedValue(bundle())
    const onChanged = vi.fn()
    render(<BundlePanel measurementId="m1" number={1} flags={[A, B]} onChanged={onChanged} onUnbundled={vi.fn()} />)
    expect(await screen.findByRole('heading', { name: 'Bundle M1' })).toBeInTheDocument()
    expect(screen.getByText(/formed by Reza Mousavian/)).toBeInTheDocument()
    expect(screen.getByTestId('bundle-outer-area')).toHaveTextContent('Outer area 50.00 SF')
    expect(screen.getByText('Non-assessable area (flag #1) 2.00 SF')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'Mark re-measured' }))
    expect(api.updateMeasurement).toHaveBeenCalledWith('m1', { needs_remeasure: false })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Mark re-measured' })).not.toBeInTheDocument()
  })

  it('saves a new outline', async () => {
    api.getMeasurement.mockResolvedValue(bundle())
    api.updateMeasurement.mockResolvedValue(bundle({ outer_area: 60, outer_dimensions: { rectangles: [{ L: 12, W: 5 }] } }))
    render(<BundlePanel measurementId="m1" number={1} flags={[A, B]} onChanged={vi.fn()} onUnbundled={vi.fn()} />)
    await userEvent.click(await screen.findByRole('button', { name: /Edit outline/ }))
    const length = screen.getByLabelText('Rectangle A length (ft)')
    await userEvent.clear(length)
    await userEvent.type(length, '12')
    await userEvent.click(screen.getByRole('button', { name: 'Save outline' }))
    expect(api.updateMeasurement).toHaveBeenCalledWith('m1', { outer_dimensions: { rectangles: [{ L: 12, W: 5 }] } })
    expect(await screen.findByTestId('bundle-outer-area')).toHaveTextContent('60.00 SF')
  })

  it('unbundles after asking', async () => {
    api.getMeasurement.mockResolvedValue(bundle())
    api.unbundleMeasurement.mockResolvedValue(undefined)
    const onUnbundled = vi.fn()
    render(<BundlePanel measurementId="m1" number={1} flags={[A, B]} onChanged={vi.fn()} onUnbundled={onUnbundled} />)
    await userEvent.click(await screen.findByRole('button', { name: /Unbundle/ }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Unbundle' }))
    expect(api.unbundleMeasurement).toHaveBeenCalledWith('m1')
    await waitFor(() => expect(onUnbundled).toHaveBeenCalled())
  })

  it("a frozen bundle can't be unbundled or re-outlined, and says why", async () => {
    api.getMeasurement.mockResolvedValue(bundle({ frozen: true, claimed_by_idr_number: 'Y15' }))
    render(<BundlePanel measurementId="m1" number={1} flags={[A, B]} onChanged={vi.fn()} onUnbundled={vi.fn()} />)
    const unbundle = await screen.findByRole('button', { name: /Unbundle/ })
    expect(unbundle).toBeDisabled()
    expect(unbundle.parentElement).toHaveAttribute('title', FROZEN_UNBUNDLE('Y15'))
    expect(screen.getByRole('button', { name: /Edit outline/ })).toBeDisabled()
  })
})

describe('CurbControl and SegmentPanel (Slice Y4a)', () => {
  const LF = [{ contract_item_id: 'aa', item_no: '4.08 AA', budget_code: 'HW-200(S)', description: 'Concrete curb', pay_unit: 'L.F.' }]

  it('picks a type and pay item, then draws; Finish takes two points', async () => {
    const props = { canDraw: true, busy: false, type: 'curb_concrete', onType: vi.fn(), payItemId: null, onPayItem: vi.fn(),
      lfItems: LF, onStart: vi.fn(), onFinish: vi.fn(), onCancel: vi.fn(), disabledReason: 'x' }
    const { rerender } = render(<CurbControl drawing={false} points={[]} {...props} />)
    await userEvent.selectOptions(screen.getByLabelText('Curb type'), 'curb_granite')
    expect(props.onType).toHaveBeenCalledWith('curb_granite')
    await userEvent.selectOptions(screen.getByLabelText('Curb pay item'), 'aa')
    expect(props.onPayItem).toHaveBeenCalledWith('aa')
    await userEvent.click(screen.getByRole('button', { name: 'Draw curb' }))
    expect(props.onStart).toHaveBeenCalled()
    rerender(<CurbControl drawing points={[{ x: 0, y: 0 }]} {...props} />)
    expect(screen.getByRole('button', { name: 'Finish' })).toBeDisabled()
    // One row while drawing: the hint is a tooltip, not text that wraps the toolbar (Slice Y4b)
    expect(screen.getByText('Drawing a curb')).toHaveAttribute('title', CURB_HINT)
    expect(screen.getByTestId('curb-drawing')).toHaveClass('flex-nowrap')
    rerender(<CurbControl drawing points={[{ x: 0, y: 0 }, { x: 5, y: 0 }]} {...props} />)
    expect(screen.getByRole('button', { name: 'Finish' })).toBeEnabled()
  })

  it("is disabled with its reason for whoever can't draw", () => {
    render(<CurbControl drawing={false} points={[]} canDraw={false} disabledReason="Set this page's scale to draw curbs."
      busy={false} type="curb_concrete" onType={vi.fn()} payItemId={null} onPayItem={vi.fn()} lfItems={[]}
      onStart={vi.fn()} onFinish={vi.fn()} onCancel={vi.fn()} />)
    const draw = screen.getByRole('button', { name: 'Draw curb' })
    expect(draw).toBeDisabled()
    expect(draw).toHaveAttribute('title', "Set this page's scale to draw curbs.")
  })

  const SEGMENT = { segment_id: 'sg-1', segment_type: 'curb_concrete', pay_item_id: null, length_ft: 12.5,
    reported_length_ft: null, length_delta_reason: null, points: [{ x: 0, y: 0 }, { x: 125, y: 0 }] }

  it('changes a curb\'s type, pay item and reported length, sending only what changed', async () => {
    api.updateSegment.mockImplementation(async (id, body) => ({ ...SEGMENT, ...body }))
    const onSaved = vi.fn()
    render(<SegmentPanel segment={SEGMENT} lfItems={LF} writer onSaved={onSaved} onDeleted={vi.fn()} />)
    expect(screen.getByText('Drawn length 12.50 LF · 2 points')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'curb_granite')
    await userEvent.selectOptions(screen.getByLabelText('Pay item'), 'aa')
    await userEvent.type(screen.getByLabelText(/Reported length/), '13')
    await userEvent.type(screen.getByLabelText('Why it differs'), 'taped on site')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(api.updateSegment).toHaveBeenCalledWith('sg-1', { segment_type: 'curb_granite', pay_item_id: 'aa',
      reported_length_ft: 13, length_delta_reason: 'taped on site' })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('deletes a curb after asking; a reader gets no buttons', async () => {
    api.deleteSegment.mockResolvedValue(undefined)
    const onDeleted = vi.fn()
    const { unmount } = render(<SegmentPanel segment={SEGMENT} lfItems={LF} writer onSaved={vi.fn()} onDeleted={onDeleted} />)
    await userEvent.click(screen.getByRole('button', { name: /Delete curb/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete curb' }))
    expect(api.deleteSegment).toHaveBeenCalledWith('sg-1')
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(SEGMENT))
    unmount()
    render(<SegmentPanel segment={SEGMENT} lfItems={LF} writer={false} onSaved={vi.fn()} onDeleted={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Delete curb/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Type')).toBeDisabled()
  })
})
