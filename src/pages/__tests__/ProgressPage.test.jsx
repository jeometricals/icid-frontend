import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ProgressPage from '../ProgressPage'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({ listQuantities: vi.fn() }))

// A pay item of the roll-up; without a budget it is unbudgeted, as the backend sends one no contract item matches
const item = (pay_item_ref, budget_code, unit, actual_quantity, description, budget = null) => ({
  pay_item_ref,
  budget_code,
  unit,
  actual_quantity,
  description,
  actual_value: null,
  budgeted_quantity: null,
  budgeted_value: null,
  unit_price: null,
  percent: null,
  unbudgeted: !budget,
  ...budget,
})

// As the backend lists them: by budget code, then ref (as text), those without either last
const PAY_ITEMS = [
  item('4.13 AAS', 'BC-1', 'SF', 901, '4" concrete sidewalk', {
    unit_price: 12, budgeted_quantity: 10000, budgeted_value: 120000, actual_value: 10812, percent: 9,
  }),
  item('6.02', 'BC-1', 'LF', 171, 'Steel faced curb', {
    unit_price: 40, budgeted_quantity: 100, budgeted_value: 4000, actual_value: 6840, percent: 171,
  }),
  item('10.02', 'BC-4', 'TN', 3.2, 'Asphaltic concrete', {
    unit_price: 150, budgeted_quantity: 1000, budgeted_value: 150000, actual_value: 480, percent: 0.3,
  }),
  item('9.99', 'BC-4', 'EA', 2, 'Change order item'),
  item('7.01', 'BC-7', 'CY', 30, 'Excavation', {
    unit_price: 100, budgeted_quantity: 20, budgeted_value: 2000, actual_value: 3000, percent: 150,
  }),
  item(null, null, 'EA', 54, 'Tree guard'),
]

const CODES = [
  { budget_code: 'BC-1', actual_value: 17652, budgeted_value: 124000, percent: 14.2, has_unbudgeted: false },
  { budget_code: 'BC-2', actual_value: 0, budgeted_value: 50000, percent: 0, has_unbudgeted: false },
  { budget_code: 'BC-4', actual_value: 480, budgeted_value: 150000, percent: 0.3, has_unbudgeted: true },
  { budget_code: 'BC-7', actual_value: 3000, budgeted_value: 2000, percent: 150, has_unbudgeted: false },
]

const FOUND = {
  range: { from: '2026-09-12', to: '2026-10-12', cumulative: false },
  rows: [],
  totals_by_unit: {},
  row_count: 0,
  truncated: false,
  pay_items: PAY_ITEMS,
  totals_by_budget_code: CODES,
  project_total: { actual_value: 21132, budgeted_value: 326000, percent: 6.5 },
  unbudgeted_total: { actual_value: null, row_count: 2 },
}

// A budget, and nothing approved against it
const NO_ACTUALS = {
  ...FOUND,
  pay_items: [],
  totals_by_budget_code: CODES.map(code => ({ ...code, actual_value: 0, percent: 0, has_unbudgeted: false })),
  project_total: { actual_value: 0, budgeted_value: 326000, percent: 0 },
  unbudgeted_total: { actual_value: null, row_count: 0 },
}

// A project with no contract items: nothing has a value
const NO_CATALOG = {
  ...FOUND,
  pay_items: [item('4.13 AAS', 'BC-1', 'SF', 901, '4" concrete sidewalk'), item(null, null, 'EA', 54, 'Tree guard')],
  totals_by_budget_code: [],
  project_total: { actual_value: 0, budgeted_value: 0, percent: null },
  unbudgeted_total: { actual_value: null, row_count: 2 },
}

// Shows the page's own query string beside it, as the address bar would
function ProgressWithUrl() {
  const location = useLocation()
  return (
    <>
      <div data-testid="progress-url">{location.search}</div>
      <ProgressPage />
    </>
  )
}

