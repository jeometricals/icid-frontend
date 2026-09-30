import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ACPavementCourseTable from '../ACPavementCourseTable'

const course = (overrides = {}) => ({
  itemNo: '', mixType: '', stationFrom: '', stationTo: '', lane: '', length: '', width: '', course: '',
  designDepth: '', area: '', weight: '', ...overrides,
})

function renderTable(props = {}) {
  const handlers = { onAddCourse: vi.fn(), onCourseChange: vi.fn(), onRemoveCourse: vi.fn() }
  render(<ACPavementCourseTable courses={[]} {...handlers} {...props} />)
  return handlers
}

describe('ACPavementCourseTable', () => {
  it('renders the 11 column headers plus a remove column, and the empty state', () => {
    renderTable()
    expect(screen.getByRole('heading', { name: 'Pavement Course Table' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual([
      'Item No.', 'Mix Type', 'Station From', 'Station To', 'Lane', 'Length', 'Width', 'Course', 'Design Depth',
      'Area (S.Y.)', 'Weight (Tons)', 'Remove',
    ])
    const empty = screen.getByText('No courses added yet. Click Add Course to record one.')
    expect(empty).toHaveAttribute('colspan', '12')
  })

  it('calls onAddCourse from the Add Course button', async () => {
    const { onAddCourse } = renderTable()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add Course' }))
    expect(onAddCourse).toHaveBeenCalledTimes(1)
  })

  it('shows each course row with text identifiers and 0.01-step numeric measurements', () => {
    renderTable({ courses: [course({ itemNo: '4.02 AB-R', stationFrom: '5+40', area: '312.5' })] })
    const row = within(screen.getByRole('table')).getAllByRole('row')[1]
    expect(within(row).getAllByRole('textbox')).toHaveLength(6) // item, mix, two stations, lane, course
    expect(within(row).getAllByRole('spinbutton')).toHaveLength(5) // length, width, depth, area, weight
    expect(screen.getByLabelText('Course 1 Item No.')).toHaveValue('4.02 AB-R')
    expect(screen.getByLabelText('Course 1 Station From')).toHaveValue('5+40')
    expect(screen.getByLabelText('Course 1 Area (S.Y.)')).toHaveValue(312.5)
    expect(screen.getByLabelText('Course 1 Weight (Tons)')).toHaveAttribute('step', '0.01')
  })

  it('calls onCourseChange(index, field, value)', async () => {
    const { onCourseChange } = renderTable({ courses: [course(), course()] })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Course 2 Lane'), 'N')
    expect(onCourseChange).toHaveBeenLastCalledWith(1, 'lane', 'N')
    await user.type(screen.getByLabelText('Course 1 Design Depth'), '2')
    expect(onCourseChange).toHaveBeenLastCalledWith(0, 'designDepth', '2')
  })

  it('calls onRemoveCourse(index) from the row × button', async () => {
    const { onRemoveCourse } = renderTable({ courses: [course(), course()] })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove course 2' }))
    expect(onRemoveCourse).toHaveBeenCalledWith(1)
  })

  it('disables Add Course, every input and × when disabled', () => {
    renderTable({ courses: [course()], disabled: true })
    expect(screen.getByRole('button', { name: 'Add Course' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove course 1' })).toBeDisabled()
    for (const input of [...screen.getAllByRole('textbox'), ...screen.getAllByRole('spinbutton')]) {
      expect(input).toBeDisabled()
    }
  })
})
