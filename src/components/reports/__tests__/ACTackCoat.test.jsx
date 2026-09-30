import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ACTackCoat from '../ACTackCoat'

const LABELS = ['No. of Gallons', 'Gallons per S.Y.', 'Tack Coat Application Method / Type']

function renderTackCoat(props = {}) {
  const onChange = vi.fn()
  render(<ACTackCoat value={{}} onChange={onChange} {...props} />)
  return onChange
}

describe('ACTackCoat', () => {
  it('renders the three labelled fields, empty', () => {
    renderTackCoat()
    expect(screen.getByRole('heading', { name: 'Tack Coat' })).toBeInTheDocument()
    for (const label of LABELS) expect(screen.getByLabelText(label)).toHaveDisplayValue('')
  })

  it('uses 0.01-step numbers for the quantities and text for the method', () => {
    renderTackCoat()
    for (const label of ['No. of Gallons', 'Gallons per S.Y.']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('type', 'number')
      expect(screen.getByLabelText(label)).toHaveAttribute('step', '0.01')
    }
    expect(screen.getByLabelText('Tack Coat Application Method / Type')).toHaveAttribute('type', 'text')
  })

  it('shows the saved values and calls onChange(field, value)', async () => {
    const onChange = renderTackCoat({ value: { noOfGallons: '45', applicationMethod: 'Spray bar' } })
    expect(screen.getByLabelText('No. of Gallons')).toHaveValue(45)
    expect(screen.getByLabelText('Tack Coat Application Method / Type')).toHaveValue('Spray bar')
    await userEvent.setup().type(screen.getByLabelText('Gallons per S.Y.'), '0')
    expect(onChange).toHaveBeenLastCalledWith('gallonsPerSy', '0')
  })

  it('disables every field when disabled', () => {
    renderTackCoat({ disabled: true })
    for (const label of LABELS) expect(screen.getByLabelText(label)).toBeDisabled()
  })
})
