import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DescriptionSection from '../DescriptionSection'

const box = () => screen.getByPlaceholderText(/detailed description of work/i)

describe('DescriptionSection', () => {
  it('shows the heading, the given subheading and the value', () => {
    render(<DescriptionSection value="Poured curb" onChange={() => {}} subheading="Specify for Each Operation: X." />)
    expect(screen.getByRole('heading', { name: 'Description of Work Performed and Inspected' })).toBeInTheDocument()
    expect(screen.getByText('Specify for Each Operation: X.')).toBeInTheDocument()
    expect(box()).toHaveValue('Poured curb')
  })

  it('calls onChange with the new text', async () => {
    const onChange = vi.fn()
    render(<DescriptionSection value="" onChange={onChange} subheading="" />)
    await userEvent.setup().type(box(), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('is enabled by default and disabled when disabled', () => {
    const { rerender } = render(<DescriptionSection value="" onChange={() => {}} subheading="" />)
    expect(box()).toBeEnabled()
    rerender(<DescriptionSection value="" onChange={() => {}} subheading="" disabled />)
    expect(box()).toBeDisabled()
  })
})
