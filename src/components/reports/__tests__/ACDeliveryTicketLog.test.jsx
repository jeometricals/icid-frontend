import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ACDeliveryTicketLog from '../ACDeliveryTicketLog'

const ticket = (overrides = {}) => ({ location: '', ticketNo: '', temperature: '', ...overrides })

function renderLog(props = {}) {
  const handlers = { onAddTicket: vi.fn(), onTicketChange: vi.fn(), onRemoveTicket: vi.fn() }
  render(<ACDeliveryTicketLog tickets={[]} {...handlers} {...props} />)
  return handlers
}

describe('ACDeliveryTicketLog', () => {
  it('renders the three column headers plus a remove column, and the empty state', () => {
    renderLog()
    expect(screen.getByRole('heading', { name: 'Delivery Ticket Log' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual([
      'Location', 'Ticket No.', 'Temperature', 'Remove',
    ])
    const empty = screen.getByText('No tickets added yet. Click Add Ticket to record one.')
    expect(empty).toHaveAttribute('colspan', '4')
  })

  it('calls onAddTicket from the Add Ticket button', async () => {
    const { onAddTicket } = renderLog()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add Ticket' }))
    expect(onAddTicket).toHaveBeenCalledTimes(1)
  })

  it('shows each ticket with text location and number, and a 0.01-step °F temperature', () => {
    renderLog({ tickets: [ticket({ location: 'Sta 12+40, N lane', ticketNo: 'T-88', temperature: '285' })] })
    expect(screen.getByLabelText('Ticket 1 Location')).toHaveValue('Sta 12+40, N lane')
    expect(screen.getByLabelText('Ticket 1 Ticket No.')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Ticket 1 Ticket No.')).toHaveValue('T-88')
    expect(screen.getByLabelText('Ticket 1 Temperature')).toHaveValue(285)
    expect(screen.getByLabelText('Ticket 1 Temperature')).toHaveAttribute('step', '0.01')
    expect(screen.getByText('°F')).toBeInTheDocument()
  })

  it('calls onTicketChange(index, field, value)', async () => {
    const { onTicketChange } = renderLog({ tickets: [ticket(), ticket()] })
    await userEvent.setup().type(screen.getByLabelText('Ticket 2 Ticket No.'), 'B')
    expect(onTicketChange).toHaveBeenLastCalledWith(1, 'ticketNo', 'B')
  })

  it('calls onRemoveTicket(index) from the row × button', async () => {
    const { onRemoveTicket } = renderLog({ tickets: [ticket(), ticket()] })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove ticket 1' }))
    expect(onRemoveTicket).toHaveBeenCalledWith(0)
  })

  it('disables Add Ticket, every input and × when disabled', () => {
    renderLog({ tickets: [ticket()], disabled: true })
    expect(screen.getByRole('button', { name: 'Add Ticket' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove ticket 1' })).toBeDisabled()
    for (const input of [...screen.getAllByRole('textbox'), ...screen.getAllByRole('spinbutton')]) {
      expect(input).toBeDisabled()
    }
  })
})
