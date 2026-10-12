import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import ArchiveFilters, { IDR_NUMBER_DEBOUNCE_MS, NO_FILTERS } from '../ArchiveFilters'
import { DISCIPLINES } from '../../data/disciplines'

// Holds the filters as the archive page does (there, in the URL), and reports every change
function Harness({ initial, onChange }) {
  const [filters, setFilters] = useState({ ...NO_FILTERS, ...initial })
  return (
    <ArchiveFilters
      filters={filters}
      onChange={(patch, options) => {
        onChange(patch, options)
        setFilters(current => ({ ...current, ...patch }))
      }}
    />
  )
}

function renderFilters(initial = {}) {
  const onChange = vi.fn()
  render(<Harness initial={initial} onChange={onChange} />)
  return onChange
}

const idrNumber = () => screen.getByLabelText('IDR #')
const workDate = () => screen.getByLabelText('Work date')
const from = () => screen.getByLabelText('From')
const to = () => screen.getByLabelText('To')
const discipline = name => screen.getByRole('checkbox', { name })
const clearButton = () => screen.getByRole('button', { name: 'Clear filters' })
const type = (input, value) => fireEvent.change(input, { target: { value } })
const wait = ms => act(() => { vi.advanceTimersByTime(ms) })

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('ArchiveFilters', () => {
  it('has an IDR # box, a work date, a from / to range and a checkbox per discipline', () => {
    renderFilters()
    expect(idrNumber()).toHaveValue('')
    for (const input of [workDate(), from(), to()]) expect(input).toHaveAttribute('type', 'date')
    const group = screen.getByRole('group', { name: 'Discipline' })
    expect(within(group).getAllByRole('checkbox').map(box => box.parentElement.textContent)).toEqual(DISCIPLINES)
  })

  it('offers the six disciplines exactly as the backend spells them', () => {
    expect(DISCIPLINES).toEqual([
      'AC Pavement', 'Concrete (delivery)', 'Concrete (testing)', 'Curb', 'General', 'Sidewalk',
    ])
  })

  it('shows the filters it is given', () => {
    renderFilters({ idrNumber: 'SW', from: '2026-10-01', to: '2026-10-07', disciplines: ['Curb'] })
    expect(idrNumber()).toHaveValue('SW')
    expect(from()).toHaveValue('2026-10-01')
    expect(to()).toHaveValue('2026-10-07')
    expect(discipline('Curb')).toBeChecked()
    expect(discipline('Sidewalk')).not.toBeChecked()
  })
})

describe('ArchiveFilters — IDR #', () => {
  it('filters once typing has stopped for the debounce, replacing the history entry', () => {
    const onChange = renderFilters()
    type(idrNumber(), 'S')
    wait(IDR_NUMBER_DEBOUNCE_MS - 1)
    type(idrNumber(), 'SW')
    wait(IDR_NUMBER_DEBOUNCE_MS - 1)
    expect(onChange).not.toHaveBeenCalled()
    wait(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ idrNumber: 'SW' }, { replace: true })
    expect(idrNumber()).toHaveValue('SW')
  })

  it('sends the text trimmed, and nothing new for spaces alone', () => {
    const onChange = renderFilters()
    type(idrNumber(), ' SW ')
    wait(IDR_NUMBER_DEBOUNCE_MS)
    expect(onChange).toHaveBeenCalledWith({ idrNumber: 'SW' }, { replace: true })
    expect(idrNumber()).toHaveValue(' SW ') // what was typed stays as typed
    type(idrNumber(), ' SW  ')
    wait(IDR_NUMBER_DEBOUNCE_MS)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('emptying the box removes the filter', () => {
    const onChange = renderFilters({ idrNumber: 'SW' })
    type(idrNumber(), '')
    wait(IDR_NUMBER_DEBOUNCE_MS)
    expect(onChange).toHaveBeenCalledWith({ idrNumber: '' }, { replace: true })
  })

  it('keeps another filter changed while it was waiting', () => {
    const onChange = renderFilters()
    type(idrNumber(), 'SW')
    fireEvent.click(discipline('Sidewalk'))
    wait(IDR_NUMBER_DEBOUNCE_MS)
    expect(onChange.mock.calls.map(([patch]) => patch)).toEqual([{ disciplines: ['Sidewalk'] }, { idrNumber: 'SW' }])
    expect(discipline('Sidewalk')).toBeChecked()
  })
})

describe('ArchiveFilters — dates', () => {
  it('a work date clears the range', () => {
    const onChange = renderFilters({ from: '2026-10-01', to: '2026-10-07' })
    type(workDate(), '2026-10-04')
    expect(onChange).toHaveBeenCalledWith({ workDate: '2026-10-04', from: '', to: '' }, { replace: false })
    expect(workDate()).toHaveValue('2026-10-04')
    expect(from()).toHaveValue('')
    expect(to()).toHaveValue('')
  })

  it.each([['From', 'from'], ['To', 'to']])('%s clears the work date and leaves the other bound', (label, key) => {
    const other = key === 'from' ? 'to' : 'from'
    const onChange = renderFilters({ workDate: '2026-10-04' })
    type(screen.getByLabelText(label), '2026-10-02')
    expect(onChange).toHaveBeenCalledWith({ [key]: '2026-10-02', workDate: '' }, { replace: false })
    expect(workDate()).toHaveValue('')
    expect(onChange.mock.calls[0][0]).not.toHaveProperty(other)
  })

  it('either bound can be set alone, and each limits the other picker', () => {
    renderFilters()
    type(from(), '2026-10-01')
    expect(to()).toHaveAttribute('min', '2026-10-01')
    expect(to()).toHaveValue('')
    type(to(), '2026-10-07')
    expect(from()).toHaveAttribute('max', '2026-10-07')
  })
})

describe('ArchiveFilters — disciplines', () => {
  it('ticking adds a discipline and unticking removes it, kept in the list\'s order', () => {
    const onChange = renderFilters()
    fireEvent.click(discipline('Sidewalk'))
    fireEvent.click(discipline('AC Pavement'))
    expect(onChange).toHaveBeenLastCalledWith({ disciplines: ['AC Pavement', 'Sidewalk'] }, { replace: false })
    fireEvent.click(discipline('Sidewalk'))
    expect(onChange).toHaveBeenLastCalledWith({ disciplines: ['AC Pavement'] }, { replace: false })
  })
})

describe('ArchiveFilters — Clear filters', () => {
  it('is disabled while nothing is set', () => {
    renderFilters()
    expect(clearButton()).toBeDisabled()
  })

  it('empties every filter and input', () => {
    const onChange = renderFilters({ idrNumber: 'SW', workDate: '2026-10-04', disciplines: ['Curb', 'Sidewalk'] })
    fireEvent.click(clearButton())
    expect(onChange).toHaveBeenCalledWith(NO_FILTERS, { replace: false })
    expect(idrNumber()).toHaveValue('')
    expect(workDate()).toHaveValue('')
    expect(discipline('Curb')).not.toBeChecked()
    expect(clearButton()).toBeDisabled()
  })

  it('drops text still waiting on the debounce', () => {
    const onChange = renderFilters()
    type(idrNumber(), 'SW')
    expect(clearButton()).toBeEnabled()
    fireEvent.click(clearButton())
    wait(IDR_NUMBER_DEBOUNCE_MS * 2)
    expect(idrNumber()).toHaveValue('')
    expect(onChange.mock.calls.map(([patch]) => patch)).toEqual([NO_FILTERS])
  })
})
