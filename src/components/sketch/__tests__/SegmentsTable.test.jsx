import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SegmentsTable from '../SegmentsTable'
import * as api from '../../../services/api'

vi.mock('../../../services/api', () => ({ updateSegment: vi.fn() }))

// A PIR's curb segments as a table under the sketch workspace (Slice X.1), with a Reported column (Slice X.2)

const PAGES = [{ pir_page_id: 'page-1', page_number: 1 }, { pir_page_id: 'page-2', page_number: 2 }]
const CONTRACT_ITEMS = [
  { contract_item_id: 'ci-curb', item_no: '4.08 AA', description: 'Concrete curb', pay_unit: 'LF' },
  { contract_item_id: 'ci-granite', item_no: '4.08 GA', description: 'Granite curb', pay_unit: 'L.F.' },
  { contract_item_id: 'ci-sw', item_no: '4.13 AAS', description: '4in sidewalk', pay_unit: 'SF' },
]
const segment = (id, extra = {}) => {
  const base = {
    segment_id: id, pir_page_id: 'page-1', segment_type: 'curb_concrete', length_ft: 34.25, pay_item_id: 'ci-curb',
    reported_length_ft: null, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 50 }], ...extra,
  }
  return { ...base, effective_length_ft: base.reported_length_ft ?? base.length_ft, is_overridden: base.reported_length_ft != null }
}

const cells = (row) => [...row.querySelectorAll('td')].map(cell => cell.textContent)

beforeEach(() => vi.clearAllMocks())

describe('SegmentsTable', () => {
  it('lists each segment by page in drawing order: its shape, dimensions, pay item, reported length and derived quantity', () => {
    render(<SegmentsTable pages={PAGES} contractItems={CONTRACT_ITEMS} segments={[
      segment('sg-3', { pir_page_id: 'page-2', segment_type: 'curb_granite', pay_item_id: 'ci-granite', length_ft: 12,
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }),
      segment('sg-1'),
      segment('sg-2', { segment_type: 'curb_concrete_depressed', length_ft: null, pay_item_id: null }),
      segment('sg-4', { segment_type: 'other', pay_item_id: 'ci-sw' }),
      segment('sg-5', { segment_type: 'curb_steel_faced', pay_item_id: 'ci-gone' }),
    ]} />)
    const table = screen.getByRole('table', { name: 'Curb segments' })
    expect(screen.getByRole('heading', { name: 'Curb segments' })).toBeInTheDocument()
    const rows = within(table).getAllByRole('row')
    expect(rows.slice(1).map(cells)).toEqual([
      ['1', '1', 'Concrete curb', '34.25 ft · 3 runs', '4.08 AA — Concrete curb', '—', '34.25 LF'],
      ['1', '2', 'Depressed concrete curb', 'no scale · 3 runs', '—', '—', '—'],
      ['1', '3', 'Other', '34.25 ft · 3 runs', '4.13 AAS — 4in sidewalk', '—', '—'],
      ['1', '4', 'Steel-faced curb', '34.25 ft · 3 runs', 'Not in the catalog', '—', '—'],
      ['2', '5', 'Granite curb', '12.00 ft · 1 run', '4.08 GA — Granite curb', '—', '12.00 LF'],
    ])
  })

  it('renders nothing without segments', () => {
    const { container } = render(<SegmentsTable pages={PAGES} contractItems={CONTRACT_ITEMS} segments={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a reported length to a reader, and derives the quantity from it over the drawn length', () => {
    render(<SegmentsTable pages={PAGES} contractItems={CONTRACT_ITEMS}
      segments={[segment('sg-1', { reported_length_ft: 25 })]} />)
    const [, row] = within(screen.getByRole('table', { name: 'Curb segments' })).getAllByRole('row')
    expect(cells(row)).toEqual(['1', '1', 'Concrete curb', '34.25 ft · 3 runs', '4.08 AA — Concrete curb', '25.00 LF', '25.00 LF'])
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('lets a writer report a length, saved on blur, and passes the saved segment up', async () => {
    const onSaved = vi.fn()
    api.updateSegment.mockResolvedValue(segment('sg-1', { reported_length_ft: 25 }))
    render(<SegmentsTable pages={PAGES} contractItems={CONTRACT_ITEMS} segments={[segment('sg-1')]} writer onSaved={onSaved} />)
    const input = screen.getByRole('spinbutton', { name: 'Reported length (LF)' })
    expect(input).toHaveAttribute('placeholder', 'Same as drawn')
    expect(screen.queryByRole('button', { name: 'Clear override' })).not.toBeInTheDocument()
    await userEvent.type(input, '25')
    await userEvent.tab()
    await waitFor(() => expect(api.updateSegment).toHaveBeenCalledWith('sg-1', { reported_length_ft: 25 }))
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ segment_id: 'sg-1', reported_length_ft: 25 }))
  })

  it('takes 0 as a reported length, and on Enter', async () => {
    api.updateSegment.mockResolvedValue(segment('sg-1', { reported_length_ft: 0 }))
    render(<SegmentsTable pages={PAGES} contractItems={CONTRACT_ITEMS} segments={[segment('sg-1')]} writer />)
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Reported length (LF)' }), '0{Enter}')
    await waitFor(() => expect(api.updateSegment).toHaveBeenCalledWith('sg-1', { reported_length_ft: 0 }))
  })

  it('refuses a negative length without sending it', async () => {
    render(<SegmentsTable pages={PAGES} contractItems={CONTRACT_ITEMS} segments={[segment('sg-1')]} writer />)
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Reported length (LF)' }), '-3')
    await userEvent.tab()
    expect(screen.getByRole('alert')).toHaveTextContent('A length of 0 or more, or blank for the drawn length.')
    expect(api.updateSegment).not.toHaveBeenCalled()
  })

  it('"Clear override" reverts to the drawn length', async () => {
    const onSaved = vi.fn()
    api.updateSegment.mockResolvedValue(segment('sg-1'))
    render(<SegmentsTable pages={PAGES} contractItems={CONTRACT_ITEMS}
      segments={[segment('sg-1', { reported_length_ft: 25 })]} writer onSaved={onSaved} />)
    expect(screen.getByRole('spinbutton', { name: 'Reported length (LF)' })).toHaveValue(25)
    await userEvent.click(screen.getByRole('button', { name: 'Clear override' }))
    await waitFor(() => expect(api.updateSegment).toHaveBeenCalledWith('sg-1', { reported_length_ft: null }))
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ reported_length_ft: null }))
  })

  it('shows a refusal under the input', async () => {
    api.updateSegment.mockRejectedValue(new Error('Segment is deleted'))
    render(<SegmentsTable pages={PAGES} contractItems={CONTRACT_ITEMS} segments={[segment('sg-1')]} writer />)
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Reported length (LF)' }), '25')
    await userEvent.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save: Segment is deleted")
  })

  it('sends nothing when the value is unchanged', async () => {
    render(<SegmentsTable pages={PAGES} contractItems={CONTRACT_ITEMS}
      segments={[segment('sg-1', { reported_length_ft: 25 })]} writer />)
    await userEvent.click(screen.getByRole('spinbutton', { name: 'Reported length (LF)' }))
    await userEvent.tab()
    expect(api.updateSegment).not.toHaveBeenCalled()
  })
})
