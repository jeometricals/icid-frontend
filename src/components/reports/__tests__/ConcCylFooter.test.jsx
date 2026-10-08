import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConcCylFooter from '../ConcCylFooter'

describe('ConcCylFooter', () => {
  it("shows the DDC form's three instruction lines, in order", () => {
    render(<ConcCylFooter />)
    expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual([
      'Resident Engineer or Inspector to complete columns 1, 2, 3.',
      'This data sheet must accompany all cylinders made this day.',
      'Cylinders will not be transported to the lab without this form',
    ])
  })

  it('has no signature block', () => {
    render(<ConcCylFooter />)
    expect(screen.queryByText(/signature/i)).not.toBeInTheDocument()
  })
})
