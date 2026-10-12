import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ProgressPage from '../ProgressPage'
import * as api from '../../services/api'

vi.mock('../../services/api', () => ({ listQuantities: vi.fn() }))

const row = (pay_item_ref, budget_code, unit, amount, description) => (
  { pay_item_ref, budget_code, unit, amount, description }
)

// As the backend lists them: newest work date first, so one item's rows are not together
const ROWS = [
  row('4.13 AAS', 'BC-1', 'SF', 500.5, '4" concrete sidewalk'),
  row('10.02', 'BC-4', 'TN', 3.2, 'Asphaltic concrete'),
  row('6.02', 'BC-2', 'LF', 171, 'Steel faced curb'),
  row('4.13 AAS', 'BC-1', 'SF', 400.5, '4" concrete sidewalk'),
  row(null, null, 'EA', 54, 'Tree guard'),
]

const FOUND = { rows: ROWS, totals_by_unit: { SF: 901, TN: 3.2, LF: 171, EA: 54 }, row_count: 5, truncated: false }
const NOTHING = { rows: [], totals_by_unit: {}, row_count: 0, truncated: false }

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
const pick = (input, value) => fireEvent.change(input, { target: { value } })
const tiles = () => within(screen.getByRole('region', { name: 'Totals by unit' })).getAllByRole('group')
  .map(tile => [...tile.children].map(part => part.textContent))
const tableRows = () => screen.getAllByRole('row').slice(1).map(tr => within(tr).getAllByRole('cell').map(td => td.textContent))
const lastCall = () => api.listQuantities.mock.calls.at(-1)[0]

beforeEach(() => {
  vi.clearAllMocks()
  // Only the clock is faked: it is the evening of Oct 12 here, already Oct 13 in UTC
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 12, 21, 30))
  api.listQuantities.mockResolvedValue(FOUND)
})

afterEach(() => { vi.useRealTimers() })

describe('ProgressPage — first load', () => {
  it('shows the title, the range pickers and empty tiles while the quantities load', () => {
    api.listQuantities.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('heading', { name: 'Progress — HWS0023' })).toBeInTheDocument()
    expect(fromInput()).toHaveAttribute('type', 'date')
    expect(toInput()).toHaveAttribute('type', 'date')
    expect(tiles()).toEqual([['TN', '—'], ['LF', '—'], ['SF', '—'], ['EA', '—']])
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
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
})

describe('ProgressPage — totals and rollup', () => {
  it('shows the response\'s total per unit: TN, LF, SF, EA', async () => {
    renderPage()
    await screen.findByRole('table')
    expect(tiles()).toEqual([['TN', '3.2'], ['LF', '171'], ['SF', '901'], ['EA', '54']])
  })

  it('puts any other unit after those four, and a dash where a unit has no rows', async () => {
    api.listQuantities.mockResolvedValue({
      ...FOUND, totals_by_unit: { SY: 1250.25, SF: 901, '(unknown)': 2, CY: 7.5 },
    })
    renderPage()
    await screen.findByRole('table')
    expect(tiles()).toEqual([
      ['TN', '—'], ['LF', '—'], ['SF', '901'], ['EA', '—'], ['CY', '7.5'], ['SY', '1,250.25'], ['(unknown)', '2'],
    ])
  })

  it('lists one row per pay item, budget code and unit, with its quantities summed', async () => {
    renderPage()
    await screen.findByRole('table')
    expect(screen.getAllByRole('columnheader').map(th => th.textContent)).toEqual([
      'Pay Item', 'Description', 'Budget Code', 'Total Qty', 'Unit',
    ])
    expect(tableRows()).toEqual([
      ['4.13 AAS', '4" concrete sidewalk', 'BC-1', '901', 'SF'],
      ['6.02', 'Steel faced curb', 'BC-2', '171', 'LF'],
      ['10.02', 'Asphaltic concrete', 'BC-4', '3.2', 'TN'],
      ['—', 'Tree guard', '—', '54', 'EA'], // added by description alone: no number, last
    ])
  })

  it('keeps items without a number apart by description', async () => {
    api.listQuantities.mockResolvedValue({
      ...FOUND,
      rows: [row(null, null, 'EA', 2, 'Tree guard'), row(null, null, 'EA', 5, 'Bollard'), row(null, null, 'EA', 1, 'Tree guard')],
    })
    renderPage()
    await screen.findByRole('table')
    expect(tableRows()).toEqual([['—', 'Bollard', '—', '5', 'EA'], ['—', 'Tree guard', '—', '3', 'EA']])
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
    expect(screen.queryByRole('region', { name: 'Totals by unit' })).not.toBeInTheDocument()

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

describe('ProgressPage — nothing, failures and truncation', () => {
  it('says so when the range has no approved quantities, with empty tiles', async () => {
    api.listQuantities.mockResolvedValue(NOTHING)
    renderPage()
    expect(await screen.findByText('No approved quantities in this range')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(tiles()).toEqual([['TN', '—'], ['LF', '—'], ['SF', '—'], ['EA', '—']])
  })

  it('shows why the quantities couldn\'t be loaded, and Retry loads them', async () => {
    api.listQuantities.mockRejectedValueOnce(new Error('Project access required')).mockResolvedValueOnce(FOUND)
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText("Couldn't load quantities: Project access required")).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(api.listQuantities).toHaveBeenCalledTimes(2)
  })

  it('warns above the table when the response was cut at 10,000 rows', async () => {
    api.listQuantities.mockResolvedValue({ ...FOUND, truncated: true })
    renderPage()
    const table = await screen.findByRole('table')
    const banner = screen.getByRole('alert')
    expect(banner).toHaveTextContent('Showing the first 10,000 rows — narrow the date range for a full view.')
    expect(banner.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('has no such warning otherwise', async () => {
    renderPage()
    await screen.findByRole('table')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
