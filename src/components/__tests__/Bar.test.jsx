import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Bar from '../Bar'

const bar = () => screen.getByRole('progressbar')
const fill = () => screen.queryByTestId('bar-fill')
const overflow = () => screen.queryByTestId('bar-overflow')

describe('Bar', () => {
  it('fills the track to the percentage', () => {
    render(<Bar percent={28.4} label="Project total" />)
    expect(bar()).toHaveAccessibleName('Project total')
    expect(bar()).toHaveAttribute('aria-valuenow', '28.4')
    expect(bar()).toHaveAttribute('aria-valuetext', '28.4%')
    expect(fill()).toHaveStyle({ width: '28.4%' })
    expect(fill()).toHaveClass('bg-construction-600')
    expect(overflow()).not.toBeInTheDocument()
  })

  it('has a fill of no width at 0', () => {
    render(<Bar percent={0} />)
    expect(bar()).toHaveAttribute('aria-valuenow', '0')
    expect(fill()).toHaveStyle({ width: '0%' })
  })

  it('is full at exactly 100, with no overflow arrow', () => {
    render(<Bar percent={100} />)
    expect(fill()).toHaveStyle({ width: '100%' })
    expect(overflow()).not.toBeInTheDocument()
  })

  it('past 100 stays full, shows the overflow arrow and still tells the true value', () => {
    render(<Bar percent={171} tone="warn" />)
    expect(fill()).toHaveStyle({ width: '100%' })
    expect(bar()).toHaveAttribute('aria-valuenow', '100')
    expect(bar()).toHaveAttribute('aria-valuetext', '171%')
    expect(overflow()).toBeInTheDocument()
  })

  it('takes the warn colour, apart from the accent, for tone="warn"', () => {
    render(<Bar percent={171} tone="warn" />)
    expect(fill()).toHaveClass('bg-warn')
    expect(fill()).not.toHaveClass('bg-construction-600')
    expect(overflow()).toHaveClass('text-warn')
  })

  it('is an empty track with no percentage', () => {
    render(<Bar percent={null} />)
    expect(bar()).not.toHaveAttribute('aria-valuenow')
    expect(bar()).not.toHaveAttribute('aria-valuetext')
    expect(fill()).not.toBeInTheDocument()
    expect(overflow()).not.toBeInTheDocument()
  })
})
