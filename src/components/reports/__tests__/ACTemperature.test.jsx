import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ACTemperature from '../ACTemperature'

const LABELS = ['Surface Start', 'Surface Finish', 'Ambient Start', 'Ambient Finish']

function renderTemperature(props = {}) {
  const onChange = vi.fn()
  render(<ACTemperature value={{}} onChange={onChange} {...props} />)
  return onChange
}

describe('ACTemperature', () => {
  it('renders the Surface / Ambient × Start / Finish grid as empty 0.01-step numbers in °F', () => {
    renderTemperature()
    expect(screen.getByRole('heading', { name: 'Temperature' })).toBeInTheDocument()
    for (const label of LABELS) {
      const input = screen.getByLabelText(label)
      expect(input).toHaveDisplayValue('')
      expect(input).toHaveAttribute('type', 'number')
      expect(input).toHaveAttribute('step', '0.01')
    }
    expect(screen.getAllByText('°F')).toHaveLength(4)
  })

  it('shows the saved values and calls onChange(field, value)', async () => {
    const onChange = renderTemperature({ value: { surfaceStart: '55', ambientFinish: '68.5' } })
    expect(screen.getByLabelText('Surface Start')).toHaveValue(55)
    expect(screen.getByLabelText('Ambient Finish')).toHaveValue(68.5)
    await userEvent.setup().type(screen.getByLabelText('Ambient Start'), '6')
    expect(onChange).toHaveBeenLastCalledWith('ambientStart', '6')
  })

  it('disables every field when disabled', () => {
    renderTemperature({ disabled: true })
    for (const label of LABELS) expect(screen.getByLabelText(label)).toBeDisabled()
  })
})
