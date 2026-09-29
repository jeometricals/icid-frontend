import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcCylDeliveryCasting from '../ConcCylDeliveryCasting'

const EMPTY = { dateOfDelivery: '', cyPoured: '', dateCast: '', jobLocation: '' }

function renderDelivery(props = {}) {
  const onChange = vi.fn()
  render(<ConcCylDeliveryCasting value={EMPTY} onChange={onChange} {...props} />)
  return onChange
}

describe('ConcCylDeliveryCasting', () => {
  it('renders two dates, a C.Y. number and a job location', () => {
    renderDelivery()
    expect(screen.getByRole('heading', { name: 'Delivery & Casting' })).toBeInTheDocument()
    expect(screen.getByLabelText('Date of Delivery')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Date Cast')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('C.Y. Poured')).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText('C.Y. Poured')).toHaveAttribute('step', '0.01')
    expect(screen.getByLabelText('Job Location')).toHaveAttribute('type', 'text')
  })

  it('shows the saved values', () => {
    renderDelivery({ value: { dateOfDelivery: '2026-09-26', cyPoured: '12.5', dateCast: '2026-09-27', jobLocation: 'Main St' } })
    expect(screen.getByLabelText('Date of Delivery')).toHaveValue('2026-09-26')
    expect(screen.getByLabelText('C.Y. Poured')).toHaveValue(12.5)
    expect(screen.getByLabelText('Date Cast')).toHaveValue('2026-09-27')
    expect(screen.getByLabelText('Job Location')).toHaveValue('Main St')
  })

  it('calls onChange(field, value)', async () => {
    const onChange = renderDelivery()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('C.Y. Poured'), '9')
    expect(onChange).toHaveBeenLastCalledWith('cyPoured', '9')
    await user.type(screen.getByLabelText('Date Cast'), '2026-09-27')
    expect(onChange).toHaveBeenLastCalledWith('dateCast', '2026-09-27')
  })

  it('disables every field when disabled', () => {
    renderDelivery({ disabled: true })
    for (const label of ['Date of Delivery', 'C.Y. Poured', 'Date Cast', 'Job Location']) {
      expect(screen.getByLabelText(label)).toBeDisabled()
    }
  })
})
