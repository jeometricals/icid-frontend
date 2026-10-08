import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcCylCylindersTable, { MAX_CYLINDERS } from '../ConcCylCylindersTable'

const cylinder = (overrides = {}) => ({ class: '', cylinderNo: '', slump: '', ...overrides })
const LAB_COLUMNS = ['Age Day', 'Date Tested', 'Total Load Lbs (x1000)', 'PSI', 'Page Cyl Reg.']

function renderTable(props = {}) {
  const handlers = { onAddCylinder: vi.fn(), onCylinderChange: vi.fn(), onRemoveCylinder: vi.fn() }
  render(<ConcCylCylindersTable cylinders={[]} {...handlers} {...props} />)
  return handlers
}

describe('ConcCylCylindersTable', () => {
  it('renders the heading, helper text, the three inspector and five lab columns plus remove, and the empty state', () => {
    renderTable()
    expect(screen.getByRole('heading', { name: 'Cylinders' })).toBeInTheDocument()
    expect(screen.getByText('Inspector completes Class, Cylinder #, and Slump. Lab fills remaining columns after testing.'))
      .toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map(h => h.textContent))
      .toEqual(['Class of Concrete', 'Cylinder #', 'Slump', ...LAB_COLUMNS, 'Remove'])
    expect(screen.getByText('No cylinders added yet. Click Add Cylinder to record one.')).toHaveAttribute('colspan', '9')
  })

  it('calls onAddCylinder from the Add Cylinder button', async () => {
    const { onAddCylinder } = renderTable()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add Cylinder' }))
    expect(onAddCylinder).toHaveBeenCalledTimes(1)
  })

  it('shows each row: class, cylinder # and slump as free text', () => {
    renderTable({ cylinders: [cylinder({ class: '4000 PSI', cylinderNo: 'A-1', slump: '4 in' })] })
    expect(screen.getByLabelText('Cylinder 1 Class of Concrete')).toHaveValue('4000 PSI')
    expect(screen.getByLabelText('Cylinder 1 Cylinder #')).toHaveValue('A-1')
    expect(screen.getByLabelText('Cylinder 1 Slump')).toHaveValue('4 in')
    expect(screen.getByLabelText('Cylinder 1 Slump')).toHaveAttribute('type', 'text')
  })

  it('shows the lab columns as disabled placeholders, even while the form is editable', () => {
    renderTable({ cylinders: [cylinder()] })
    for (const label of LAB_COLUMNS) {
      const input = screen.getByLabelText(`Cylinder 1 ${label} (filled by the lab)`)
      expect(input).toBeDisabled()
      expect(input).toHaveValue('')
      expect(input).toHaveAttribute('placeholder', '— lab —')
    }
    expect(screen.getByLabelText('Cylinder 1 Slump')).toBeEnabled()
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

  it('keeps Add Cylinder on below 18 rows', () => {
    renderTable({ cylinders: Array.from({ length: MAX_CYLINDERS - 1 }, () => cylinder()) })
    expect(screen.getByRole('button', { name: 'Add Cylinder' })).toBeEnabled()
    expect(screen.queryByText(/add another Concrete Cylinder Data addendum/)).not.toBeInTheDocument()
  })

  it('turns Add Cylinder off at 18 rows and says to add another addendum', () => {
    renderTable({ cylinders: Array.from({ length: MAX_CYLINDERS }, () => cylinder()) })
    expect(MAX_CYLINDERS).toBe(18)
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(19) // header + 18
    expect(screen.getByRole('button', { name: 'Add Cylinder' })).toBeDisabled()
    expect(screen.getByText(/This sheet holds 18 cylinders: add another Concrete Cylinder Data addendum for more\./))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove cylinder 18' })).toBeEnabled()
  })

  it('scrolls sideways on a narrow screen', () => {
    renderTable()
    expect(screen.getByRole('table').parentElement).toHaveClass('overflow-x-auto')
  })

  it('disables Add Cylinder, every input and × when disabled', () => {
    renderTable({ cylinders: [cylinder()], disabled: true })
    expect(screen.getByRole('button', { name: 'Add Cylinder' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove cylinder 1' })).toBeDisabled()
    for (const input of screen.getAllByRole('textbox')) {
      expect(input).toBeDisabled()
    }
  })
})
