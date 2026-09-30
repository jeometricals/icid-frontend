import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ACMaterialUsage from '../ACMaterialUsage'

const LABELS = ['No. of Tickets', 'First Ticket No.', 'Last Ticket No.', 'Qty Received', 'Qty Used', 'Qty Wasted/Rejected']

function renderUsage(props = {}) {
  const onChange = vi.fn()
  render(<ACMaterialUsage heading="Material Usage — Top" value={{}} onChange={onChange} {...props} />)
  return onChange
}

describe('ACMaterialUsage', () => {
  it('renders the given heading and the six labelled fields, empty', () => {
    renderUsage()
    expect(screen.getByRole('heading', { name: 'Material Usage — Top' })).toBeInTheDocument()
    for (const label of LABELS) expect(screen.getByLabelText(label)).toHaveDisplayValue('')
  })

  it('uses text for ticket numbers and 0.01-step numbers for the count and quantities', () => {
    renderUsage()
    for (const label of ['First Ticket No.', 'Last Ticket No.']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('type', 'text')
    }
    for (const label of ['No. of Tickets', 'Qty Received', 'Qty Used', 'Qty Wasted/Rejected']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('type', 'number')
      expect(screen.getByLabelText(label)).toHaveAttribute('step', '0.01')
    }
  })

  it('shows the saved values and calls onChange(field, value)', async () => {
    const onChange = renderUsage({ value: { firstTicketNo: 'A-1001', qtyUsed: '84.5' } })
    expect(screen.getByLabelText('First Ticket No.')).toHaveValue('A-1001')
    expect(screen.getByLabelText('Qty Used')).toHaveValue(84.5)
    await userEvent.setup().type(screen.getByLabelText('Qty Wasted/Rejected'), '2')
    expect(onChange).toHaveBeenLastCalledWith('qtyWasted', '2')
  })

  it('keeps two cards on one page independent (distinct label ids)', async () => {
    const onTop = vi.fn()
    const onBinder = vi.fn()
    render(
      <>
        <ACMaterialUsage heading="Material Usage — Top" value={{ qtyUsed: '10' }} onChange={onTop} />
        <ACMaterialUsage heading="Material Usage — Binder" value={{ qtyUsed: '20' }} onChange={onBinder} />
      </>
    )
    const binder = within(screen.getByRole('region', { name: 'Material Usage — Binder' }))
    expect(binder.getByLabelText('Qty Used')).toHaveValue(20)
    await userEvent.setup().type(binder.getByLabelText('Last Ticket No.'), '9')
    expect(onBinder).toHaveBeenLastCalledWith('lastTicketNo', '9')
    expect(onTop).not.toHaveBeenCalled()
  })

  it('disables every field when disabled', () => {
    renderUsage({ disabled: true })
    for (const label of LABELS) expect(screen.getByLabelText(label)).toBeDisabled()
  })
})
