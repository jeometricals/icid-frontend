import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcCylCylindersTable from '../ConcCylCylindersTable'

const cylinder = (overrides = {}) => ({ class: '', cylinderNo: '', slump: '', ...overrides })

function renderTable(props = {}) {
  const handlers = { onAddCylinder: vi.fn(), onCylinderChange: vi.fn(), onRemoveCylinder: vi.fn() }
  render(<ConcCylCylindersTable cylinders={[]} {...handlers} {...props} />)
  return handlers
}

describe('ConcCylCylindersTable', () => {
  it('renders the heading, helper text, three columns plus remove, and the empty state', () => {
    renderTable()
    expect(screen.getByRole('heading', { name: 'Cylinders' })).toBeInTheDocument()
    expect(screen.getByText('Inspector completes Class, Cylinder #, and Slump. Lab fills remaining columns after testing.'))
      .toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map(h => h.textContent))
      .toEqual(['Class of Concrete', 'Cylinder #', 'Slump', 'Remove'])
    expect(screen.getByText('No cylinders added yet. Click Add Cylinder to record one.')).toHaveAttribute('colspan', '4')
  })

  it('calls onAddCylinder from the Add Cylinder button', async () => {
    const { onAddCylinder } = renderTable()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add Cylinder' }))
    expect(onAddCylinder).toHaveBeenCalledTimes(1)
  })

  it('shows each row: class and cylinder # as text (alphanumeric), slump as a number', () => {
    renderTable({ cylinders: [cylinder({ class: '40', cylinderNo: 'A-1', slump: '4.5' })] })
    const row = within(screen.getByRole('table')).getAllByRole('row')[1]
    expect(within(row).getAllByRole('textbox')).toHaveLength(2)
    expect(screen.getByLabelText('Cylinder 1 Class of Concrete')).toHaveValue('40')
    expect(screen.getByLabelText('Cylinder 1 Cylinder #')).toHaveValue('A-1')
    expect(screen.getByLabelText('Cylinder 1 Slump')).toHaveValue(4.5)
    expect(screen.getByLabelText('Cylinder 1 Slump')).toHaveAttribute('step', '0.01')
  })

  it('calls onCylinderChange(index, field, value)', async () => {
    const { onCylinderChange } = renderTable({ cylinders: [cylinder(), cylinder()] })
    await userEvent.setup().type(screen.getByLabelText('Cylinder 2 Cylinder #'), 'B')
    expect(onCylinderChange).toHaveBeenLastCalledWith(1, 'cylinderNo', 'B')
  })

  it('calls onRemoveCylinder(index) from the row × button', async () => {
    const { onRemoveCylinder } = renderTable({ cylinders: [cylinder(), cylinder()] })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove cylinder 2' }))
    expect(onRemoveCylinder).toHaveBeenCalledWith(1)
  })

  it('is not wrapped in a horizontal scroll container', () => {
    renderTable()
    expect(screen.getByRole('table').parentElement).not.toHaveClass('overflow-x-auto')
  })

  it('disables Add Cylinder, every input and × when disabled', () => {
    renderTable({ cylinders: [cylinder()], disabled: true })
    expect(screen.getByRole('button', { name: 'Add Cylinder' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove cylinder 1' })).toBeDisabled()
    for (const input of [...screen.getAllByRole('textbox'), screen.getByRole('spinbutton')]) {
      expect(input).toBeDisabled()
    }
  })
})
