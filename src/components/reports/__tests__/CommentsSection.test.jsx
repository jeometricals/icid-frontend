import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CommentsSection from '../CommentsSection'

const box = () => screen.getByPlaceholderText(/additional comments/i)

describe('CommentsSection', () => {
  it("defaults to the 'Comments, Visitors, Other Work' heading", () => {
    render(<CommentsSection value="" onChange={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Comments, Visitors, Other Work' })).toBeInTheDocument()
  })

  it('takes a custom heading', () => {
    render(<CommentsSection value="" onChange={() => {}} heading="Remarks" />)
    expect(screen.getByRole('heading', { name: 'Remarks' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Comments, Visitors, Other Work' })).not.toBeInTheDocument()
  })

  it('shows the value, calls onChange with the new text, and can be disabled', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<CommentsSection value="Visitor: DDC" onChange={onChange} />)
    expect(box()).toHaveValue('Visitor: DDC')
    await userEvent.setup().type(box(), '!')
    expect(onChange).toHaveBeenLastCalledWith('Visitor: DDC!')
    rerender(<CommentsSection value="" onChange={onChange} disabled />)
    expect(box()).toBeDisabled()
  })
})
