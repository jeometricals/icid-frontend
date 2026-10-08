import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConcCylCylindersTable, { MAX_CYLINDERS, NO_CYLINDER_ID } from '../ConcCylCylindersTable'
import { RedlineProvider } from '../../../contexts/RedlineContext'

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

describe('ConcCylCylindersTable — reviewer edits', () => {
  const CYLINDERS = [
    cylinder({ id: 'cyl-aaa', class: '40', cylinderNo: 'A-1', slump: '4.5' }),
    cylinder({ id: 'cyl-bbb', class: '40', cylinderNo: 'A-2', slump: '4' }),
  ]
  const editOf = (fieldPath, oldValue, newValue) => ({
    edit_id: `e-${fieldPath}`, report_id: 'rep-cyl', field_path: fieldPath, edit_type: 'field_change',
    old_value: oldValue, new_value: newValue, editor_initials: 'RE', editor_name: 'Rene Engineer',
  })

  // The table as it sits on a report page in review: read-only inputs inside a RedlineProvider
  function renderInReview({ cylinders = CYLINDERS, ...redline } = {}) {
    const saveField = vi.fn().mockResolvedValue({ ok: true })
    render(
      <RedlineProvider value={{ reportId: 'rep-cyl', edits: [], isDraft: false, canEdit: false, saveField, ...redline }}>
        <ConcCylCylindersTable cylinders={cylinders} onAddCylinder={vi.fn()} onCylinderChange={vi.fn()}
          onRemoveCylinder={vi.fn()} disabled />
      </RedlineProvider>
    )
    return saveField
  }

  const pencils = () => screen.queryAllByRole('button', { name: /^Edit / }).map(p => p.getAttribute('aria-label'))

  it('renders the rows as before with edit mode off', () => {
    renderInReview()
    expect(pencils()).toHaveLength(0)
    expect(screen.queryByTestId('redline')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Cylinder 2 Cylinder #')).toHaveValue('A-2')
    expect(screen.getByLabelText('Cylinder 2 Cylinder #')).toBeDisabled()
  })

  it('gives class, cylinder # and slump a pencil in edit mode, and the lab columns none', () => {
    renderInReview({ canEdit: true })
    expect(pencils()).toEqual([
      'Edit Cylinder 1 Class of Concrete', 'Edit Cylinder 1 Cylinder #', 'Edit Cylinder 1 Slump',
      'Edit Cylinder 2 Class of Concrete', 'Edit Cylinder 2 Cylinder #', 'Edit Cylinder 2 Slump',
    ])
    expect(screen.getByLabelText('Cylinder 1 PSI (filled by the lab)')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add Cylinder' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove cylinder 1' })).toBeDisabled()
  })

  it.each([
    ['Cylinder 1 Class of Concrete', 'cylinders[cyl-aaa].class'],
    ['Cylinder 2 Cylinder #', 'cylinders[cyl-bbb].cylinderNo'],
    ['Cylinder 2 Slump', 'cylinders[cyl-bbb].slump'],
  ])("saves %s under the cylinder's id: %s", async (label, fieldPath) => {
    const saveField = renderInReview({ canEdit: true })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: `Edit ${label}` }))
    const input = screen.getByLabelText(`New value for ${label}`)
    expect(input).toHaveAttribute('type', 'text')
    await user.clear(input)
    await user.type(input, '5 in')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(saveField).toHaveBeenCalledWith(fieldPath, '5 in')
  })

  it("draws a cell's edits in its place: the original struck, the new value with initials", () => {
    renderInReview({ edits: [editOf('cylinders[cyl-bbb].slump', '3', '4')] })
    expect([...screen.getByTestId('redline').children].map(line => line.textContent)).toEqual(['3', '4RE'])
    expect(screen.queryByLabelText('Cylinder 2 Slump')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Cylinder 1 Slump')).toHaveValue('4.5')
  })

  it('follows the id, not the position, when the rows are in another order', () => {
    renderInReview({ cylinders: [CYLINDERS[1], CYLINDERS[0]], edits: [editOf('cylinders[cyl-bbb].slump', '3', '4')] })
    expect(screen.queryByLabelText('Cylinder 1 Slump')).not.toBeInTheDocument() // cyl-bbb, now first
    expect(screen.getByLabelText('Cylinder 2 Slump')).toHaveValue('4.5')
  })

  it('leaves a cylinder without an id read-only in edit mode, and says why', () => {
    renderInReview({ canEdit: true, cylinders: [CYLINDERS[0], cylinder({ class: '40', cylinderNo: 'A-9', slump: '4' })] })
    expect(pencils()).toEqual([
      'Edit Cylinder 1 Class of Concrete', 'Edit Cylinder 1 Cylinder #', 'Edit Cylinder 1 Slump',
    ])
    for (const column of ['Class of Concrete', 'Cylinder #', 'Slump']) {
      const input = screen.getByLabelText(`Cylinder 2 ${column}`)
      expect(input).toBeDisabled()
      expect(input.closest('td')).toHaveAttribute('title', NO_CYLINDER_ID)
    }
    expect(screen.getByLabelText('Cylinder 1 Slump').closest('td')).not.toHaveAttribute('title')
  })

  it('says nothing about a missing id on a draft, where new rows have none yet', () => {
    renderInReview({ isDraft: true, cylinders: [cylinder()] })
    expect(screen.getByLabelText('Cylinder 1 Slump').closest('td')).not.toHaveAttribute('title')
  })
})
