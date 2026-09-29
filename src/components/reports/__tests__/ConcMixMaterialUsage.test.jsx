import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcMixMaterialUsage from '../ConcMixMaterialUsage'

const LABELS = [
  'Batch Report No', 'No. of Tickets', 'First Ticket No', 'Last Ticket No', 'Quantity Dispatched from Plant',
  'Quantity Received', 'Quantity Used', 'Quantity Wasted / Rejected',
]

function renderUsage(props = {}) {
  const onChange = vi.fn()
  render(<ConcMixMaterialUsage value={{}} onChange={onChange} {...props} />)
  return onChange
}

describe('ConcMixMaterialUsage', () => {
  it('renders the eight labelled fields, empty', () => {
    renderUsage()
    expect(screen.getByRole('heading', { name: 'Material Usage' })).toBeInTheDocument()
    for (const label of LABELS) expect(screen.getByLabelText(label)).toHaveDisplayValue('')
  })

  it('uses text for report and ticket numbers and numbers for counts and quantities', () => {
    renderUsage()
    for (const label of ['Batch Report No', 'First Ticket No', 'Last Ticket No']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('type', 'text')
    }
    for (const label of ['No. of Tickets', 'Quantity Dispatched from Plant', 'Quantity Received', 'Quantity Used',
      'Quantity Wasted / Rejected']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('type', 'number')
    }
  })

  it('shows the saved values and calls onChange(field, value)', async () => {
    const onChange = renderUsage({ value: { batchReportNo: 'BR-9', quantityUsed: '19.5' } })
    expect(screen.getByLabelText('Batch Report No')).toHaveValue('BR-9')
    expect(screen.getByLabelText('Quantity Used')).toHaveValue(19.5)
    await userEvent.setup().type(screen.getByLabelText('Last Ticket No'), '4')
    expect(onChange).toHaveBeenLastCalledWith('lastTicketNo', '4')
  })

  it('disables every field when disabled', () => {
    renderUsage({ disabled: true })
    for (const label of LABELS) expect(screen.getByLabelText(label)).toBeDisabled()
  })
})
