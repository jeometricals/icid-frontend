import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import SegmentsTable from '../SegmentsTable'

// A PIR's curb segments as a read-only table under the sketch workspace (Slice X.1)

const PAGES = [{ pir_page_id: 'page-1', page_number: 1 }, { pir_page_id: 'page-2', page_number: 2 }]
const CONTRACT_ITEMS = [
  { contract_item_id: 'ci-curb', item_no: '4.08 AA', description: 'Concrete curb', pay_unit: 'LF' },
  { contract_item_id: 'ci-granite', item_no: '4.08 GA', description: 'Granite curb', pay_unit: 'L.F.' },
  { contract_item_id: 'ci-sw', item_no: '4.13 AAS', description: '4in sidewalk', pay_unit: 'SF' },
]
const segment = (id, extra = {}) => ({
  segment_id: id, pir_page_id: 'page-1', segment_type: 'curb_concrete', length_ft: 34.25, pay_item_id: 'ci-curb',
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 50 }], ...extra,
})

const cells = (row) => [...row.querySelectorAll('td')].map(cell => cell.textContent)

describe('SegmentsTable', () => {
  it('lists each segment by page in drawing order: its shape, dimensions, pay item and derived quantity', () => {
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
      ['1', '1', 'Concrete curb', '34.25 ft · 3 runs', '4.08 AA — Concrete curb', '34.25 LF'],
      ['1', '2', 'Depressed concrete curb', 'no scale · 3 runs', '—', '—'],
      ['1', '3', 'Other', '34.25 ft · 3 runs', '4.13 AAS — 4in sidewalk', '—'],
      ['1', '4', 'Steel-faced curb', '34.25 ft · 3 runs', 'Not in the catalog', '—'],
      ['2', '5', 'Granite curb', '12.00 ft · 1 run', '4.08 GA — Granite curb', '12.00 LF'],
    ])
  })

  it('renders nothing without segments', () => {
    const { container } = render(<SegmentsTable pages={PAGES} contractItems={CONTRACT_ITEMS} segments={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