function CurrentUrl() {
  const location = useLocation()
  return <div data-testid="url">{location.pathname + location.search}</div>
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/project/HWS0023/progress${search}`]}>
      <Routes>
        <Route path="/project/:projectId/progress" element={<ProgressWithUrl />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  )
}

const url = () => screen.getByTestId('progress-url').textContent
const fromInput = () => screen.getByLabelText('From')
const toInput = () => screen.getByLabelText('To')
const cumulativeBox = () => screen.getByRole('checkbox', { name: 'Show cumulative' })
const pick = (input, value) => fireEvent.change(input, { target: { value } })
const bodyRows = () => screen.getAllByRole('row').slice(1)
const tableRows = () => bodyRows().map(tr => within(tr).getAllByRole('cell').map(td => td.textContent))
const lastCall = () => api.listQuantities.mock.calls.at(-1)[0]
const projectTotal = () => screen.getByRole('region', { name: 'Project total' })
const card = code => screen.getByRole('article', { name: code })
const cardNames = () => screen.getAllByRole('article').map(el => el.getAttribute('aria-label'))

beforeEach(() => {
  vi.clearAllMocks()
  // Only the clock is faked: it is the evening of Oct 12 here, already Oct 13 in UTC
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 12, 21, 30))
  api.listQuantities.mockResolvedValue(FOUND)
})

afterEach(() => { vi.useRealTimers() })

describe('ProgressPage — first load', () => {
  it('shows the title and the range pickers while the quantities load', () => {
    api.listQuantities.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('heading', { name: 'Progress — HWS0023' })).toBeInTheDocument()
    expect(fromInput()).toHaveAttribute('type', 'date')
    expect(toInput()).toHaveAttribute('type', 'date')
    expect(cumulativeBox()).not.toBeChecked()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Project total' })).not.toBeInTheDocument()
  })

  it('asks for the last 30 days, by the local calendar, and leaves the URL bare', async () => {
    renderPage()
    await screen.findByRole('table')
    expect(fromInput()).toHaveValue('2026-09-12')
    expect(toInput()).toHaveValue('2026-10-12')
    expect(api.listQuantities).toHaveBeenCalledTimes(1)
    expect(lastCall()).toEqual({ projectId: 'HWS0023', from: '2026-09-12', to: '2026-10-12' })
    expect(url()).toBe('')
  })

  it('goes back to the project page', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Back to Project Page' }))
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/project\/HWS0023$/)
  })

  it('stacks the project total, the budget codes and the table in that order', async () => {
    renderPage()
    const table = await screen.findByRole('table')
    const codes = screen.getByRole('region', { name: 'Budget codes' })
    expect(projectTotal().compareDocumentPosition(codes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(codes.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('ProgressPage — the project total', () => {
  it('shows the percent, the dollars billed of those budgeted, and a bar', async () => {
    renderPage()
    await screen.findByRole('table')
    const total = within(projectTotal())
    expect(total.getByText('6.5%')).toBeInTheDocument()
    expect(total.getByText('$21,132 of $326,000 billed')).toBeInTheDocument()
    expect(total.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '6.5')
    expect(total.getByTestId('bar-fill')).toHaveStyle({ width: '6.5%' })
  })

  it('says which quantities the figures are of, against the whole budget', async () => {
    renderPage()
    await screen.findByRole('table')
    expect(within(projectTotal()).getByText('actuals: Sep 12 – Oct 12 · budget: full project')).toBeInTheDocument()
  })

  it('words an open bound, and gives the year of another year\'s date', async () => {
    const first = renderPage('?from=2025-12-01')
    await screen.findByRole('table')
    expect(within(projectTotal()).getByText('actuals: from Dec 1, 2025 · budget: full project')).toBeInTheDocument()
    first.unmount()

    renderPage('?to=2026-10-07')
    await screen.findByRole('table')
    expect(within(projectTotal()).getByText('actuals: through Oct 7 · budget: full project')).toBeInTheDocument()
  })

  it('notes the unbudgeted pay items, which are in none of the figures', async () => {
    renderPage()
    await screen.findByRole('table')
    expect(within(projectTotal()).getByText('2 unbudgeted pay items have quantities; they have no value here.')).toBeInTheDocument()
  })

  it('takes the warn colour when the project is over budget', async () => {
    api.listQuantities.mockResolvedValue({
      ...FOUND, project_total: { actual_value: 400000, budgeted_value: 326000, percent: 122.7 },
    })
    renderPage()
    await screen.findByRole('table')
    const total = within(projectTotal())
    expect(total.getByText('122.7%')).toHaveClass('text-warn')
    expect(total.getByTestId('bar-fill')).toHaveClass('bg-warn')
    expect(total.getByTestId('bar-overflow')).toBeInTheDocument()
  })
})

describe('ProgressPage — the budget codes', () => {
  it('shows a card per budget code, in the backend\'s order, booked against or not', async () => {
    renderPage()
    await screen.findByRole('table')
    expect(cardNames()).toEqual(['BC-1', 'BC-2', 'BC-4', 'BC-7'])
  })

  it('gives each card its percent, bar, dollars and how many items have activity', async () => {
    renderPage()
    await screen.findByRole('table')
    const first = within(card('BC-1'))
    expect(first.getByText('14.2%')).toBeInTheDocument()
    expect(first.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '14.2')
    expect(first.getByText('$17,652 of $124,000')).toBeInTheDocument()
    expect(first.getByText('2 items with activity')).toBeInTheDocument()

    expect(within(card('BC-2')).getByText('0.0%')).toBeInTheDocument()
    expect(within(card('BC-2')).getByText('No activity')).toBeInTheDocument()
    expect(within(card('BC-4')).getByText('1 item with activity · 1 unbudgeted')).toBeInTheDocument()
  })

  it('gives an over-budget card the warn colour on its percent and bar, and no other card', async () => {
    renderPage()
    await screen.findByRole('table')
    const over = within(card('BC-7'))
    expect(over.getByText('150.0%')).toHaveClass('text-warn')
    expect(over.getByTestId('bar-fill')).toHaveClass('bg-warn')
    expect(over.getByTestId('bar-fill')).toHaveStyle({ width: '100%' })
    expect(over.getByTestId('bar-overflow')).toBeInTheDocument()

    const under = within(card('BC-1'))
    expect(under.getByText('14.2%')).not.toHaveClass('text-warn')
    expect(under.getByTestId('bar-fill')).toHaveClass('bg-construction-600')
    expect(under.queryByTestId('bar-overflow')).not.toBeInTheDocument()
  })

  it('is folded to start; its name opens the items of that code, and closes them', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('table')
    const first = within(card('BC-1'))
    const toggle = first.getByRole('button', { name: 'BC-1' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(first.queryByRole('list')).not.toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(first.getAllByRole('listitem').map(li => li.textContent)).toEqual([
      '4.13 AAS 4" concrete sidewalk$10,812 of $120,000 · 9.0%',
      '6.02 Steel faced curb$6,840 of $4,000 · 171.0%',
    ])
    expect(within(card('BC-4')).queryByRole('list')).not.toBeInTheDocument()

    await user.click(toggle)
    expect(first.queryByRole('list')).not.toBeInTheDocument()
  })

  it('an opened card lists an unbudgeted item by its quantity, and says when a code has none', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('table')
    await user.click(within(card('BC-4')).getByRole('button', { name: 'BC-4' }))
    expect(within(card('BC-4')).getAllByRole('listitem').map(li => li.textContent)).toEqual([
      '10.02 Asphaltic concrete$480 of $150,000 · 0.3%',
      '9.99 Change order item2 EA · unbudgeted',
    ])

    await user.click(within(card('BC-2')).getByRole('button', { name: 'BC-2' }))
    expect(within(card('BC-2')).getByText('No items with activity.')).toBeInTheDocument()
  })
})

describe('ProgressPage — the pay-item table', () => {
  it('lists the pay items in the backend\'s order, with Budgeted, % and Progress at the end', async () => {
    renderPage()
    await screen.findByRole('table')
    expect(screen.getAllByRole('columnheader').map(th => th.textContent)).toEqual([
      'Pay Item', 'Description', 'Budget Code', 'Total Qty', 'Unit', 'Budgeted', '%', 'Progress',
    ])
    expect(tableRows()).toEqual([
      ['4.13 AAS', '4" concrete sidewalk', 'BC-1', '901', 'SF', '$120,000.00', '9.0%', ''],
      ['6.02', 'Steel faced curb', 'BC-1', '171', 'LF', '$4,000.00', '171.0%', ''],
      ['10.02', 'Asphaltic concrete', 'BC-4', '3.2', 'TN', '$150,000.00', '0.3%', ''],
      ['9.99', 'Change order item', 'BC-4', '2', 'EA', '—', '— unbudgeted', ''],
      ['7.01', 'Excavation', 'BC-7', '30', 'CY', '$2,000.00', '150.0%', ''],
      ['—', 'Tree guard', '—', '54', 'EA', '—', '— unbudgeted', ''],
    ])
  })

  it('draws a bar on every budgeted row', async () => {
    renderPage()
    await screen.findByRole('table')
    const bar = within(bodyRows()[0]).getByRole('progressbar')
    expect(bar).toHaveAccessibleName('4.13 AAS progress')
    expect(bar).toHaveAttribute('aria-valuenow', '9')
  })

  it('gives an over-budget row the warn colour on its percent and bar', async () => {
    renderPage()
    await screen.findByRole('table')
    const over = within(bodyRows()[1])
    expect(over.getByText('171.0%')).toHaveClass('text-warn')
    expect(over.getByTestId('bar-fill')).toHaveClass('bg-warn')
    expect(over.getByTestId('bar-overflow')).toBeInTheDocument()

    const under = within(bodyRows()[0])
    expect(under.getByText('9.0%')).not.toHaveClass('text-warn')
    expect(under.getByTestId('bar-fill')).toHaveClass('bg-construction-600')
  })

  it('keeps an unbudgeted row, marked in the % column, with no budget and no bar', async () => {
    renderPage()
    await screen.findByRole('table')
    const unbudgeted = within(bodyRows()[3])
    expect(unbudgeted.getByText('— unbudgeted')).toHaveClass('text-gray-400')
    expect(unbudgeted.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('shows a dash and an empty bar for a contract item bid at nothing', async () => {
    api.listQuantities.mockResolvedValue({
      ...FOUND,
      pay_items: [item('1.01', 'BC-1', 'LS', 1, 'Mobilization', {
        unit_price: 0, budgeted_quantity: 1, budgeted_value: 0, actual_value: 0, percent: null,
      })],
    })
    renderPage()
    await screen.findByRole('table')
    expect(tableRows()).toEqual([['1.01', 'Mobilization', 'BC-1', '1', 'LS', '$0.00', '—', '']])
    expect(within(bodyRows()[0]).getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    expect(within(bodyRows()[0]).queryByTestId('bar-fill')).not.toBeInTheDocument()
  })
})

describe('ProgressPage — the date range', () => {
  it('a picked date goes in the URL with the other bound, and the quantities are fetched again', async () => {
    renderPage()
    await screen.findByRole('table')
    pick(fromInput(), '2026-10-01')
    await waitFor(() => expect(url()).toBe('?from=2026-10-01&to=2026-10-12'))
    await waitFor(() => expect(api.listQuantities).toHaveBeenCalledTimes(2))
    expect(lastCall()).toEqual({ projectId: 'HWS0023', from: '2026-10-01', to: '2026-10-12' })

    pick(toInput(), '2026-10-07')
    await waitFor(() => expect(url()).toBe('?from=2026-10-01&to=2026-10-07'))
    await waitFor(() => expect(lastCall()).toEqual({ projectId: 'HWS0023', from: '2026-10-01', to: '2026-10-07' }))
  })

  it('a linked URL sets the pickers and the first request', async () => {
    renderPage('?from=2026-08-01&to=2026-08-31')
    await screen.findByRole('table')
    expect(fromInput()).toHaveValue('2026-08-01')
    expect(toInput()).toHaveValue('2026-08-31')
    expect(api.listQuantities).toHaveBeenCalledTimes(1)
    expect(lastCall()).toEqual({ projectId: 'HWS0023', from: '2026-08-01', to: '2026-08-31' })
  })

  it('a cleared picker is an open bound', async () => {
    renderPage()
    await screen.findByRole('table')
    pick(fromInput(), '')
    await waitFor(() => expect(url()).toBe('?to=2026-10-12'))
    await waitFor(() => expect(lastCall()).toEqual({ projectId: 'HWS0023', from: '', to: '2026-10-12' }))
    expect(fromInput()).toHaveValue('')
  })

  it('clearing both pickers is the last 30 days again', async () => {
    renderPage('?from=2026-08-01')
    await screen.findByRole('table')
    expect(toInput()).toHaveValue('')
    pick(fromInput(), '')
    await waitFor(() => expect(url()).toBe(''))
    expect(fromInput()).toHaveValue('2026-09-12')
    expect(toInput()).toHaveValue('2026-10-12')
    await waitFor(() => expect(lastCall()).toEqual({ projectId: 'HWS0023', from: '2026-09-12', to: '2026-10-12' }))
  })

  it('From after To shows a hint and asks the backend nothing until it is put right', async () => {
    renderPage()
    await screen.findByRole('table')
    pick(fromInput(), '2026-10-20')
    expect(await screen.findByRole('alert')).toHaveTextContent("From can't be after To.")
    expect(url()).toBe('?from=2026-10-20&to=2026-10-12')
    expect(api.listQuantities).toHaveBeenCalledTimes(1) // the first load only
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Project total' })).not.toBeInTheDocument()

    pick(toInput(), '2026-10-25')
    await screen.findByRole('table')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(lastCall()).toEqual({ projectId: 'HWS0023', from: '2026-10-20', to: '2026-10-25' })
  })

  it('a linked URL that is backwards asks nothing either', async () => {
    renderPage('?from=2026-10-10&to=2026-10-01')
    expect(await screen.findByRole('alert')).toHaveTextContent("From can't be after To.")
    expect(api.listQuantities).not.toHaveBeenCalled()
  })
})

describe('ProgressPage — Show cumulative', () => {
  it('asks for cumulative quantities with no dates, and disables the pickers', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('table')
    await user.click(cumulativeBox())

    await waitFor(() => expect(api.listQuantities).toHaveBeenCalledTimes(2))
    expect(lastCall()).toEqual({ projectId: 'HWS0023', cumulative: true })
    expect(lastCall()).not.toHaveProperty('from')
    expect(lastCall()).not.toHaveProperty('to')
    expect(url()).toBe('?cumulative=true')
    await screen.findByRole('table')
    expect(cumulativeBox()).toBeChecked()
    expect(fromInput()).toBeDisabled()
    expect(toInput()).toBeDisabled()
    expect(screen.getByText('The date range is off: actuals are for the full project.')).toBeInTheDocument()
  })

  it('labels the project total as the full project', async () => {
    renderPage('?cumulative=true')
    await screen.findByRole('table')
    expect(within(projectTotal()).getByText('actuals: full project · budget: full project')).toBeInTheDocument()
  })

  it('a linked URL ticks the box and makes the first request cumulative', async () => {
    renderPage('?cumulative=true')
    await screen.findByRole('table')
    expect(cumulativeBox()).toBeChecked()
    expect(fromInput()).toBeDisabled()
    expect(api.listQuantities).toHaveBeenCalledTimes(1)
    expect(lastCall()).toEqual({ projectId: 'HWS0023', cumulative: true })
  })

  it('keeps the range in the URL, and goes back to it when unticked', async () => {
    const user = userEvent.setup()
    renderPage('?from=2026-08-01&to=2026-08-31')
    await screen.findByRole('table')
    await user.click(cumulativeBox())
    await waitFor(() => expect(url()).toBe('?from=2026-08-01&to=2026-08-31&cumulative=true'))
    await waitFor(() => expect(lastCall()).toEqual({ projectId: 'HWS0023', cumulative: true }))
    expect(fromInput()).toHaveValue('2026-08-01')

    await screen.findByRole('table')
    await user.click(cumulativeBox())
    await waitFor(() => expect(url()).toBe('?from=2026-08-01&to=2026-08-31'))
    await waitFor(() => expect(lastCall()).toEqual({ projectId: 'HWS0023', from: '2026-08-01', to: '2026-08-31' }))
    expect(fromInput()).toBeEnabled()
    expect(toInput()).toBeEnabled()
  })

  it('loads even over a backwards range, which it doesn\'t send', async () => {
    renderPage('?from=2026-10-10&to=2026-10-01&cumulative=true')
    await screen.findByRole('table')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(lastCall()).toEqual({ projectId: 'HWS0023', cumulative: true })
  })

  it('says there is nothing yet, not nothing in a range, when no quantity is approved', async () => {
    api.listQuantities.mockResolvedValue(NO_ACTUALS)
    renderPage('?cumulative=true')
    expect(await screen.findByText('No approved quantities yet')).toBeInTheDocument()
  })
})

describe('ProgressPage — nothing to show, and failures', () => {
  it('a project with no contract items has no budget: no percent, no bar, no cards, every row unbudgeted', async () => {
    api.listQuantities.mockResolvedValue(NO_CATALOG)
    renderPage()
    await screen.findByRole('table')
    const total = within(projectTotal())
    expect(total.getByText('No budget set for this project')).toBeInTheDocument()
    expect(total.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(total.queryByText(/billed/)).not.toBeInTheDocument()
    expect(total.getByText('2 unbudgeted pay items have quantities; they have no value here.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Budget codes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(tableRows()).toEqual([
      ['4.13 AAS', '4" concrete sidewalk', 'BC-1', '901', 'SF', '—', '— unbudgeted', ''],
      ['—', 'Tree guard', '—', '54', 'EA', '—', '— unbudgeted', ''],
    ])
  })

  it('counts a single unbudgeted pay item in the singular', async () => {
    api.listQuantities.mockResolvedValue({ ...NO_CATALOG, unbudgeted_total: { actual_value: null, row_count: 1 } })
    renderPage()
    await screen.findByRole('table')
    expect(within(projectTotal()).getByText('1 unbudgeted pay item has quantities; it has no value here.')).toBeInTheDocument()
  })

  it('a project with no actuals reads 0% on the total and on every card, and says the table is empty', async () => {
    api.listQuantities.mockResolvedValue(NO_ACTUALS)
    renderPage()
    expect(await screen.findByText('No approved quantities in this range')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    const total = within(projectTotal())
    expect(total.getByText('0.0%')).toBeInTheDocument()
    expect(total.getByText('$0 of $326,000 billed')).toBeInTheDocument()
    expect(total.getByTestId('bar-fill')).toHaveStyle({ width: '0%' })
    expect(total.queryByText(/unbudgeted/)).not.toBeInTheDocument()

    expect(cardNames()).toEqual(['BC-1', 'BC-2', 'BC-4', 'BC-7'])
    for (const code of cardNames()) {
      expect(within(card(code)).getByText('0.0%')).toBeInTheDocument()
      expect(within(card(code)).getByText('No activity')).toBeInTheDocument()
      expect(within(card(code)).getByTestId('bar-fill')).toHaveStyle({ width: '0%' })
    }
  })

  it('shows why the quantities couldn\'t be loaded, and Retry loads them', async () => {
    api.listQuantities.mockRejectedValueOnce(new Error('Project access required')).mockResolvedValueOnce(FOUND)
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText("Couldn't load quantities: Project access required")).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Project total' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(api.listQuantities).toHaveBeenCalledTimes(2)
  })
})
