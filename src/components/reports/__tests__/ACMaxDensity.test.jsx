import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ACMaxDensity from '../ACMaxDensity'

function renderDensity(props = {}) {
  const onChange = vi.fn()
  render(<ACMaxDensity value={{}} onChange={onChange} {...props} />)
  return onChange
}

describe('ACMaxDensity', () => {
  it('renders Top and Binder as empty 0.01-step numbers', () => {
    renderDensity()
    expect(screen.getByRole('heading', { name: 'Theoretical Max Density (from A/C Plant)' })).toBeInTheDocument()
    for (const label of ['Top', 'Binder']) {
      expect(screen.getByLabelText(label)).toHaveDisplayValue('')
      expect(screen.getByLabelText(label)).toHaveAttribute('type', 'number')
      expect(screen.getByLabelText(label)).toHaveAttribute('step', '0.01')
    }
  })

  it('shows the saved values and calls onChange(field, value)', async () => {
    const onChange = renderDensity({ value: { top: '152.4' } })
    expect(screen.getByLabelText('Top')).toHaveValue(152.4)
    await userEvent.setup().type(screen.getByLabelText('Binder'), '1')
    expect(onChange).toHaveBeenLastCalledWith('binder', '1')
  })

  it('disables both fields when disabled', () => {
    renderDensity({ disabled: true })
    expect(screen.getByLabelText('Top')).toBeDisabled()
    expect(screen.getByLabelText('Binder')).toBeDisabled()
  })
})
