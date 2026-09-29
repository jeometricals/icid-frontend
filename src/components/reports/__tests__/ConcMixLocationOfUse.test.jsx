import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcMixLocationOfUse from '../ConcMixLocationOfUse'

const NONE = { curb: false, sidewalk: false, concreteBase: false, structural: false }

function renderLocations(props = {}) {
  const onChange = vi.fn()
  render(<ConcMixLocationOfUse value={NONE} onChange={onChange} {...props} />)
  return onChange
}

describe('ConcMixLocationOfUse', () => {
  it('renders the card with the four location checkboxes, unchecked', () => {
    renderLocations()
    expect(screen.getByRole('heading', { name: 'Location of Use' })).toBeInTheDocument()
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes.map(b => b.parentElement.textContent)).toEqual(['Curb', 'Sidewalk', 'Concrete Base', 'Structural'])
    for (const box of boxes) expect(box).not.toBeChecked()
  })

  it('checks the saved locations', () => {
    renderLocations({ value: { ...NONE, sidewalk: true, structural: true } })
    expect(screen.getByRole('checkbox', { name: 'Sidewalk' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Structural' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Curb' })).not.toBeChecked()
  })

  it('calls onChange(key, checked) when a box is ticked or unticked', async () => {
    const onChange = renderLocations({ value: { ...NONE, curb: true } })
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox', { name: 'Concrete Base' }))
    expect(onChange).toHaveBeenLastCalledWith('concreteBase', true)
    await user.click(screen.getByRole('checkbox', { name: 'Curb' }))
    expect(onChange).toHaveBeenLastCalledWith('curb', false)
  })

  it('disables every checkbox when disabled', () => {
    renderLocations({ disabled: true })
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled()
  })
})
