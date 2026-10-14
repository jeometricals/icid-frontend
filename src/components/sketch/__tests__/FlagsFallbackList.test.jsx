import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FlagsFallbackList, { EMPTY_TEXT } from '../FlagsFallbackList'
import { MOCK_CONTRACT_ITEMS } from '../../../test/contractItems'

const PAGES = [{ pir_page_id: 'page-1', page_number: 1 }, { pir_page_id: 'page-2', page_number: 2 }]
const flag = (id, extra = {}) => ({
  id, pir_page_id: 'page-1', display_order: 1, shape: 'rectangle', surveyed_thickness: '4in', pay_item_id: null,
  computed_quantity: 25, reported_quantity: null, ...extra,
})
const FLAGS = [
  flag('b', { pir_page_id: 'page-2', display_order: 1, shape: 'arc', surveyed_thickness: '7in', reported_quantity: 1042.5 }),
  flag('a', { display_order: 2, pay_item_id: 'ci-1' }),
  flag('c', { display_order: 1, pay_item_id: 'gone' }),
]

function renderList(props = {}) {
  const onPick = vi.fn()
  render(<FlagsFallbackList flags={FLAGS} pages={PAGES} contractItems={MOCK_CONTRACT_ITEMS} onPick={onPick} {...props} />)
  return { onPick }
}

const bodyRows = () => within(screen.getByRole('region', { name: 'All flags' })).getAllByRole('row').slice(1)

describe('FlagsFallbackList', () => {
  it('lists every flag by page then display order, with the columns of the brief', () => {
    renderList()
    const headings = screen.getAllByRole('columnheader').map(cell => cell.textContent)
    expect(headings).toEqual(['Page', '#', 'Shape', 'Thickness', 'Pay item', 'Area (computed)', 'Reported'])
    expect(bodyRows().map(row => within(row).getAllByRole('cell').map(cell => cell.textContent))).toEqual([
      ['1', '1', 'Rectangle', '4"', 'Not in the catalog', '25.00 SF', '—'],
      ['1', '2', 'Rectangle', '4"', `${MOCK_CONTRACT_ITEMS[0].item_no} — ${MOCK_CONTRACT_ITEMS[0].description}`, '25.00 SF', '—'],
      ['2', '1', 'Arc', '7"', '—', '25.00 SF', '1,042.50 SF'],
    ])
  })

  it('hands a clicked row, or one Entered, to onPick with its page number', async () => {
    const { onPick } = renderList()
    await userEvent.click(bodyRows()[2])
    expect(onPick).toHaveBeenCalledWith(FLAGS[0], 2)
    bodyRows()[1].focus()
    await userEvent.keyboard('{Enter}')
    expect(onPick).toHaveBeenLastCalledWith(FLAGS[1], 1)
  })

  it('marks the selected flag and offers no edits', () => {
    renderList({ selectedId: 'a' })
    expect(bodyRows()[1]).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('says so when there are no flags', () => {
    renderList({ flags: [] })
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument()
  })
})
