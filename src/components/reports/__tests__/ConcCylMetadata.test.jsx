import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcCylMetadata from '../ConcCylMetadata'

const EMPTY = { dateOfDelivery: '', cyPoured: '', dateCast: '', jobLocation: '' }

function renderMetadata(props = {}) {
  const handlers = { onDeliveryCastingChange: vi.fn(), onFieldChange: vi.fn() }
  render(
    <ConcCylMetadata workDate="2026-09-27" deliveryCasting={EMPTY} sheetNo="" sheetOf="" placementLocation=""
      {...handlers} {...props} />
  )
  return handlers
}

describe('ConcCylMetadata', () => {
  it('renders two dates, a C.Y. number, a job location, Sheet No. / of and the placement location', () => {
    renderMetadata()
    expect(screen.getByRole('heading', { name: 'Delivery & Casting' })).toBeInTheDocument()
    expect(screen.getByLabelText('Date of Delivery')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Date Cast')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('C.Y. Poured')).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText('C.Y. Poured')).toHaveAttribute('step', '0.01')
    expect(screen.getByLabelText('Job Location')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Sheet No.')).toHaveValue('')
    expect(screen.getByLabelText('Sheet No. of')).toHaveValue('')
    expect(screen.getByLabelText('Specific Location of Placement')).toHaveValue('')
  })

  it("shows the work date's day of week", () => {
    renderMetadata() // 2026-09-27 is a Sunday
    expect(screen.getByText('Day of Week:').parentElement).toHaveTextContent('Day of Week: Sunday')
  })

  it('leaves the day of week out without a work date', () => {
    renderMetadata({ workDate: undefined })
    expect(screen.queryByText('Day of Week:')).not.toBeInTheDocument()
  })

  it('shows the saved values', () => {
    renderMetadata({
      deliveryCasting: { dateOfDelivery: '2026-09-26', cyPoured: '12.5', dateCast: '2026-09-27', jobLocation: 'Main St' },
      sheetNo: '1',
      sheetOf: '2',
      placementLocation: 'Pier 3',
    })
    expect(screen.getByLabelText('Date of Delivery')).toHaveValue('2026-09-26')
    expect(screen.getByLabelText('C.Y. Poured')).toHaveValue(12.5)
    expect(screen.getByLabelText('Date Cast')).toHaveValue('2026-09-27')
    expect(screen.getByLabelText('Job Location')).toHaveValue('Main St')
    expect(screen.getByLabelText('Sheet No.')).toHaveValue('1')
    expect(screen.getByLabelText('Sheet No. of')).toHaveValue('2')
    expect(screen.getByLabelText('Specific Location of Placement')).toHaveValue('Pier 3')
  })

  it('calls onDeliveryCastingChange(field, value) for the delivery and casting fields', async () => {
    const { onDeliveryCastingChange } = renderMetadata()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('C.Y. Poured'), '9')
    expect(onDeliveryCastingChange).toHaveBeenLastCalledWith('cyPoured', '9')
    await user.type(screen.getByLabelText('Date Cast'), '2026-09-27')
    expect(onDeliveryCastingChange).toHaveBeenLastCalledWith('dateCast', '2026-09-27')
  })

  it('calls onFieldChange(key, value) for Sheet No., of and the placement location', async () => {
    const { onFieldChange } = renderMetadata()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Sheet No.'), '1')
    expect(onFieldChange).toHaveBeenLastCalledWith('sheetNo', '1')
    await user.type(screen.getByLabelText('Sheet No. of'), '2')
    expect(onFieldChange).toHaveBeenLastCalledWith('sheetOf', '2')
    await user.type(screen.getByLabelText('Specific Location of Placement'), 'P')
    expect(onFieldChange).toHaveBeenLastCalledWith('placementLocation', 'P')
  })

  it('disables every field when disabled', () => {
    renderMetadata({ disabled: true })
    for (const label of ['Date of Delivery', 'C.Y. Poured', 'Date Cast', 'Job Location', 'Sheet No.', 'Sheet No. of',
      'Specific Location of Placement']) {
      expect(screen.getByLabelText(label)).toBeDisabled()
    }
  })
})
