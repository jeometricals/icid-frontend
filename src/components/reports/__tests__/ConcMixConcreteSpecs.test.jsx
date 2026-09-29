import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcMixConcreteSpecs from '../ConcMixConcreteSpecs'

const EMPTY = { classOfConcrete: '', slumpMin: '', slumpMax: '', airMin: '', airMax: '' }

function renderSpecs(props = {}) {
  const onChange = vi.fn()
  render(<ConcMixConcreteSpecs value={EMPTY} onChange={onChange} {...props} />)
  return onChange
}

describe('ConcMixConcreteSpecs', () => {
  it('renders Class of Concrete as text and Slump / Air Min and Max as numbers', () => {
    renderSpecs()
    expect(screen.getByRole('heading', { name: 'Concrete Specifications' })).toBeInTheDocument()
    expect(screen.getByLabelText('Class of Concrete')).toHaveAttribute('type', 'text')
    for (const label of ['Slump Min', 'Slump Max', 'Air Min', 'Air Max']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('type', 'number')
    }
    expect(screen.getByRole('group', { name: 'Slump' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Air' })).toBeInTheDocument()
  })

  it('shows the saved values', () => {
    renderSpecs({ value: { classOfConcrete: '40', slumpMin: '3', slumpMax: '5', airMin: '5.5', airMax: '' } })
    expect(screen.getByLabelText('Class of Concrete')).toHaveValue('40')
    expect(screen.getByLabelText('Slump Max')).toHaveValue(5)
    expect(screen.getByLabelText('Air Min')).toHaveValue(5.5)
    expect(screen.getByLabelText('Air Max')).toHaveValue(null)
  })

  it('calls onChange(field, value)', async () => {
    const onChange = renderSpecs()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Class of Concrete'), 'A')
    expect(onChange).toHaveBeenLastCalledWith('classOfConcrete', 'A')
    await user.type(screen.getByLabelText('Air Max'), '8')
    expect(onChange).toHaveBeenLastCalledWith('airMax', '8')
  })

  it('disables every input when disabled', () => {
    renderSpecs({ disabled: true })
    for (const label of ['Class of Concrete', 'Slump Min', 'Slump Max', 'Air Min', 'Air Max']) {
      expect(screen.getByLabelText(label)).toBeDisabled()
    }
  })
})
