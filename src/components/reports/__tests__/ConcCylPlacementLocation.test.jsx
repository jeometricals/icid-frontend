import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcCylPlacementLocation from '../ConcCylPlacementLocation'

const box = () => screen.getByLabelText('Specific Location of Placement')

describe('ConcCylPlacementLocation', () => {
  it('renders a labelled 3-row textarea under the section heading', () => {
    render(<ConcCylPlacementLocation value="" onChange={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Specific Location of Placement' })).toBeInTheDocument()
    expect(box().tagName).toBe('TEXTAREA')
    expect(box()).toHaveAttribute('rows', '3')
  })

  it('shows the value and calls onChange with the new text', async () => {
    const onChange = vi.fn()
    render(<ConcCylPlacementLocation value="Pier 3" onChange={onChange} />)
    expect(box()).toHaveValue('Pier 3')
    await userEvent.setup().type(box(), 'A')
    expect(onChange).toHaveBeenLastCalledWith('Pier 3A')
  })

  it('is disabled when disabled', () => {
    render(<ConcCylPlacementLocation value="" onChange={() => {}} disabled />)
    expect(box()).toBeDisabled()
  })
})
