import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import IdrFlagsSection, {
  FROZEN_NOTE, LIVE_NOTE, NO_FLAGS, NO_TASK_ORDER, NO_TASK_ORDER_DRAFT,
} from '../IdrFlagsSection'
import * as api from '../../services/api'
import { PED_RAMP_SITE, idrFlag, idrFlagsData } from '../../test/idrFlags'

vi.mock('../../services/api', () => ({
  excludeIdrFlag: vi.fn(), includeIdrFlag: vi.fn(), listTaskOrders: vi.fn(),
  getIdrSegments: vi.fn(), excludeIdrSegment: vi.fn(), includeIdrSegment: vi.fn(),
}))

const IDR = { idr_id: 'idr-1', project_id: 'SE384', status: 'draft', task_order_id: 'to-1' }
const TASK_ORDERS = [{ id: 'to-1', task_order_number: 'TO-7' }, { id: 'to-2', task_order_number: 'TO-8' }]

const FLAGS = [
  idrFlag(),
  idrFlag({ flag_id: 'flag-2', display_order: 2, page_number: 2, state: 'excluded', override: 'exclude' }),
  idrFlag({
    flag_id: 'flag-3', display_order: 3, property_id: 'prop-2', ...PED_RAMP_SITE, pay_item_id: null, pay_item_ref: null,
    budget_code: null, pay_item_description: null, unit: null, amount: null, quantity_sf: 12.5,
  }),
  idrFlag({
    flag_id: 'flag-4', display_order: 4, state: 'claimed_elsewhere', claimed_by_idr_id: 'idr-other',
    claimed_by_idr_number: '003', is_constructed: true, constructed_on: '2026-10-03',
  }),
]

beforeEach(() => {
  vi.clearAllMocks()
  api.listTaskOrders.mockResolvedValue(TASK_ORDERS)
  api.getIdrSegments.mockResolvedValue(segmentsData([]))
})

function renderSection(props = {}) {
  const handlers = { onRetry: vi.fn(), onTaskOrderChange: vi.fn(async () => {}), onChanged: vi.fn() }
  const view = render(
    <MemoryRouter>
      <IdrFlagsSection idr={IDR} data={idrFlagsData(FLAGS, { unmapped: 1 })} {...handlers} {...props} />
    </MemoryRouter>
  )
  return { ...view, ...handlers }
}

const flagsTable = () => screen.getByRole('table', { name: 'Flags' })
const rowOf = (number) => within(flagsTable()).getAllByRole('row').find(row => within(row).queryByText(`#${number}`))
const checkbox = (number, site = 'Queens Block 123 Lot 45') =>
  screen.getByRole('checkbox', { name: `Attribute flag #${number} at ${site}` })

