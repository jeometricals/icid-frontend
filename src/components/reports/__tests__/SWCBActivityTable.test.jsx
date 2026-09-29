import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SWCBActivityTable from '../SWCBActivityTable'

const emptyRow = () => ({ fromStation: '', toStation: '', remarks: '' })
const EMPTY_ACTIVITY = { excavation: emptyRow(), formPrep: emptyRow(), pour: emptyRow() }

function renderTable(props = {}) {
  const onChange = vi.fn()
  render(<SWCBActivityTable activity={EMPTY_ACTIVITY} onChange={onChange} {...props} />)
  return onChange
}

const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('SWCBActivityTable', () => {
  it('renders the Detailed Activity card with its four column headers', () => {
    renderTable()
    expect(screen.getByRole('heading', { name: 'Detailed Activity' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map(h => h.textContent))
      .toEqual(['Detailed Activity', 'From Station', 'To Station', 'Remarks'])
  })

  it('renders Excavation, Form / Prep and Pour rows, each with three text inputs', () => {
    renderTable()
    const rows = bodyRows()
    expect(rows.map(r => r.cells[0].textContent)).toEqual(['Excavation', 'Form / Prep', 'Pour'])
    for (const row of rows) expect(within(row).getAllByRole('textbox')).toHaveLength(3)
  })

  it('shows empty inputs for an empty activity', () => {
    renderTable()
    for (const input of screen.getAllByRole('textbox')) expect(input).toHaveValue('')
  })

  it('shows saved values in the right row and column', () => {
    renderTable({
      activity: { ...EMPTY_ACTIVITY, pour: { fromStation: '10+00', toStation: '10+40', remarks: 'Curb pour' } },
    })
    expect(screen.getByLabelText('Pour From Station')).toHaveValue('10+00')
    expect(screen.getByLabelText('Pour To Station')).toHaveValue('10+40')
    expect(screen.getByLabelText('Pour Remarks')).toHaveValue('Curb pour')
    expect(screen.getByLabelText('Excavation From Station')).toHaveValue('')
  })

  it('calls onChange(row, field, value) when a field is typed in', async () => {
    const onChange = renderTable()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Form / Prep To Station'), '5')
    expect(onChange).toHaveBeenCalledWith('formPrep', 'toStation', '5')
    await user.type(screen.getByLabelText('Excavation Remarks'), 'x')
    expect(onChange).toHaveBeenLastCalledWith('excavation', 'remarks', 'x')
  })

  it('disables every input when disabled', () => {
    renderTable({ disabled: true })
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(9)
    for (const input of inputs) expect(input).toBeDisabled()
  })
})