describe('IdrFlagsSection — what it shows', () => {
  it('heads itself with the attributed count out of all, and folds', async () => {
    renderSection()
    const heading = screen.getByRole('button', { name: 'Flags attributed (2 of 4)' })
    expect(heading).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(heading)
    expect(heading).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('table', { name: 'Flags' })).not.toBeInTheDocument()
  })

  it('lists each flag with its site, page, pay item, amount, state and a link to it in the sketch', () => {
    renderSection()
    const cells = (number) => within(rowOf(number)).getAllByRole('cell').map(cell => cell.textContent)
    expect(cells(1)).toEqual(['#1', 'Queens Block 123 Lot 45', '1', '608-01 — 4" Concrete Sidewalk', '50 SF', 'Attributed', 'View in sketch'])
    expect(cells(2)).toContain('Excluded')
    expect(cells(3)).toEqual([
      '#3', 'Atlantic Ave & Court St — NE Quadrant (Facing Court St)', '1', 'No pay item', '12.5 SF', 'Attributed', 'View in sketch',
    ])
    expect(within(rowOf(1)).getByRole('link', { name: 'View in sketch' }))
      .toHaveAttribute('href', '/project/SE384/properties/prop-1/pir?page=1&flag=flag-1')
    expect(within(rowOf(2)).getByRole('link', { name: 'View in sketch' }))
      .toHaveAttribute('href', '/project/SE384/properties/prop-1/pir?page=2&flag=flag-2')
  })

  it('links a flag another IDR claimed to that IDR, and mutes it and an excluded one', () => {
    renderSection()
    expect(within(rowOf(4)).getByRole('link', { name: 'Claimed by IDR 003' })).toHaveAttribute('href', '/project/SE384/idr/idr-other')
    expect(rowOf(4)).toHaveClass('text-gray-400')
    expect(rowOf(2)).toHaveClass('text-gray-400')
    expect(rowOf(1)).not.toHaveClass('text-gray-400')
  })

  it('rolls the attributed flags up by pay item, live, and counts the ones that add nothing', () => {
    renderSection()
    const rollup = screen.getByRole('table', { name: 'Pay items from flags' })
    const rows = within(rollup).getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell').map(cell => cell.textContent))
    expect(rows).toEqual([['608-01', '4" Concrete Sidewalk', 'B100', '50 SF', '1']])
    expect(screen.getByText(LIVE_NOTE)).toBeInTheDocument()
    expect(screen.getByText(/1 flag adds nothing here/)).toBeInTheDocument()
  })

  it("shows an approved IDR's frozen claim: its heading, the frozen note, no flag counts, constructed dates", () => {
    const claimed = [idrFlag({ state: 'claimed', claimed_by_idr_id: 'idr-1', claimed_by_idr_number: '005', constructed_on: '2026-10-03' })]
    renderSection({ idr: { ...IDR, status: 'approved' }, data: idrFlagsData(claimed, { frozen: true, status: 'approved' }) })
    expect(screen.getByRole('button', { name: 'Flags claimed (1)' })).toBeInTheDocument()
    expect(screen.getByText(FROZEN_NOTE)).toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: 'Pay items from flags' })).queryByRole('columnheader', { name: 'Flags' }))
      .not.toBeInTheDocument()
    expect(within(rowOf(1)).getByText('Claimed · constructed Oct 3')).toBeInTheDocument()
  })

  it.each([
    ['a draft without a task order, to its inspector', { task_order_id: null }, true, NO_TASK_ORDER_DRAFT],
    ['an IDR in review without a task order', { task_order_id: null, status: 'stage1_review' }, false, NO_TASK_ORDER],
    ['a task order whose sites have no flags', {}, true, NO_FLAGS],
  ])('says why there are no flags: %s', (_, idr, canPickTaskOrder, text) => {
    renderSection({ idr: { ...IDR, ...idr }, data: idrFlagsData([], { taskOrderId: idr.task_order_id ?? 'to-1' }), canPickTaskOrder })
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('spins while the flags load, and shows a failure with Retry', async () => {
    const { rerender, onRetry } = renderSection({ data: null, loading: true })
    expect(screen.getByRole('status', { name: 'Loading flags' })).toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <IdrFlagsSection idr={IDR} data={null} error="Network error" onRetry={onRetry} onChanged={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this IDR's flags: Network error")
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })
})

describe('IdrFlagsSection — the task order', () => {
  it('names the task order, linked, to someone who can\'t change it', async () => {
    renderSection()
    expect(await screen.findByRole('link', { name: 'TO-7' })).toHaveAttribute('href', '/project/SE384/task-orders/to-1')
    expect(api.listTaskOrders).toHaveBeenCalledWith('SE384')
    expect(screen.queryByLabelText('Task order')).not.toBeInTheDocument()
  })

  it('reads "None" without one', () => {
    renderSection({ idr: { ...IDR, task_order_id: null } })
    expect(screen.getByText('None')).toBeInTheDocument()
  })

  it('offers the project\'s task orders on a draft, and hands the picked one (or none) on', async () => {
    const { onTaskOrderChange } = renderSection({ canPickTaskOrder: true })
    const select = screen.getByLabelText('Task order')
    await waitFor(() => expect(select).toHaveValue('to-1'))
    expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual(['No task order', 'TO-7', 'TO-8'])
    await userEvent.selectOptions(select, 'to-2')
    expect(onTaskOrderChange).toHaveBeenCalledWith('to-2')
    await userEvent.selectOptions(select, '')
    expect(onTaskOrderChange).toHaveBeenLastCalledWith(null)
  })

  it('shows a refusal of the pick', async () => {
    renderSection({ canPickTaskOrder: true, onTaskOrderChange: vi.fn().mockRejectedValue(new Error('Task order is deleted')) })
    const select = screen.getByLabelText('Task order')
    await waitFor(() => expect(select).toHaveValue('to-1'))
    await userEvent.selectOptions(select, 'to-2')
    expect(await screen.findByText("Couldn't change the task order: Task order is deleted")).toBeInTheDocument()
  })

  it('shows a task order that is no longer listed as not found', async () => {
    renderSection({ idr: { ...IDR, task_order_id: 'to-gone' } })
    expect(await screen.findByText('Task order not found')).toBeInTheDocument()
  })

  it("says when the task orders can't be read", async () => {
    api.listTaskOrders.mockRejectedValue(new Error('Network error'))
    renderSection({ canPickTaskOrder: true })
    expect(await screen.findByText("Couldn't load the task orders: Network error")).toBeInTheDocument()
  })
})

describe('IdrFlagsSection — excluding and including', () => {
  it('gives no checkboxes to someone who may not change the flags', () => {
    renderSection()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('ticks the attributed flags, and has no box for one another IDR claimed', () => {
    renderSection({ canChange: true })
    expect(checkbox(1)).toBeChecked()
    expect(checkbox(2)).not.toBeChecked()
    expect(within(rowOf(4)).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('excludes a flag on unticking and includes one on ticking, handing on what the call answers', async () => {
    const answer = idrFlagsData([])
    api.excludeIdrFlag.mockResolvedValue(answer)
    api.includeIdrFlag.mockResolvedValue(answer)
    const { onChanged } = renderSection({ canChange: true })
    await userEvent.click(checkbox(1))
    expect(api.excludeIdrFlag).toHaveBeenCalledWith('idr-1', 'flag-1')
    expect(onChanged).toHaveBeenCalledWith(answer)
    await userEvent.click(checkbox(2))
    expect(api.includeIdrFlag).toHaveBeenCalledWith('idr-1', 'flag-2')
  })

  it('shows a refusal above the flags', async () => {
    api.excludeIdrFlag.mockRejectedValue(new Error('Flag is claimed by IDR 003'))
    const { onChanged } = renderSection({ canChange: true })
    await userEvent.click(checkbox(1))
    expect(await screen.findByText("Couldn't exclude flag #1: Flag is claimed by IDR 003")).toBeInTheDocument()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('locks the boxes while a change is on its way', async () => {
    api.excludeIdrFlag.mockReturnValue(new Promise(() => {}))
    renderSection({ canChange: true })
    await userEvent.click(checkbox(1))
    expect(checkbox(2)).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Curb segments (curb billing)
// ---------------------------------------------------------------------------

// A curb segment as getIdrSegments lists it: a 20 ft concrete curb at the flags' sidewalk, mapped to 4.08 AA, attributed
function segment(overrides = {}) {
  return {
    segment_id: 'seg-1', pir_id: 'pir-1', pir_page_id: 'page-1', page_number: 1, segment_type: 'curb_concrete',
    length_ft: 20, note: null, property_id: 'prop-1', property_kind: 'sidewalk', boro: 'Queens', block: '123',
    lot: '45', address: '12 Main St', intersection_street_1: null, intersection_street_2: null, quadrant: null,
    facing_street: null, display_address: '12 Main St', pay_item_id: 'item-aa', pay_item_ref: '4.08 AA',
    budget_code: 'HW-200(S)', pay_item_description: 'Concrete Curb', unit: 'LF', amount: 20, state: 'attributed',
    override: null, on_imported_site: true, claimed_by_idr_id: null, claimed_by_idr_number: null, constructed_on: null,
    deleted_at: null, ...overrides,
  }
}

// getIdrSegments' answer over some segments: live unless frozen, its rollup over the counted ones in LF
function segmentsData(segments, { frozen = false, unmapped = 0 } = {}) {
  const counted = segments.filter(s => s.state === (frozen ? 'claimed' : 'attributed'))
  const lines = {}
  for (const s of counted.filter(s => s.amount !== null)) {
    lines[s.pay_item_id] ??= {
      pay_item_id: frozen ? null : s.pay_item_id, pay_item_ref: s.pay_item_ref, budget_code: s.budget_code,
      description: s.pay_item_description, unit: 'LF', amount: 0, segment_count: frozen ? null : 0,
    }
    lines[s.pay_item_id].amount += s.amount
    if (!frozen) lines[s.pay_item_id].segment_count += 1
  }
  return {
    idr_id: 'idr-1', status: frozen ? 'approved' : 'draft', task_order_id: 'to-1', frozen,
    counts: {
      attributed: counted.length, excluded: segments.filter(s => s.state === 'excluded').length,
      claimed_elsewhere: segments.filter(s => s.state === 'claimed_elsewhere').length, total: segments.length,
    },
    segments, pay_items: Object.values(lines), unmapped,
  }
}

const SEGMENTS = [
  segment(),
  segment({
    segment_id: 'seg-2', segment_type: 'curb_concrete_depressed', length_ft: 10, amount: 10, pay_item_id: 'item-ab',
    pay_item_ref: '4.08 AB', pay_item_description: 'Depressed Concrete Curb',
  }),
  segment({ segment_id: 'seg-3', segment_type: 'curb_granite', page_number: 2, state: 'excluded', override: 'exclude' }),
  segment({ segment_id: 'seg-4', state: 'claimed_elsewhere', claimed_by_idr_id: 'idr-other', claimed_by_idr_number: '003' }),
]
const segmentsTable = () => screen.findByRole('table', { name: 'Curb segments' })
const segmentBox = (kind, page = 1) =>
  screen.getByRole('checkbox', { name: `Attribute ${kind} at Queens Block 123 Lot 45, page ${page}` })

describe('IdrFlagsSection — curb segments', () => {
  it('reads them for the IDR, heads them with the attributed count, and rolls them up per pay item in LF', async () => {
    api.getIdrSegments.mockResolvedValue(segmentsData(SEGMENTS, { unmapped: 1 }))
    renderSection()
    await segmentsTable()
    expect(api.getIdrSegments).toHaveBeenCalledWith('idr-1')
    expect(screen.getByRole('heading', { name: 'Curb segments (2 of 4)' })).toBeInTheDocument()
    const rollup = screen.getByRole('table', { name: 'Pay items from curb segments' })
    expect(within(rollup).getAllByRole('row').slice(1).map(row => row.textContent)).toEqual([
      '4.08 AAConcrete CurbHW-200(S)20 LF1', '4.08 ABDepressed Concrete CurbHW-200(S)10 LF1',
    ])
    expect(screen.getByText(/1 segment adds nothing here/)).toBeInTheDocument()
  })

  it('lists each segment with its site, page, kind, length, pay item, LF and state', async () => {
    api.getIdrSegments.mockResolvedValue(segmentsData(SEGMENTS))
    renderSection({ canChange: true })
    const rows = within(await segmentsTable()).getAllByRole('row').slice(1)
    expect(rows[0].textContent).toBe('Queens Block 123 Lot 451Concrete curb20.00 ft4.08 AA — Concrete Curb20 LFAttributed')
    expect(rows[2].textContent).toContain('Granite curb')
    expect(within(rows[3]).getByRole('link', { name: 'Claimed by IDR 003' })).toHaveAttribute('href', '/project/SE384/idr/idr-other')
    expect(within(rows[3]).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(segmentBox('concrete curb')).toBeChecked()
    expect(segmentBox('granite curb', 2)).not.toBeChecked()
  })

  it('excludes on unticking and includes on ticking, showing what the call answers', async () => {
    api.getIdrSegments.mockResolvedValue(segmentsData(SEGMENTS))
    api.excludeIdrSegment.mockResolvedValue(segmentsData([segment({ state: 'excluded', override: 'exclude' })]))
    api.includeIdrSegment.mockResolvedValue(segmentsData(SEGMENTS))
    renderSection({ canChange: true })
    await segmentsTable()
    await userEvent.click(segmentBox('granite curb', 2))
    expect(api.includeIdrSegment).toHaveBeenCalledWith('idr-1', 'seg-3')
    await userEvent.click(segmentBox('concrete curb'))
    expect(api.excludeIdrSegment).toHaveBeenCalledWith('idr-1', 'seg-1')
    expect(await screen.findByRole('heading', { name: 'Curb segments (0 of 1)' })).toBeInTheDocument()
  })

  it('gives no checkboxes to someone who may not change them', async () => {
    api.getIdrSegments.mockResolvedValue(segmentsData(SEGMENTS))
    renderSection({ canChange: false })
    expect(within(await segmentsTable()).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('shows a refusal of a change', async () => {
    api.getIdrSegments.mockResolvedValue(segmentsData(SEGMENTS))
    api.excludeIdrSegment.mockRejectedValue(new Error('Segment is claimed by IDR 004'))
    renderSection({ canChange: true })
    await segmentsTable()
    await userEvent.click(segmentBox('concrete curb'))
    expect(await screen.findByText("Couldn't exclude the segment: Segment is claimed by IDR 004")).toBeInTheDocument()
  })

  it("heads an approved IDR's segments as claimed", async () => {
    api.getIdrSegments.mockResolvedValue(segmentsData([segment({ state: 'claimed', constructed_on: '2026-10-15' })], { frozen: true }))
    renderSection()
    expect(await screen.findByRole('heading', { name: 'Curb segments claimed (1)' })).toBeInTheDocument()
  })

  it('shows nothing when the IDR covers no segment', async () => {
    renderSection()
    await waitFor(() => expect(api.getIdrSegments).toHaveBeenCalled())
    expect(screen.queryByRole('table', { name: 'Curb segments' })).not.toBeInTheDocument()
  })

  it('shows its own failure with Retry, the flags still standing', async () => {
    api.getIdrSegments.mockRejectedValueOnce(new Error('Network down')).mockResolvedValueOnce(segmentsData(SEGMENTS))
    renderSection()
    expect(await screen.findByText("Couldn't load this IDR's curb segments: Network down")).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Flags' })).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Retry' }).at(-1))
    await segmentsTable()
  })
})
